/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 《企业商事设立规划与财税合规评估报告》的两个出口（迁移自参考实现
 * cydhang-dotcom/copreg 的 `utils/exportPdf.ts`）：
 *
 *   1. `exportProposalToPdf`：把文档本体塞进离屏容器 → html2canvas 光栅化 → jsPDF 按 A4 分页
 *      → 直接下载 PDF；
 *   2. `printProposalReport`：同一份文档拼成独立 HTML，交给 `printHtmlDocument`（隐藏 iframe）
 *      打印 —— **只印这份报告**，不会把导航、套餐卡、加购项一起印出来。
 *
 * 分页与页边距（修掉「每页没边距、一行字被拦腰切断」）：
 *   - 每页四边留 `PDF_PAGE_MARGIN_MM`（页边距由 jsPDF 加，正文不再自带内边距，避免双重留白）；
 *   - 不再把一张长图按页高硬切，而是按页切成若干张小图：理想切点落在正文中间时，
 *     往上找最近的**空白行**切在那里（`proposalPdfPages.planPdfPages`），宁可这页短一点也不切字；
 *   - 分页算法是纯函数，离线自检见 `scripts/check-proposal-report-doc.ts`。
 *
 * `html2canvas` / `jspdf` 合计几百 KB，改为**动态 import**：不点「存为 PDF」的人不会把它们
 * 打进首包，主 chunk 不受影响。
 */

import { printHtmlDocument } from '../utils/printDocument';
import { PDF_PAGE_MARGIN_MM, pdfPageGeometry, planPdfPages } from './proposalPdfPages';
import {
  buildProposalReportBody,
  buildProposalReportDocument,
  proposalReportFileName,
  type ProposalReportInput,
} from './proposalReportDoc';

/** 离屏渲染宽度：96 DPI 下的 A4 标称宽度；高度按内容自然增长 */
const A4_WIDTH_PX = 794;
const JPEG_QUALITY = 0.92;
/** 空白行判定：三个通道都 ≥ 这个值才算「白」 */
const BLANK_ROW_MIN_CHANNEL = 245;
/** 一次取多少行像素做空白判定（缓存，避免逐行 getImageData 把导出拖慢） */
const BLANK_ROW_CACHE_ROWS = 500;

/**
 * 造一个「第 y 行是不是全白」的判定函数：按窗口批量取像素并缓存。
 * 只按每 4 个像素采样一次，够判断有没有文字，又不至于逐像素太慢。
 */
const blankRowDetector = (context: CanvasRenderingContext2D, width: number, height: number) => {
  let cacheFrom = -1;
  let cacheTo = -1;
  let cache: Uint8ClampedArray | null = null;

  return (y: number): boolean => {
    if (cache === null || y < cacheFrom || y >= cacheTo) {
      cacheFrom = Math.max(0, y - (BLANK_ROW_CACHE_ROWS - 1));
      cacheTo = Math.min(height, cacheFrom + BLANK_ROW_CACHE_ROWS);
      cache = context.getImageData(0, cacheFrom, width, cacheTo - cacheFrom).data;
    }

    const base = (y - cacheFrom) * width * 4;
    for (let x = 0; x < width; x += 4) {
      const i = base + x * 4;
      if (
        cache[i] < BLANK_ROW_MIN_CHANNEL ||
        cache[i + 1] < BLANK_ROW_MIN_CHANNEL ||
        cache[i + 2] < BLANK_ROW_MIN_CHANNEL
      ) {
        return false;
      }
    }
    return true;
  };
};

/**
 * 存为 PDF。失败时抛错，由调用方决定提示与是否回落到打印。
 */
export const exportProposalToPdf = async (input: ProposalReportInput): Promise<void> => {
  const [html2canvasModule, jspdfModule] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const html2canvas = html2canvasModule.default;
  const { jsPDF } = jspdfModule;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '0';
  container.style.width = `${A4_WIDTH_PX}px`;
  container.style.backgroundColor = '#FFFFFF';
  container.style.zIndex = '-999';
  // 页边距交给 jsPDF：正文不自带内边距，PDF 四边才有真正的留白
  container.innerHTML = buildProposalReportBody(input, { pagePadding: false });
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      windowWidth: A4_WIDTH_PX,
    });

    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法读取报告画布上下文');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const geometry = pdfPageGeometry(
      canvas.width,
      pdf.internal.pageSize.getWidth(),
      pdf.internal.pageSize.getHeight(),
      PDF_PAGE_MARGIN_MM
    );

    const slices = planPdfPages(canvas.width, canvas.height, geometry, blankRowDetector(context, canvas.width, canvas.height));

    slices.forEach((slice, index) => {
      // 每页单独切一张小图：切点已经在空白行上，不会把一行字切成两半
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = slice.height;
      const pageContext = pageCanvas.getContext('2d');
      if (!pageContext) throw new Error('无法创建分页画布');
      pageContext.fillStyle = '#FFFFFF';
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(
        canvas,
        0,
        slice.top,
        canvas.width,
        slice.height,
        0,
        0,
        canvas.width,
        slice.height
      );

      const imgData = pageCanvas.toDataURL('image/jpeg', JPEG_QUALITY);
      if (index > 0) pdf.addPage();
      pdf.addImage(
        imgData,
        'JPEG',
        geometry.marginMm,
        geometry.marginMm,
        geometry.contentWidthMm,
        slice.height * geometry.mmPerPx
      );
    });

    pdf.save(proposalReportFileName(input.plan.companyNameProposal || input.survey.companyDesc));
  } finally {
    container.remove();
  }
};

/**
 * 打印报告：只印这份评估报告（隐藏 iframe），不影响页面上其它打印入口。
 * `onReady` 在文档加载完、真正发起打印前回调，调用方据此提示。
 */
export const printProposalReport = (input: ProposalReportInput, onReady?: () => void): void => {
  printHtmlDocument(buildProposalReportDocument(input), onReady);
};
