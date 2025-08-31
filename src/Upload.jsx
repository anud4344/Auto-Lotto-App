import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as tflite from '@tensorflow/tfjs-tflite';

const Upload = () => {
    const [isModelLoading, setIsModelLoading] = useState(true); 
    const [model, setModel] = useState(null)
    const [result, setResult] = useState("");
    const [imageURL, setImageURL] = useState(null);

    const imageRef = useRef();
    const fileInputRef = useRef();

    const loadModel = async () => {
        setIsModelLoading(true);
        try {
            await tflite.setWasmPath('/tflite/');

            const loadedModel = await tflite.loadTFLiteModel('/tflite/model.tflite', {
              wasmPath: '/tflite/',
              wasmNames: {
                 simd: 'tflite_web_api_cc_simd.wasm',
                 plain: 'tflite_web_api_cc.wasm',
      },
      jsClientPath: '/tflite/tflite_web_api_client.js',
    });
            setModel(loadedModel);
        } catch (error) {
            console.error("Model loading failed:", error);
        }
        setIsModelLoading(false);
    }

   const handleImageUpload = (e) => {
    const { files } = e.target;
    if (files.length > 0) {
        const url = URL.createObjectURL(files[0]);
        setImageURL(url);
        setResult('');
    } else {
        setImageURL(null);
    }

   };

   const verify = async () => {
         if (!model || !imageRef.current) return;

         const imgTensor = tf.browser
             .fromPixels(imageRef.current)
             .resizeNearestNeighbor([224, 224])
             .toFloat()
             .div(tf.scalar(255))
             .expandDims(0);

        const prediction = await model.predict(imgTensor);
        const data = await prediction.data();

        const isValid = data[1] > data[0];
        setResult(isValid ? 'Valid Ticket' : 'Invalid Ticket');

        imgTensor.dispose();

   }

   const triggerUpload = () => {
      fileInputRef.current.click();
   };

   useEffect(() => {
      loadModel();
   }, []);

   return (
     <div style={{ textAlign: 'center'}}>
      <h1>Auto Lotto Verifier</h1>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleImageUpload} 
        style = {{display: 'none'}}
      />
      <button onClick={triggerUpload}>Upload Image</button> 

       {imageURL && (
        <div>
          <img
            src={imageURL}
            alt="Uploaded Ticket"
            ref={imageRef}
            crossOrigin="anonymous"
            width="300"
            height="300"
            style={{ marginTop: '20px' }}
          />
          <br />
          <button onClick={verify}>Classify Ticket</button>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <h2>{result}</h2>
        </div>
      )}

     </div>
   );
}

export default Upload;