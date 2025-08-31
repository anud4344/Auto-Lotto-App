# Steps implemented

## Overview of App

### Current App Setup

**1. Frontend = React (runs in browser)**

Anything that runs in the React file (namely, _ImageClassifier.jsx_) is processing / running in the browser. This is often called _"client-side"_.

**2. Backend = NodeJS (runs on server)**

Right now, the backend (server) is not really doing anything...

### Changes to App

**1. Frontend = React** (_no change_)

**2. Middleware --> API layer = Express**

_Express_ handles HTTP endpoints by listening when there is a **POST** request (_e.g. when a user clicks 'classify images'_), parse any data (as JSON) in the POST request, do basic data validation (_e.g. decide if this is valid type of image or not_), and executes the SQL query to add data to table in postgres.

**3. Backend = postgreSQL**

Will have table 'winning_tickets' with columns:

- **id:** id of this row of data
- **ticket_id:** id specific to the lottery ticket
- **ocr_text:** text from tesseract
- **prediction:** text of prediction from our machine learning model
- **created_at:** timestamp of when this row got created

**How does all of this come together?**

React will 'see' a winning ticket. React calls something like:

```javascript
fetch("/api/winning-tickets", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ticketId, ocrText, prediction }),
});
```

s
Express will receive the above POST and do its steps:

- parses JSON
- runs INSERT (SQL query / command)
- returns success or failure back to browser

Postgres gets the query (from Express) and stores the row in the table.

## Implementing the above changes

**1. Create Express + postgres (pg) backend**

- create new folder called "server/" at project root (i.e. next to "src/" folder but not inside of src/!)
- inside of "server/" folder run these two lines in Terminal:

```bash
npm init -y
npm install express pg dotenv cors
```

**2. create index.js file inside of server/**

Add details for spinning up server-side app, connecting to postgres, and sending data to postgres that was received from the front-end.

**3. create .env file inside of server/**

```bash
DATABASE_URL=postgres://username:password@localhost:5432/winning_tickets
```

**4. to connect these new pieces with our front-end, add the following to main React file (e.g. ImageClassifier.jsx):**

```javascript
await fetch("http://localhost:4000/api/winning-tickets", {
  method: "post",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ticketId,
    ocrText: ocrArray[1], // <- our javascript array, already exists!
    prediction: preds[0].className, // <- need to adjust
  }),
});
```

**5. start up database in Terminal:**

(a) If you need to start up and keep postgres running in the background:

```bash
brew services start postgres   # <- brew is ONLY FOR MAC!
```

(b) create a new database called 'lottery_app':

```bash
createdb lottery_app
```

or

```sql
CREATE DATABASE lottery_app;
```

(c) connect to / go into postgres lottery_app database:

```bash
psql -d lottery_app
```

or

```sql
\c lottery_app
```

(d) create the 'winning_tickets' table inside of lottery_app database:

```sql
CREATE TABLE winning_tickets (
    id SERIAL PRIMARY KEY,
    ticket_id TEXT,
    ticket_number TEXT,
    draw_number int,
    cash_amount int
);

\q
```

_NOTE: the \q at the end will exit the postgres Terminal._

**Example winning ticket (image 1):**

ticket_id: 49982122400296602847489608902133490504V#7YXH6M929#876#%H93596K2X3
ticket_number: A 07 12 36 44 48 52
draw_number: 3608
cash_amount: 17860000

(d.2) INSERT example winning ticket into winning_tickets table

```sql

INSERT INTO winning_tickets (ticket_id, ticket_number, draw_number, cash_amount) VALUES ('49982122400296602847489608902133490504V#7YXH6M929#876#%H93596K2X3', 'A 07 12 36 44 48 52', 3608, 17860000);

```

(e) create the 'scanned_tickets' table inside of lottery_app database:

NOTE: the frontend will just get the barcode scanned ticket id, the ocr text (not parsed), and the ML prediction and send that all to the backend to sort through and handle.

This table has columns:

- id (automatically filled)
- ticket_id: TEXT
- ticket_number: TEXT (from ocr)
- draw_number: INT
- cash_amount: INT
- was_winner: BOOLEAN (i.e. TRUE or FALSE)
- winner_id: INT (is tied directly to winner_tickets.id)
- ocr_text: TEXT
- prediction: TEXT
- scanned_at: TIME

Then, it has the UNIQUE(ticket_id) function at the end which ensures that there can be no duplicate values of ticket_id in this table. In other words, there cannot be more than 1 entry (row) with a specific ticket_id value.

```sql
CREATE TABLE scanned_tickets (id SERIAL PRIMARY KEY, ticket_id TEXT, ticket_number TEXT, draw_number INT, cash_amount INT, was_winner BOOLEAN NOT NULL DEFAULT FALSE, winner_id INTEGER REFERENCES winning_tickets(id), ocr_text TEXT, prediction TEXT, scanned_at TIMESTAMP DEFAULT NOW(), UNIQUE(ticket_id));
```

**6.Extending app for user signup / login:**

(a) need to add a users table to postgres to hold values of user

```sql

CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW());

```

(b) need to add POST routes to **server/index.js**

See file at the following 2 routes:

1. '/api/auth/signup'
2. '/api/auth/login'

**7.Auth for user signup / login:**

(a) Make auth.js and ProtectedRoute.js
(b) updates to Login.js, Signup.js, and ImageClassifier.jsx for auth tokens
(c) Create **users** table in our postgres database
(d) Need to install dependencies: react-router-dom, bootstrap, bcrypt, jsonwebtoken
(e) Following changes to server/index.js

```js
// server/index.js
// ...WILL COMPLETE THIS SECTION...
```

<br>
<hr>
<br>

**(Appendix) OPTIONAL: helpful commands for postgres**

- view tables / database contents

```sql
\l
```

or

```sql
\dt
```

- drop an existing table, called 'example_table':

```sql
DROP TABLE IF EXISTS example_table;
```

- view first 5 rows of table

```sql
SELECT * FROM winning_tickets
LIMIT 5;
```

- counting number of rows

```sql
SELECT COUNT(*) FROM winning_tickets;
```

**6. start up server in Terminal:**

```bash
node server/index.js
```
