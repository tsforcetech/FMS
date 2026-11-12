import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createFirebase } from './firebase';
import { Message } from '@facilityos/ui';
import './styles.css';
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="center-state">
        <Message title="The workspace could not open" error>
          <p>
            Please reload the page. If this continues, contact your
            administrator.
          </p>
          <button className="btn section-gap" onClick={() => location.reload()}>
            Reload
          </button>
        </Message>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Setup() {
  return (
    <div className="center-state">
      <Message title="FacilityOS setup required">
        <p>
          This workspace has not been connected to Firebase. Configure the
          selected environment using the repository setup guide, then restart
          the application.
        </p>
        <p>No company data has been loaded.</p>
      </Message>
    </div>
  );
}
async function start() {
  let content: ReactNode;
  try {
    const services = createFirebase();
    await services.ready;
    content = <App services={services} />;
  } catch {
    content = <Setup />;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Boundary>{content}</Boundary>
    </StrictMode>,
  );
}
void start();
