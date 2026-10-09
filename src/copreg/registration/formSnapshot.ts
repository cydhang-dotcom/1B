/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 申报表快照的**读回收口**（纯逻辑，不碰 DOM / 不读 import.meta.env，可被 tsx 自检直接引）。
 *
 * 同一份形状现在有两个读的地方：
 *   1. 填报页读自己写进 localStorage 的那份草稿（`RegistrationDetailsStep` 的 useState 初值）；
 *   2. 服务人员查看页读接口给的 `openAccApply.var2`（见 `src/copreg/serviceView.ts`）。
 *
 * 一份快照可能来自旧版本、被手改过、或缺少后加的字段（老做法只检查 basic/people 存在，
 * 缺 `basic.scope` 的残缺草稿会在校验里 `.trim()` 崩掉整页）。合并规则只写一遍：
 * **空骨架打底 + 存档覆盖 + 后加字段补默认值 + 附件逐项收口**，两处共用，免得各自演化。
 *
 * 认不出（不是对象 / 没有 basic / 没有 people）返回 `null`，由调用方决定兜底：
 * 填报页回落「按前几步重新生成一份」，查看页回落一句人话错误。
 */

import { createBlankForm } from './defaultData';
import { sanitizeFormAttachments } from './attachments';
import {
  DEFAULT_REG_ADDRESS_NATURE,
  DEFAULT_WORK_ADDRESS_NATURE,
  normalizeAddressNature,
} from './addressNatureHints';
import type { RegistrationFullForm } from './types';

export const normalizeRegistrationForm = (raw: unknown): RegistrationFullForm | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const parsed = raw as Partial<RegistrationFullForm>;
  // basic / people 是「这份快照到底是不是申报表」的最小判据（其余字段旧版本可能没有）
  if (!parsed.basic || !parsed.people) return null;

  const blank = createBlankForm();
  const next: RegistrationFullForm = {
    ...blank,
    ...parsed,
    basic: { ...blank.basic, ...parsed.basic },
    setup: { ...blank.setup, ...(parsed.setup ?? {}) },
    authorization: { ...blank.authorization, ...(parsed.authorization ?? {}) },
    confirm: { ...blank.confirm, ...(parsed.confirm ?? {}) },
  };

  // 老存档里没有的几项结构默认值（与迁移前的口径一致）
  if (!next.basic.board) next.basic.board = '不设董事会';
  if (!next.basic.singleDirector) next.basic.singleDirector = '由总经理代行职务（不设董事）';
  if (next.basic.unanimous === undefined || next.basic.unanimous === null) next.basic.unanimous = true;
  // 两个地址的性质 2026-10-08 起是**同一套**（租赁用房 / 自有房产 / 无偿使用证明），且当天又下架了
  // 「集中办公·众创空间 / 园区孵化器」两档：
  //   同义老值平移（商业租赁 → 租赁用房、自有产权 → 自有房产），
  //   **已下架那几档（含居家办公申报）留空让用户重选** —— 性质决定要传哪些场地材料，
  //   替他猜一个等于猜错材料。本来就没填的才算「该给默认值」。
  const rawRegNature = typeof next.basic.regAddressNature === 'string' ? next.basic.regAddressNature : '';
  next.basic.regAddressNature =
    rawRegNature.trim() === '' ? DEFAULT_REG_ADDRESS_NATURE : normalizeAddressNature(rawRegNature);
  const rawWorkNature = typeof next.basic.workAddressNature === 'string' ? next.basic.workAddressNature : '';
  next.basic.workAddressNature =
    rawWorkNature.trim() === '' ? DEFAULT_WORK_ADDRESS_NATURE : normalizeAddressNature(rawWorkNature);

  // 附件逐项收口：旧版本存档里存的是 dataURL（本地文件内容），服务端并不知道那些文件，
  // 现在只认上传接口给过 fileUuid 的附件 —— 没有的丢掉，免得渲染出裂图、提交上空附件
  return sanitizeFormAttachments(next);
};

/**
 * 从快照里解析「已经提交」的事实。
 * **以快照自己写的 status 为准**：`savaType`（0 草稿 / 1 提交）是接口入参，
 * 快照里的 `status` 才是用户点过「确认并提交申请」留下的痕迹。
 */
export const isSubmittedSnapshot = (form: RegistrationFullForm | null): boolean =>
  form !== null && form.status === 'submitted';
