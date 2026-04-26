import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Check SharedArrayBuffer support
if (typeof SharedArrayBuffer === 'undefined') {
  console.error('SharedArrayBuffer is not available. COOP/COEP headers may not be set correctly.');
} else {
  console.log('SharedArrayBuffer is available:', typeof SharedArrayBuffer);
}

// Log crossOriginIsolated status
console.log('crossOriginIsolated:', window.crossOriginIsolated);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
