import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// The theme names IBM Plex Sans Thai / IBM Plex Mono (mock's token --font-sans / --font-mono). The files are served by
// this app, never fetched from Google Fonts: an external render-blocking stylesheet can leave every page blank on an
// on-premise network that drops the request (docs/qa/nfr002-load-run-2026-11-23.md). Weights = the old Google link.
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/500.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@theme/theme.css';
import './shared/shell.css';
import './shared/components.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
