import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// Production: point API calls at the Cloudflare Worker.
// In development the Worker runs locally or via tunnel — set VITE_API_BASE
// and Vite's import.meta.env picks it up.
setBaseUrl(
  import.meta.env.VITE_API_BASE || 'https://api.agsynergy.ca',
);

createRoot(document.getElementById('root')!).render(<App />);
