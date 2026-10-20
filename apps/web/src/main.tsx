import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@theme/theme.css';
import './shared/shell.css';
import './shared/components.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
