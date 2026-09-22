/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **全局工具函数：`fileUrlOf(fileUuid)`** —— 拿到上传接口返回的 `fileUuid`，
 * 就调它出图片 / 附件的可访问地址（拼法本体见 `docUuidUrl.ts`，host 取 `VITE_DOC_HOST`）。
 *
 * 用法：`#fill-details` 里所有附件都只存 `{ fileUuid, fileName }`，要显示或下载时现拼地址，
 * 不把地址（更不把文件内容）存进表单 —— 存地址会过期、存 dataURL 会把 localStorage 撑爆。
 * 拿不到 fileUuid（空串 / undefined）时返回空串，调用方按「没有地址」处理。
 */

import { DOC_HOST } from '../config/api';
import { docUuidUrl } from './docUuidUrl';

export const fileUrlOf = (fileUuid?: string | null): string => docUuidUrl(DOC_HOST, fileUuid);
