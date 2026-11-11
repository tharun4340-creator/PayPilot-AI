import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { SystemProvider } from './context/SystemContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ToastProvider>
          <SystemProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </SystemProvider>
        </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
