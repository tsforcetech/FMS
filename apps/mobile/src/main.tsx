import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createFirebase } from '@admin/firebase';
import { ToastProvider } from '@admin/ui/kit';
import '@admin/theme.css';
import '@staff/staff.css';
import './mobile.css';
import { I18nProvider } from '@staff/i18n';
import MobileApp from './App';

async function start() {
  const root = createRoot(document.getElementById('root')!);
  try {
    const services = createFirebase();
    await services.ready;
    root.render(
      <StrictMode>
        <I18nProvider>
          <ToastProvider>
            <MobileApp services={services} />
          </ToastProvider>
        </I18nProvider>
      </StrictMode>,
    );
  } catch {
    root.render(
      <div className="s-center">
        <h1>FacilityOS</h1>
        <p>This build is not connected to Firebase.</p>
      </div>,
    );
  }
}
void start();
