// We need to ensure that the app ONLY goes to the next 
// pages (i.e. to ImageClassifier.jsx and beyond) after 
// a user has successfully logged in! 

import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthed } from './auth';

export default function ProtectedRoute({ children }) {
    return isAuthed() ? children : <Navigate to="/login" replace />;
}