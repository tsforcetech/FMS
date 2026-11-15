import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createFirebase } from '@admin/firebase';
import { ToastProvider } from '@admin/ui/kit';
import '@admin/theme.css';
import './platform.css';
import App from './App';

async function start() {
  let content: ReactNode;
  try {
    const services = createFirebase();
    await services.ready;
    content = <App services={services} />;
  } catch {
    content = (
      <div className="center-state">
        <h1>Setup required</h1>
        <p>The platform console is not connected yet.</p>
      </div>
    );
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ToastProvider>{content}</ToastProvider>
    </StrictMode>,
  );
}
void start();
