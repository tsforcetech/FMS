import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createFirebase } from '@admin/firebase';
import { ToastProvider } from '@admin/ui/kit';
import '@admin/theme.css';
import '@staff/staff.css';
import './customer.css';
import App from './App';

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="s-center">
        <h1>Something went wrong</h1>
        <p>Please reload the page.</p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => location.reload()}
        >
          Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
async function start() {
  let content: ReactNode;
  try {
    const services = createFirebase();
    await services.ready;
    content = <App services={services} />;
  } catch {
    content = (
      <div className="s-center">
        <h1>Setup required</h1>
        <p>This customer portal is not connected yet.</p>
      </div>
    );
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Boundary>
        <ToastProvider>{content}</ToastProvider>
      </Boundary>
    </StrictMode>,
  );
}
void start();
