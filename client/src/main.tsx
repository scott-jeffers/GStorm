import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // TS will resolve .tsx
import './index.css';
import 'leaflet/dist/leaflet.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Failed to find the root element. Please ensure an element with id='root' exists in your index.html.");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 