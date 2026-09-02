import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AppProvider } from './contexts/AppContext.tsx'
import './index.css'

// Global fetch timeout interceptor to prevent API calls from hanging when WiFi is on but server is unreachable
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
    
    if (url && (url.includes('/api/') || url.includes('/rpc/'))) {
      // Respect existing abort signals (like in full sync or ping checks)
      if (init?.signal) {
        return originalFetch(input, init);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`[FETCH TIMEOUT] Aborting fetch to: ${url} (unreachable server)`);
        controller.abort();
      }, 3000);
      
      return originalFetch(input, { ...init, signal: controller.signal }).then(
        (response) => {
          clearTimeout(timeoutId);
          return response;
        },
        (error) => {
          clearTimeout(timeoutId);
          throw error;
        }
      );
    }
    return originalFetch(input, init);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
)


