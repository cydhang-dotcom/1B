/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 附件的**纯逻辑**：上传结果怎么收成一行附件、存档里读回来的附件怎么收口。
 *
 * 请求部分（谁去上传、loading）在 `useAttachmentUpload.ts`；这里不 import config/api.ts
 * （那个文件读 import.meta.env，只有 Vite 提供），所以 scripts/ 下的 tsx 自检能直接引它。
 *
 * 附件不存文件内容、也不存地址：只留 `{ fileUuid, fileName, size, type, slot }`，
 * 要显示时用全局工具 `fileUrlOf(fileUuid)` 现拼（`src/utils/fileUrl.ts`）。
 */

import type { UploadedFile } from '../../utils/fileUpload';
import type { FileAttachment, RegistrationFullForm } from './types';

/** 本地文件里我们真正用得上的三样（File 也是这个形状，测试里不必造真的 File） */
export interface LocalFileLike {
  name: string;
  size: number;
  type: string;
}

/**
 * 上传成功 → 一行附件。`id` 是本地行 key（`uid()`），与 `fileUuid` 无关：
 * 同一个文件重新上传会换一个 fileUuid，行 key 也不该复用。
 * 服务端没回文件名就用本地那个（展示总得有个名字）。
 */
export const attachmentFromUpload = (
  uploaded: UploadedFile,
  file: LocalFileLike,
  id: string,
  slot?: string
): FileAttachment => ({
  id,
  fileUuid: uploaded.fileUuid,
  fileName: uploaded.fileName || file.name,
  size: file.size,
  type: file.type || 'application/octet-stream',
  ...(slot ? { slot } : {}),
});

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * 存档里读回来的一行附件收口：tsconfig 没开 strict，存档又可能来自旧版本或被手改过。
 *
 * **没有 `fileUuid` 的一律丢掉**（返回 null）：旧版本存的是 dataURL（本地文件内容），
 * 服务端并不知道那些文件，留着只会渲染出裂图和上不去的附件 —— 也不能拿它去提交。
 */
export const sanitizeAttachment = (value: unknown): FileAttachment | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const fileUuid = textOf(raw.fileUuid).trim();
  if (fileUuid === '') return null;

  const id = textOf(raw.id).trim();
  const slot = textOf(raw.slot).trim();
  const size = typeof raw.size === 'number' && Number.isFinite(raw.size) ? raw.size : 0;

  return {
    id: id || `file-${fileUuid}`,
    fileUuid,
    fileName: textOf(raw.fileName).trim(),
    size,
    type: textOf(raw.type).trim() || 'application/octet-stream',
    ...(slot ? { slot } : {}),
  };
};

/** 一组附件的收口：不是数组当空数组，逐项过 sanitizeAttachment（坏的丢掉） */
export const sanitizeAttachments = (value: unknown): FileAttachment[] =>
  Array.isArray(value)
    ? value.map(sanitizeAttachment).filter((item): item is FileAttachment => item !== null)
    : [];

/**
 * 整份申报表里的附件全过一遍收口：basic 的场地证明、股东附件、人员附件、
 * 委托书附件、确认页附件。草稿读回来时调（见 RegistrationDetailsStep）。
 */
export const sanitizeFormAttachments = (form: RegistrationFullForm): RegistrationFullForm => ({
  ...form,
  basic: {
    ...form.basic,
    regFiles: sanitizeAttachments(form.basic?.regFiles),
    workFiles: sanitizeAttachments(form.basic?.workFiles),
  },
  shareholders: (form.shareholders ?? []).map((item) => ({
    ...item,
    files: sanitizeAttachments(item.files),
  })),
  people: Object.fromEntries(
    Object.entries(form.people ?? {}).map(([key, person]) => [
      key,
      { ...person, files: sanitizeAttachments(person?.files) },
    ])
  ),
  authorization: { ...form.authorization, files: sanitizeAttachments(form.authorization?.files) },
  confirm: { ...form.confirm, files: sanitizeAttachments(form.confirm?.files) },
});
