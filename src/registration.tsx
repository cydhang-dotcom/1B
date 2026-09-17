import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import RegistrationApp from './registration/RegistrationApp.tsx';
// 只引原型样式表，不引 index.css：本页已经全部改用原型的类名，
// 而 Tailwind 的 preflight 会把原型依赖的浏览器默认样式（例如 p 的上下边距）抹平。
import './registration/design.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RegistrationApp />
  </StrictMode>,
);
