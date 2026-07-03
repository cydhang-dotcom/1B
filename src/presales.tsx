import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import PresalesApp from './PresalesApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PresalesApp />
  </StrictMode>,
);
