import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('error', (e) => {
  const errDiv = document.createElement('div');
  errDiv.style.cssText = 'color:red; background:#fff; padding:10px; position:absolute; top:0; z-index:9999; width:100%; word-break:break-all;';
  errDiv.innerHTML = `Error: ${e.message} <br> ${e.filename}:${e.lineno} <br> ${e.error?.stack || ''}`;
  document.body.appendChild(errDiv);
});
window.addEventListener('unhandledrejection', (e) => {
  const errDiv = document.createElement('div');
  errDiv.style.cssText = 'color:red; background:#fff; padding:10px; position:absolute; top:0; z-index:9999; width:100%; word-break:break-all;';
  errDiv.innerHTML = `Promise Error: ${e.reason ? e.reason.stack || e.reason : 'Unknown reason'}`;
  document.body.appendChild(errDiv);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
