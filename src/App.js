import React from 'react';
import Login from './Login';
import Signup from './Signup';
import {BrowserRouter, Routes, Route} from 'react-router-dom'; 

// ImageClassifier.jsx page:
import ImageClassifier from './ImageClassifier';

// Need to have Route guard! 
import ProtectedRoute from './ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
       <Routes>
          <Route path='/login' element={<Login />}></Route>
          <Route path='/signup' element={<Signup />}></Route>

          {/* Only allow access to classifier when authed */}
          <Route path="/" element={ 
            <ProtectedRoute>
              <ImageClassifier />
            </ProtectedRoute>
          }  /> 
       </Routes>
    </BrowserRouter>
  )
}