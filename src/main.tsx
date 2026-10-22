import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/merriweather-sans/300.css';
import '@fontsource/merriweather-sans/700.css';
import '@fontsource/merriweather-sans/800.css';
import '@fontsource-variable/dm-sans';
import './styles/app.css';
import App from './App';
import './styles/design-pass.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
