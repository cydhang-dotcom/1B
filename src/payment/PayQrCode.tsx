import { useMemo } from 'react';

import type { QrSource } from './model';
import { qrPath } from './qrcode';

/**
 * 支付二维码。**刻意不带任何样式**：不 import css、不写一个 Tailwind 类名，
 * 只把类名原样透传给调用方。这样同一份组件能挂到 Tailwind 页面，
 * 也能挂到 design.css 的注册页——两套样式体系在本仓库是严格隔离的。
 *
 * 两条外观要求（改样式时别破坏）：
 *   1. 必须是深色模块 + 浅色底，且四周留静默区。深色主题下不要直接
 *      给成 text-white/背景深色，微信会扫不出来。
 *   2. shape-rendering="crispEdges" 不能去掉 —— 缩放时模块边缘一模糊，
 *      小尺寸下就扫不出来。
 *
 * 组件只负责出码，不出任何按钮：「重新生成」「我已完成支付」由调用方写。
 *
 * 文件名必须与 qrcode.ts 拉开距离：macOS 的文件系统大小写不敏感，
 * `import './QrCode'` 会先命中 qrcode.ts（解析扩展名时 .ts 排在 .tsx 前面），
 * 在 Linux 上却能正常解析 —— 那种只在一边坏掉的问题最难查。
 */

export function PayQrCode({
  source,
  className,
  alt = '微信支付二维码',
  title = '微信扫码支付',
}: {
  source: QrSource | null;
  className?: string;
  alt?: string;
  title?: string;
}) {
  const svg = useMemo(() => (source?.kind === 'text' ? qrPath(source.text) : null), [source]);

  if (!source) return null;
  if (source.kind === 'image') return <img src={source.url} alt={alt} className={className} />;
  if (!svg) return null;

  return (
    <svg
      viewBox={`0 0 ${svg.size} ${svg.size}`}
      className={className}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{title}</title>
      <path d={svg.path} fill="currentColor" />
    </svg>
  );
}
