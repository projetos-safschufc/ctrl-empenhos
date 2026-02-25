import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<p style="padding:20px;color:red">Elemento #root não encontrado.</p>';
} else {
  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    rootEl.innerHTML = `<div style="padding:24px;font-family:sans-serif;max-width:480px"><h2 style="color:#c53030">Erro ao iniciar</h2><pre style="background:#f7fafc;padding:12px;overflow:auto">${msg}</pre></div>`;
    console.error(err);
  }
}
