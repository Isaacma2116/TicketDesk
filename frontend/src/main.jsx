import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/organization.css';
import './styles/config.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
