/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PDF 分页规划（纯函数，`scripts/check-proposal-report-doc.ts` 离线自检）。
 *
 * 之前「存为 PDF」的做法是：把整份报告光栅化成**一张很长的图**，再按 A4 高度硬切 ——
 * 切点落在哪一行完全看运气，于是每页上下没有页边距、还经常把一行字拦腰切断。
 *
 * 这里把「切在哪」独立出来：
 *   - 每页只放 `pageContentHeightPx`（= A4 高度减去上下页边距换成的像素），页边距由 jsPDF 负责；
 *   - 理想切点若落在正文中间，就**往上找最近的空白行**（整行都是白的）切在那里，
 *     宁可这一页短一点，也不把一行字切成两半；
 *   - 最多回退 `maxBacktrackRatio` 的页高；实在找不到空白行（例如整页都是表格边框）才按理想切点切。
 */

/** A4 页边距（毫米）：四边一致，与打印文档里的 42/48px 内边距观感接近 */
export const PDF_PAGE_MARGIN_MM = 12;

export interface PdfPageGeometry {
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  /** 可用内容宽度（毫米）= 页宽 - 左右边距 */
  contentWidthMm: number;
  /** 可用内容高度（毫米）= 页高 - 上下边距 */
  contentHeightMm: number;
  /** 每页可放的内容高度换算到画布像素 */
  pageContentHeightPx: number;
  /** 毫米 / 像素（画布按 contentWidthMm 铺满时） */
  mmPerPx: number;
}

/** 由画布宽度与 A4 尺寸推出每页几何（画布宽度决定缩放比） */
export const pdfPageGeometry = (
  canvasWidthPx: number,
  pageWidthMm: number,
  pageHeightMm: number,
  marginMm: number = PDF_PAGE_MARGIN_MM,
): PdfPageGeometry => {
  const contentWidthMm = pageWidthMm - marginMm * 2;
  const contentHeightMm = pageHeightMm - marginMm * 2;
  const mmPerPx = canvasWidthPx > 0 ? contentWidthMm / canvasWidthPx : 0;
  const pageContentHeightPx = mmPerPx > 0 ? Math.max(1, Math.floor(contentHeightMm / mmPerPx)) : 1;
  return { pageWidthMm, pageHeightMm, marginMm, contentWidthMm, contentHeightMm, pageContentHeightPx, mmPerPx };
};

/** 一页对应画布上的一段：从 `top` 开始的 `height` 像素 */
export interface PdfPageSlice {
  top: number;
  height: number;
}

export interface PlanPdfPagesOptions {
  /** 允许往上找空白行的最大回退比例（默认 0.4 = 最多把这一页缩到 60% 高） */
  maxBacktrackRatio?: number;
}

/**
 * 规划分页切点。`isBlankRow(y)` 由调用方注入（真实实现读画布像素，自检传假函数）。
 * 返回的切片首尾相接、覆盖整张画布；除最后一页外，长度都不超过 `pageContentHeightPx`。
 */
export const planPdfPages = (
  canvasWidth: number,
  canvasHeight: number,
  geometry: PdfPageGeometry,
  isBlankRow: (y: number) => boolean,
  options: PlanPdfPagesOptions = {},
): PdfPageSlice[] => {
  if (canvasWidth <= 0 || canvasHeight <= 0) return [];

  const maxBacktrack = Math.max(0, Math.floor(geometry.pageContentHeightPx * (options.maxBacktrackRatio ?? 0.4)));
  const slices: PdfPageSlice[] = [];
  let top = 0;

  while (top < canvasHeight) {
    const idealEnd = Math.min(top + geometry.pageContentHeightPx, canvasHeight);
    let end = idealEnd;

    // 还有下一页时才需要避让：最后一页直接放到末尾
    if (idealEnd < canvasHeight) {
      const minEnd = Math.max(top + 1, idealEnd - maxBacktrack);
      for (let y = idealEnd - 1; y >= minEnd; y -= 1) {
        if (isBlankRow(y)) {
          end = y + 1;
          break;
        }
      }
      if (end <= top) end = idealEnd;
    }

    slices.push({ top, height: end - top });
    top = end;
  }

  return slices;
};
