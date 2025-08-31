// This is the server entry point / main file 


require('dotenv').config(); 

//dependencies 
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// FALLBACK FOR JWT_SECRET 
const path = require('path');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
if (!process.env.JWT_SECRET) {
    console.warn('[WARN] JWT_SECRET not set. Using insecure fallback dev-secret for now...reset this!');
}

// create the express app and parse any incoming JSON bodies 
const app = express();

// ALLOW REACT DEV SERVER TO INTERACT WITH THIS SERVER: 
app.use(cors({
    origin: 'http://localhost:3000'
}));
app.use(express.json()); 

// Configure connection pool to the Postgres database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: 'postgres',
  password: 'admin',
  database: process.env.PGDATABASE || 'lottery_app', // fallback DB name
});



// HELPER FUNCTIONS FOR SIGNUP and FINDING USER BY EMAIL: 
function signToken(user) {
    const payload = { uid: user.id, email: user.email };
    return jwt.sign(
        payload,
        JWT_SECRET, 
        { expiresIn: '7d' }   // <-- browser will 'know' this user and that they are authenticated for 7 days 
    );
}

async function findUserByEmail(email) {
    const { rows } = await pool.query(
        'SELECT id, name, email, password_hash, address FROM users WHERE email = $1', [email.toLowerCase()]
    );
    return rows[0] || null;    // <-- grab just 1 row from users table (where email == email)
}

// POST /api/auth/signup { name, email, password, address } --> localhost:3000/api/auth/signup 
app.post('/api/auth/signup', async (req, res) => {
    console.log('[server/index.js] this is where /api/auth/signup logic will be.');

    const { name, email, password, address } = req.body || {}; 

    console.log(`[server/index.js] name: ${name}`);

    // server does its own validation step (despite frontend having already done that on its end)
    if (!name || !email || !password || !address ) {
        return res.status(400).json({
            error: 'name, email, password, and address required!'
        });
    }

    try {
        const exists = await findUserByEmail(email);

        // If email already exists, need to exit: 
        if (exists) {
            return res.status(409).json({
                error: 'email already registered! Needs to be unique.'
            });
        }

        // If email does not exist already, need to proceed...
        // 1. hash password (encryption)
        const hash = await bcrypt.hash(password, 10);
        
        const { rows } = await pool.query(
            `INSERT INTO users (name, email, password_hash, address)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, email, address`, [name, email.toLowerCase(), hash, address]
        );

        const user = rows[0];
        const token = signToken(user);

        return res.status(201).json({
            token, user
        });
    } catch (e) {
        console.error('signup error: ', e);
        return res.status(500).json({
            error: 'server error on signup!'
        });
    }
});

// POST /api/auth/login {email, password}
app.post('/api/auth/login', async (req, res) => {
    console.log('[server/index.js] this is where /api/auth/login logic will be.');

    const { email, password } = req.body || {};

    // Server makes sure there is an email and password: 
    if (!email || !password) {
        return res.status(400).json({
            error: 'email and password required!'
        });
    }

    try {
        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(401).json({
                error: 'invalid credentials!'
            });
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({
                error: 'invalid credentials!'
            });
        }

        const token = signToken(user);
        return res.json({
            token, user: {id: user.id, name: user.name, email: user.email, address: user.address }
        });
    } catch (e) {
        console.error('login error: ', e);
        return res.status(500).json({
            error: 'server error on login!'
        })
    }
});

// Insert into postgres table called scanned_tickets and compare to winning_tickets table:
app.post('/api/scanned-tickets', async ( req, res ) => {

    console.log('[server/index.js] app.post | REQ.BODY:', req.body);

    const { ticket_id, ocr_text, prediction } = req.body || {};

    console.log('[server/index.js] app.post ocr_text: ', ocr_text);
    
    
    // if no ticket_id, throw an error 
    if (!ticket_id) {
        return res.status(400).json({
            error: 'ticket_id is required' 
        });
    }

    // --- PARSE OCR TEXT ON THE SERVER ----- 
    // Need to normalize the ocr text to better extract the text and numbers 
    function normalizeOcr(ocr) {
        if (!ocr || typeof ocr !== 'string') return '';
        // collapse whitespace, uppercase, strip some stray characters that confuse matching
        let t = ocr.replace(/\s+/g, ' ').toUpperCase();

        // Common OCR confusions in the 5 sample tickets:
        // "AUGO6" -> "AUG06", "VALUR" -> "VALUE", "ODDS" sometimes "0DDS" (zero)
        t = t.replace(/AUGO(\d)/g, 'AUG0$1');
        t = t.replace(/\bVALUR\b/g, 'VALUE');
        t = t.replace(/\b0DDS\b/g, 'ODDS'); // zero -> letter O
        t = t.replace(/\bAP\b/g, 'QP');       // AP -> QP (ocr of 'ap' or 'AP' as QP)

        return t.trim();
    }

    // Split “digits” tokens, correcting O->0 and stripping non-digits.
    // If a token has >2 digits (e.g., "422"), split into 2-digit chunks: "42","2".
    function normalizeNumTokens(tokens) {
        const out = [];
        for (let t of tokens) {
        t = t.replace(/O/g, '0').replace(/[^0-9]/g, '');
        if (!t) continue;
        if (t.length <= 2) {
            out.push(t);
        } else {
            for (let i = 0; i < t.length; i += 2) {
            out.push(t.slice(i, i + 2));
            }
        }
        if (out.length >= 6) break;
        }
        return out.slice(0, 6);
    }

    // Try to extract the picks line: starts with "A ", has six numbers, ends before QP (or AP->QP)
    // Return normalized string like "07-12-36-44-48-52"
    function extractTicketNumber(txt) {
        // 1) strict regex: A xx xx xx xx xx xx QP
        const strict = /\bA\s+([0-9O]{1,2})\s+([0-9O]{1,2})\s+([0-9O]{1,2})\s+([0-9O]{1,2})\s+([0-9O]{1,2})\s+([0-9O]{1,2})\s+QP\b/;
        let m = strict.exec(txt);
        if (m) {
            const nums = m.slice(1, 7).map(n => n.replace(/O/g, '0').padStart(2, '0'));
            return 'A ' + nums.join(' ');
        }

        // 2) flexible: capture the chunk between "A " and " QP", then split into tokens
        const flex = /\bA\s+([0-9O\s]{8,})\s+QP\b/;
        m = flex.exec(txt);
        if (m) {
            const tokens = m[1].trim().split(/\s+/);
            let nums = normalizeNumTokens(tokens);
            if (nums.length === 6) {
                return 'A ' + nums.map(n => n.padStart(2, '0')).join(' ');
            }
        }

        return null;
    }



    // --- Parse fields we care about from OCR ---
    function parseOcr(ocrRaw) {
        const txt = normalizeOcr(ocrRaw);
        const out = { ticket_number: null, draw_number: null, cash_amount: null };

        // Ticket number = picks line
        out.ticket_number = extractTicketNumber(txt);

        // Draw number: "DRAW #3608"
        const draw = txt.match(/DRAW\s*[#:]*\s*(\d{3,6})/);
        if (draw) out.draw_number = parseInt(draw[1], 10);

        // Cash amount: prefer "EST CASH VALUE $xx,xxx,xxx"
        const estCash = txt.match(/EST\.?\s*CASH\s*VAL(?:UE|UR)\s*\$?\s*([\d,]+)(?:\.\d{2})?/);
        if (estCash) {
        out.cash_amount = parseInt(estCash[1].replace(/,/g, ''), 10);
        } else {
        // Fallback: largest $-looking number in text
        const money = [...txt.matchAll(/\$\s*([\d,]+)(?:\.\d{2})?/g)]
            .map(m => parseInt(m[1].replace(/,/g, ''), 10))
            .filter(Number.isFinite);
        if (money.length) out.cash_amount = Math.max(...money);
        }

        return out;
    }

    const parsed = parseOcr(ocr_text);

    console.log('[server/index.js] parsed: ', parsed);
    console.log('[server/index.js] parsed.ticket_number: ', parsed.ticket_number);
    console.log('[server/index.js] parsed.draw_number: ', parsed.draw_number);
    console.log('[server/index.js] parsed.cash_amount: ', parsed.cash_amount);

    // client = our postgres database 
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ticket_number = parsed.ticket_number || null; 
        const draw_number = parsed.draw_number || null; 
        const cash_amount = parsed.cash_amount || null; 

        // 1. look up in the winner row 
        let winner = null; 
        if (ticket_number) {
            const winnerQuery = await client.query(
                `SELECT id, ticket_id, ticket_number, draw_number, cash_amount
                FROM winning_tickets 
                WHERE ticket_id = $1
                AND ticket_number = $2`, [ticket_id, ticket_number]
            );
            winner = winnerQuery.rows[0] || null; 
        }

        const wasWinner = !!winner; 
        const winnerId = winner ? winner.id : null; 

        console.log('\n---\n[server/index.js] wasWinner: ', wasWinner);
        console.log('[server/index.js] winnerId: ', winnerId);

        // IF IS WINNER, GET USER'S NAME AND ADDRESS: 
        let mailTo = null; 
        let recipientName = null; 

        if (wasWinner) {
            const { rows: addrRows } = await client.query(
                'SELECT name, address FROM users WHERE id = $1', [req.user.uid]
            );

            if (addrRows[0]) {
                recipientName = addrRows[0].name;
                mailTo = addrRows[0].address; 
            }
        }

        // 2. now, try and insert the scan if it is not a duplicate
        const scannedQuery = await client.query(
            `INSERT INTO scanned_tickets 
                (ticket_id, ticket_number, draw_number, cash_amount,
                 was_winner, winner_id, ocr_text, prediction)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (ticket_id) DO NOTHING
            RETURNING id, scanned_at, was_winner, winner_id`,
            [
                ticket_id,
                ticket_number,
                draw_number,
                cash_amount, 
                wasWinner, 
                winnerId || null, 
                ocr_text || null,
                prediction || null
            ]
        ); 

        // 3. grab the newly inserted row into scanned_tickets 
        let scanRow, status; 
        if (scannedQuery.rowCount === 1) {
            scanRow = scannedQuery.rows[0];
            status = 'inserted';
        } else {
            const getTheDuplicate = await client.query(
                `SELECT id, scanned_at, was_winner, winner_id
                FROM scanned_tickets WHERE ticket_id = $1`, [ticket_id]
            );
            scanRow = getTheDuplicate.rows[0];
            status = 'duplicate';
        }

        await client.query('COMMIT');

        // 4. decide what to send back to the frontend in the response (res) 
        return res.json({
            status, 
            scan_id: scanRow.id, 
            scanned_at: scanRow.scanned_at,
            parsed, 
            wasWinner: scanRow.was_winner,
            winnerId: scanRow.winner_id,
            winner,
            mailTo,
            recipientName 
        });
    } catch(err) {
        await client.query('ROLLBACK');    // <- in case of error, discard this attempt 
        console.error('DB INSERT or COMPARE ERROR: ', err);
        return res.status(500).json({
            error: 'DATABASE ERROR! '
        }); 
    } finally {
        // no matter what happens...always release the client (i.e. disconnect from postgres)
        client.release();
    }
});


// NOW WE START THE SERVER! 
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`[server/index.js] Backend listening on http://localhost:${PORT}`);
});