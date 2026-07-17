import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { UIProvider } from './contexts/UIContext.jsx'

// Global fetch interceptor to handle API requests dynamically
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  if (typeof input === 'string' && input.startsWith('http://localhost:8080/api')) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) {
      input = input.replace('http://localhost:8080/api', 'https://api-bkw.walisongosragen.com/api');
    }
  } else if (input instanceof Request && input.url.startsWith('http://localhost:8080/api')) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) {
      const newUrl = input.url.replace('http://localhost:8080/api', 'https://api-bkw.walisongosragen.com/api');
      input = new Request(newUrl, input);
    }
  }
  return originalFetch.call(this, input, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <UIProvider>
        <App />
      </UIProvider>
    </ThemeProvider>
  </StrictMode>,
)
