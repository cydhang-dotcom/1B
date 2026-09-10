import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import RegistrationApp from './registration/RegistrationApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RegistrationApp />
  </StrictMode>,
);
