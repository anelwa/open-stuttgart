import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/merriweather-sans/300.css';
import '@fontsource/merriweather-sans/700.css';
import '@fontsource/merriweather-sans/800.css';
import '@fontsource-variable/dm-sans';
import './styles/app.css';
import App from './App';
import './styles/design-pass.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* Offline-Hülle optional */ }); });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
