// ImageClassifier.jsx with HTML5-QrCode scanner and Tesseract OCR 

import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';


import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';


import Tesseract from 'tesseract.js';



import { getToken } from './auth';

// Set a base for the Express server 
const API_BASE = 'http://localhost:4000';

export default function ImageClassifier() {
  // ─── MODEL & IMAGE STATE ────────────────────────────────────────────────
  const [model, setModel] = useState(null);
  const [imageFiles, setImageFiles] = useState([]); // <-- store file objects 
  const [imageURLs, setImageURLs] = useState([]);   // <-- store URLs of images 
  const [arrayPredictions, setArrayPredictions] = useState([]);

  // ─── SCAN STATES FOR QR CODE ─────────────────────────────────────────────
  const [ticketIds, setTicketIds] = useState([]);

  // States for OCR-extract text ─────────────────────────────────
  const [ocrTexts, setOcrTexts] = useState([]);             // OCR-extracted text per image

  // (GET and POST requests) need to get info from server for each image 
  const [serverResults, setServerResults] = useState([]); 

  // ─── AGGREGATED SCORES ───────────────────────────────────────────────────
  const [avgScore, setAvgScore] = useState(null);
  const [maxScore, setMaxScore] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

  // ─── REFS ─────────────────────────────────────────────────────────────────
  const fileInputRef = useRef();
  const qrScannerRef = useRef();   // <-- ref to the hidden div that is used by HTML5qr

  // ─── SERVER MESSAGES output to the UI─────────────────────────────────────────────────────────────────
  // A short textual message from the server to show to the user (success/info/warning)
  const [serverMessage, setServerMessage] = useState(null);

  // The type of the server message: 'info'|'success'|'error' - used for simple styling
  const [serverMessageType, setServerMessageType] = useState('info');

  // Boolean: true while we are sending data to the server (used to disable buttons)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-dismiss the banner after 4 seconds whenever a message is set
  useEffect(() => {
    if (!serverMessage) return;
    const t = setTimeout(() => setServerMessage(null), 4000);
    return () => clearTimeout(t);
  }, [serverMessage]);


  // ─── LOAD MOBILENET ONCE ─────────────────────────────────────────────────
  useEffect(() => {
    mobilenet.load().then(loaded => {
      console.log('MobileNet loaded');
      setModel(loaded);
    });
  }, []);

  // ─── HANDLE MULTI-UPLOAD ─────────────────────────────────────────────────
  const handleMultiUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const urls  = files.map(f => URL.createObjectURL(f));
    console.log('Selected files:', files, '→ URLs:', urls);
    
    // Update state --> file objects + preview URLs 
    setImageFiles(files); 
    setImageURLs(urls);
    setArrayPredictions([]);
    
    // Handle ticket ids for qr code scanner 
    setTicketIds([]);

    // Set blank list for OCR text 
    setOcrTexts([]);

    // Need to reset server results between files 
    setServerResults([]);

    // reset aggregated
    setAvgScore(null);
    setMaxScore(null);
    setVoteResult(null);
  };

    // ─── UTILS: TRY SCAN WITH VARIOUS PREPROCESSING ─────────────────────────────
  /**
   * Attempts to decode a barcode from given blob/file. Returns decoded text or null.
   */
  // Try several formats, first with the native BarcodeDetector (if available),
  // then fallback to ZXing-only. Return decoded text or null.
  const BARCODE_FORMATS = [
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.PDF_417,
    Html5QrcodeSupportedFormats.AZTEC
  ];

const tryScan = async (scanner, blobOrFile) => {
  const asText = (r) =>
    typeof r === 'string'
      ? r
      : r && typeof r === 'object'
      ? (r.decodedText ?? null)
      : null;

  // Prefer scanFileV2 with native detector
  try {
    if (typeof scanner.scanFileV2 === 'function') {
      const r1 = await scanner.scanFileV2(blobOrFile, {
        useBarCodeDetectorIfSupported: true,
        formatsToSupport: BARCODE_FORMATS,
      });
      return asText(r1);
    }
  } catch (_) {}

  // Fallback: force ZXing path
  try {
    if (typeof scanner.scanFileV2 === 'function') {
      const r2 = await scanner.scanFileV2(blobOrFile, {
        useBarCodeDetectorIfSupported: false,
        formatsToSupport: BARCODE_FORMATS,
      });
      return asText(r2);
    }
  } catch (_) {}

  // Legacy fallback
  try {
    const r3 = await scanner.scanFile(blobOrFile);
    return asText(r3);
  } catch (_) {
    return null;
  }
};

  /**
   * Creates a Blob from a canvas element and wraps it as a File.
   */
  const canvasToFile = canvas => new Promise(res => {
    canvas.toBlob(blob => {
      const file = new File([blob], 'crop.png', { type: 'image/png' });
      res(file);
    }, 'image/png');
  });

  /**
   * Performs up to three scan attempts:
   * 1) on original file
   * Then crops image to bottom 35% and:
   * 2) on grayscale 
   * 3) on binary thresholded (i.e. black-and-white)
   * Returns decoded text or null.
   */
  const scanWithSteps = async (scanner, file, img, canvasId) => {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    // attempt 1: original file 
    console.log('Try decoding barcode...');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    let result = await tryScan(scanner, file);
    if (result) return { result, step: 'original' };

    // prepare ROI canvas for steps 2 & 3

    // crop bottom 35%
    const w = img.width;
    const h = img.height * 0.35;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, img.height - h, w, h, 0, 0, w, h);

    // attempt 2: grayscale
    console.log('Attempting grayscaling for barcode...');
    const data = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < data.data.length; i += 4) {
      // NOTE: the formula below is a mathematical formula from computer vision to grayscale an image:
      const l = 0.299 * data.data[i] + 0.587 * data.data[i+1] + 0.114 * data.data[i+2];
      data.data[i] = data.data[i+1] = data.data[i+2] = l;
    }
    ctx.putImageData(data, 0, 0);
    let file2 = await canvasToFile(canvas);
    result = await tryScan(scanner, file2);
    if (result) return { result, step: 'grayscale' };

    // attempt 3: threshold
    console.log('Attempting binary thresholding for barcode...');
    for (let i = 0; i < data.data.length; i += 4) {
      const lum = data.data[i];
      const bin = lum > 128 ? 255 : 0;
      data.data[i] = data.data[i+1] = data.data[i+2] = bin;

      // If i=0, data.data[0], data.data[1], data.data[2] <-- R, G, B, alpha 
      // i+=4 --> i=4
    }
    ctx.putImageData(data, 0, 0);
    const file3 = await canvasToFile(canvas);
    result = await tryScan(scanner, file3);
    return { result, step: result? 'threshold' : 'failed' };
  };

  // ─── CLASSIFY & AGGREGATE ────────────────────────────────────────────────
  const classifyBatch = async () => {

    // IF CURRENTLY PROCESSING, PREVENT DOUBLE-SUBMIT: 
    if (isSubmitting) return; 
    setIsSubmitting(true);
    setServerMessage('Processing images...');
    setServerMessageType('info');

    if (!model || imageURLs.length === 0) return;
    console.log('Starting per-image classification for', imageURLs.length);

    // Instantiate the QR code scanner object and have it point to the hidden div 
    const scanner = new Html5Qrcode(qrScannerRef.current.id);
    
    // arrays to hold image predictions and ids 
    const predsArray = [];
    const idsArray = [];    // Array to hold ids for qr scanning 

    // Array to hold extracted text from this image 
    const ocrArray = []; 

    // Need to hold server results 
    const serverArray = []; 

    // NOTE: this loops over each image.
    for (let i = 0; i < imageFiles.length; i++ ) {
      const file = imageFiles[i];
      const url = imageURLs[i];

      // load image file into an <img> tag 
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await new Promise(res => (img.onload = res));

      // ---AT BARCODE DECODING FOR EACH IMG ----------------
      const canvasId = `debug-canvas-${i}`;
      const { result: ticket_id, step } = await scanWithSteps(scanner, file, img, canvasId);
      console.log(`Image[${i}] got ID='${ticket_id}' using step '${step}'`);
      idsArray.push(ticket_id || null);

      //-------------------------------------------------------
      // Recognize the printed text via Tesseract OCR 
      const { data: { text }} = await Tesseract.recognize(url, 'eng');
      const ocr_text = (text.trim() || null);

      //-------------------------------------------------------

      // Push extract text to the ocrArray 
      ocrArray.push(ocr_text);

      // LOG OCR RESULTS TO CONSOLE: 
      console.log(`OCR text[${i}]:`, ocr_text);

      // Run machine learning classifier:
      const preds = await model.classify(img);
      predsArray.push(preds);
      const topPrediction = preds?.[0] || {};
      const prediction = topPrediction.className || null; 

      // APIPOST to backend (scanned_tickets table and compare with winners)
     
      const responseFromServer = await fetch(`${API_BASE}/api/scanned-tickets`, {
        method: 'POST',
        headers: { 
          'Content-Type' : 'application/json', 
          ...(getToken() ? { Authorization: `Bearer $(getToken())` } : {}) 
        },
        body: JSON.stringify({
          ticket_id,
          ocr_text,
          prediction
        })
      });

      // Turn the response into JSON and push to our server array 
      const responseFromServerJson = await responseFromServer.json();
      serverArray.push(responseFromServerJson);
      console.log(`[ImageClassifier; data from server] image ${i}:`, responseFromServerJson);

      // Check the status return from the server
      if (responseFromServerJson.status === 'winner' || responseFromServerJson.wasWinner) {
        const addr = responseFromServerJson.mailTo;
        setServerMessage(`Winner! A check will be mail to ${addr}.`);
        setServerMessageType('success');
      } else if (responseFromServerJson.status === 'duplicate') {
        setServerMessage('Claim not allowed for this ticket as it is a duplicate');
        setServerMessageType('info');
      } else if (responseFromServerJson.status === 'inserted') {
        setServerMessage('Claim Allowed, ticket uploaded');
        setServerMessageType('success');
      } else {
          setServerMessage('An Unexpected Error occurred');
          setServerMessageType('error');
      }
    } // <-- END OF FOR LOOP 

    // Clear out data from scanner instance 
    await scanner.clear();

    // Save OCR results to our state variable (i.e. setOcrTexts)
    setOcrTexts(ocrArray);

    // Add prediction and ticket ids to arrays: 
    setArrayPredictions(predsArray);
    setTicketIds(idsArray);

    // Update UI state 
    setServerResults(serverArray);

    // TODO: compute aggregated scores or any other logic below...
    // ...

    // RESET isSubmitting: 
    setIsSubmitting(false);
  };

  // ─── UI TRIGGERS ─────────────────────────────────────────────────────────
  const triggerFileSelect = () => fileInputRef.current.click();

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
   <div className="app-shell">
    {serverMessage && (
      <div
        // container style for banner; color changes according to serverMessageType
        style={{
          margin: '8px auto',
          padding: '10px 14px',
          maxWidth: 700,
          borderRadius: 6,
          fontWeight: 600,
          color: serverMessageType === 'success' ? '#033' : serverMessageType === 'error' ? '#400' : '#222',
          background: serverMessageType === 'success' ? '#dff6dd' : serverMessageType === 'error' ? '#ffdede' : '#fff8e1',
          border: serverMessageType === 'success' ? '1px solid #9be08a' : serverMessageType === 'error' ? '1px solid #f5a6a6' : '1px solid #ffeaa7'
        }}
      >
        {serverMessage}
      </div>
    )}


        <div className="app-bar">
          <div className="app-title">Auto Lotto: Ticket Claim & Verification</div>
          <div id="auth-slot"/>{/* Step 2 inserts sign-in UI here */}
        </div>
        <div className="card">
          <div className="kv"><div className="k">Status</div><div className="v">Ready</div></div>
          <div className="spacer"></div>
          <div className="btn row">
            <button className="btn" onClick={triggerFileSelect} disabled={isSubmitting}>
              {isSubmitting ? 'Please wait, system processing...' : 'Upload Ticket Photos'}
            </button>
            {imageFiles.length > 0 && (
              <button className="btn primary" onClick={classifyBatch} disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : `Process ${imageFiles.length} Images`}
              </button>
            )}
          </div>
        </div>
      {/* Hidden multi-file input */}
      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        onChange={handleMultiUpload}
        style={{ display: 'none' }}
      />
     
      

      {/* Hidden div for html5-qrcode to attach itself to */}
      <div 
        id = "qr-reader" 
        ref = { qrScannerRef } 
        style = {{ display: 'none' }}
      />

      {/* Preview + individual predictions */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, 120px)',
          gap: 200,
          justifyContent: 'center',
          marginTop: 20,
        }}
      >
        {imageURLs.map((url, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <img 
              src={url} 
              alt={`ticket-${i}`} 
              width={150} 
              crossOrigin="anonymous" 
            />
            <canvas 
              id = {`debug-canvas-${i}`}
              style = {{ width: 220, border: '1px solid #f00'}}
            />
            <p style = {{ fontSize: 12 }}>
              <strong>ID:</strong> {typeof ticketIds[i] === 'object' ? ticketIds[i]?.decodedText : (ticketIds[i] ?? '-')}

            </p>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <div><strong>Server:</strong> {serverResults[i]?.status || '-'}{serverResults[i]?.wasWinner ? ' (WINNER)' : ''}</div>
              {/* safe‐access className */}
              {arrayPredictions[i]?.[0]?.className 
                ?? '…pending'}
            </div>
          </div>
        ))}
      </div>

      {/* Aggregated decision */}
      {voteResult && (
        <div style={{ marginTop: 30, fontSize: 18 }}>
          <strong>Ticket‐level verdict:</strong> {voteResult}<br/>
          <em>Average “valid” score:</em> {(avgScore*100).toFixed(1)}%<br/>
          <em>Max “valid” score:</em> {(maxScore*100).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
