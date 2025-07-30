import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import DrawingGame from './DrawingGame.js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DrawingGame />
  </React.StrictMode>
);