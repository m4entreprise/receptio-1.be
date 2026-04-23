import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './i18n';
import './index.css';

const apiUrl = (import.meta.env.VITE_API_URL || '').trim();

if (apiUrl) {
  axios.defaults.baseURL = apiUrl.replace(/\/$/, '');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
