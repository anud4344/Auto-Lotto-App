import React, { useState, useEffect } from 'react';
import logo from './logo.svg';
import './Home.css';
// import Upload from './Upload';
import ImageClassifier from './ImageClassifier';

function Home() {
  return (
    <div className="App">
        <ImageClassifier />
    </div>
  );
}

export default Home;
