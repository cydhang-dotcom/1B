/**
 * 服务人员查看页的入口（`copreg-view.html`）。
 *
 * 与客户主流程 `copreg.html`（`src/copreg.tsx`）**完全分开**：这一页只有一个只读视图，
 * 不建主体、不读本地存档、不参与步骤路由 —— 服务人员的浏览器里没有客户那份 localStorage，
 * 混进主流程只会造出一份假申请。
 *
 * 地址栏：`copreg-view.html?scbUuid=<开户单编号>[&code=<查看码>]`（`uuid` 也认，见 serviceView.ts）。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ServiceRecordView } from './copreg/components/ServiceRecordView';
import { serviceViewQueryOf } from './copreg/serviceView';
// copreg 原型是纯 Tailwind 实现（工具类 + index.css 的 CSS 变量），这一页沿用同一套样式入口。
import './copreg/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServiceRecordView query={serviceViewQueryOf(window.location.search)} />
  </StrictMode>,
);
