import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google';

const PROVIDER = import.meta.env.VITE_OAUTH_PROVIDER || 'firebase';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const AppTree = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  PROVIDER === 'google' ? (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      {AppTree}
    </GoogleOAuthProvider>
  ) : (
    AppTree
  )
);
