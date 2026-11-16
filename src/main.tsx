import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { captureInstallPrompt } from './guide';

// Ask the browser not to evict our local data under storage pressure.
navigator.storage?.persist?.().catch(() => {});
// Keep Chrome's install prompt so the welcome tour / settings can offer an "Install app" button.
captureInstallPrompt();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
