import { encode } from 'uqr';

/**
 * code_url → SVG path。
 *
 * 这里是全模块唯一 import 二维码库的地方，换库只动这一个文件。
 * 用 encode() 拿二维布尔矩阵而不是 renderSVG()：自己折成 <path d> 之后，
 * 组件用普通 JSX 渲染就行，不必碰 dangerouslySetInnerHTML。
 *
 * 入参必须是 decodeCodeUrl() 处理过的原始串（见 model.ts）——
 * 给二维码编码时不要再 encodeURIComponent，那会产出扫不出来的码。
 */

/**
 * 静默区（四周留白）宽度，单位是模块数。微信要求至少 4，别调小：
 * 没有静默区的二维码很多手机扫不出来。
 */
export const QR_BORDER = 4;

/** 纠错级别 M：能挡住约 15% 污损，扫码场景的常规选择 */
const QR_ECC = 'M';

export type QrPath = {
  /** SVG path 的 d 属性，坐标系是 [0,size] × [0,size] */
  path: string;
  /** 含静默区的边长（模块数），拿它当 viewBox 的宽高 */
  size: number;
};

/** 把二维矩阵折成一个 path：逐行合并连续的深色模块，减少节点数 */
const matrixToPath = (data: boolean[][]): string => {
  const parts: string[] = [];
  data.forEach((row, y) => {
    let run = 0;
    row.forEach((dark, x) => {
      if (dark) {
        run += 1;
        return;
      }
      if (run) parts.push(`M${x - run} ${y}h${run}v1h-${run}z`);
      run = 0;
    });
    if (run) parts.push(`M${row.length - run} ${y}h${run}v1h-${run}z`);
  });
  return parts.join('');
};

/**
 * 把一段文本编码成二维码。文本为空时返回 null —— 调用方要么别渲染，
 * 要么退回到错误态，绝不能渲染一个空白方块让用户对着扫。
 */
export const qrPath = (text: string, border: number = QR_BORDER): QrPath | null => {
  const raw = text.trim();
  if (!raw) return null;
  const { data, size } = encode(raw, { ecc: QR_ECC, border });
  return { path: matrixToPath(data), size };
};
