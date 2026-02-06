import React from 'react';
import ReactDOM from 'react-dom/client';
import { ComputeKitProvider } from '@computekit/react';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ComputeKitProvider options={{ maxWorkers: 4, debug: true, timeout: 60000 }}>
      <App />
    </ComputeKitProvider>
  </React.StrictMode>
);
