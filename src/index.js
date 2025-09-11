import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.js';              // Main App component
import reportWebVitals from './reportWebVitals.js'; // Performance metrics (optional)

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Optional: Measure performance in your app
// Pass a function to log results, e.g., reportWebVitals(console.log)
// or send to an analytics endpoint
reportWebVitals();
