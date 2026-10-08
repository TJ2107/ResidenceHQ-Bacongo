import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import App from './App.tsx';
import './index.css';

// Intercept console.error to silence internal Firestore SDK assertion warnings (ID: ca9 / b815)
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = args.map(a => {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return `${a.message} ${a.stack}`;
    try { return JSON.stringify(a); } catch { return String(a || ''); }
  }).join(' ');

  if (
    msg.includes('FIRESTORE') ||
    msg.includes('ASSERTION FAILED') ||
    msg.includes('Unexpected state') ||
    msg.includes('ca9') ||
    msg.includes('b815') ||
    msg.includes('ApiProjectMapError') ||
    msg.includes('Google Maps JavaScript API error') ||
    msg.includes('gm_authFailure')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Global handler to catch asynchronous promise rejections and prevent crash overlays
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const reasonStr = (reason?.stack || reason?.message || String(reason || '')).toString();
  if (
    reasonStr.includes('FIRESTORE') ||
    reasonStr.includes('ASSERTION FAILED') ||
    reasonStr.includes('Unexpected state') ||
    reasonStr.includes('ca9') ||
    reasonStr.includes('b815') ||
    reasonStr.includes('ApiProjectMapError') ||
    reasonStr.includes('Google Maps JavaScript API error') ||
    reasonStr.includes('gm_authFailure')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  console.warn('Unhandled promise rejection captured gracefully:', event.reason);
  event.preventDefault();
}, true);

// Global handler to prevent internal Firestore WebChannel assertion errors from crashing the UI
window.addEventListener('error', (event) => {
  const err = event.error;
  const msgStr = (event.message || err?.stack || err?.message || String(err || '')).toString();
  if (
    msgStr.includes('FIRESTORE') ||
    msgStr.includes('ASSERTION FAILED') ||
    msgStr.includes('Unexpected state') ||
    msgStr.includes('ca9') ||
    msgStr.includes('b815') ||
    msgStr.includes('ApiProjectMapError') ||
    msgStr.includes('Google Maps JavaScript API error') ||
    msgStr.includes('gm_authFailure')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
}, true);

// Global window.onerror for legacy uncaught errors
window.onerror = (message, _source, _lineno, _colno, error) => {
  const fullMsg = (String(message || '') + ' ' + (error?.stack || error?.message || String(error || ''))).toString();
  if (
    fullMsg.includes('FIRESTORE') ||
    fullMsg.includes('ASSERTION FAILED') ||
    fullMsg.includes('Unexpected state') ||
    fullMsg.includes('ca9') ||
    fullMsg.includes('b815') ||
    fullMsg.includes('ApiProjectMapError') ||
    fullMsg.includes('Google Maps JavaScript API error') ||
    fullMsg.includes('gm_authFailure')
  ) {
    return true; // Prevents default error overlay
  }
  return false;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('PWA Service Worker enregistré avec succès :', registration.scope);
      })
      .catch((error) => {
        console.warn('Échec de l\'enregistrement du Service Worker PWA :', error);
      });
  });
}
