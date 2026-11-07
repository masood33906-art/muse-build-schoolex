import { hydrationPromise } from './utils/storage'; // SchoolEx: installs the backend sync shim before the app loads
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

navigator.storage?.persist?.();

// Fix P1-1: deterministic startup. The first render waits until backend
// hydration has been applied to localStorage, so App's state initializers
// read the server's copy instead of racing it. The timeout keeps the app
// opening (on the localStorage fallback) if the backend is unreachable —
// offline-first behaviour is unchanged.
const HYDRATION_TIMEOUT_MS = 3000;

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

let rendered = false;
const renderOnce = () => {
  if (rendered) return;
  rendered = true;
  renderApp();
};
void hydrationPromise.then(renderOnce);
setTimeout(renderOnce, HYDRATION_TIMEOUT_MS);
