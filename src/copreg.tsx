import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import CopregApp from './copreg/App.tsx';
// copreg 原型是纯 Tailwind 实现（工具类 + index.css 的 CSS 变量），
// 与 registration 页不同，这里必须连同 Tailwind 一起引入。
import './copreg/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CopregApp />
  </StrictMode>,
);
