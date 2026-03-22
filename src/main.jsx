// Entry — mounts the real, interactive Warehouse Digital Twin app.
// (The original wireframe-gallery prototype lives in _design_bundle/ for
// reference; wf-primitives.jsx is kept for its shared visual atoms.)
import React from 'react';
import ReactDOM from 'react-dom/client';
import { StoreProvider } from './store.jsx';
import App from './app/App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
