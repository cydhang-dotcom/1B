/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 第 5 步附件的上传：**选完文件直接调接口**，成功后只拿 `{ fileUuid, fileName }` 回来。
 *
 * 调用方（BasicInfoSection / RecordModal / AuthorizationSection 三处选文件的地方）拿到
 * `FileAttachment[]` 后自己塞进表单；失败抛出来的都是能直接给用户看的中文提示，
 * 各处的做法一致：toast 出来、**不往表单里加这一行**（半截的附件比没有更糟）。
 *
 * 端点从 config/api.ts 读（只有 React 这一层读 env），拼地址与请求本身在
 * `src/utils/fileUpload.ts`；本文件只负责「读端点 + 上传 + 组行」。
 */

import { useCallback, useState } from 'react';
import { FILE_UPLOAD_HOST, FILE_UPLOAD_PATH } from '../../config/api';
import { uploadFileTo, type FileUploadEndpoint } from '../../utils/fileUpload';
import { uid } from './defaultData';
import { attachmentFromUpload } from './attachments';
import type { FileAttachment } from './types';

const ENDPOINT: FileUploadEndpoint = { host: FILE_UPLOAD_HOST, path: FILE_UPLOAD_PATH };

export interface AttachmentUploader {
  /** 在途：选文件的按钮 / 拖拽区据此置灰，避免同一份文件连点传两遍 */
  isUploading: boolean;
  /**
   * 逐个上传选中的文件（多选时按选择顺序）。**串行**：并发上传会让「谁先回来」变得不确定，
   * 附件列表的先后顺序就跟着乱；这里的文件最多几份，慢一点换顺序稳定。
   * 失败时抛出带中文提示的 Error，调用方决定怎么显示（已经传上去的那几个要不要留，
   * 由调用方按当前 `attachments` 自己判断 —— 这里不回滚）。
   */
  upload: (files: FileList | File[] | null, slot?: string) => Promise<FileAttachment[]>;
};

export const useAttachmentUpload = (): AttachmentUploader => {
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(async (files: FileList | File[] | null, slot?: string) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return [];

    setIsUploading(true);
    try {
      const uploaded: FileAttachment[] = [];
      for (const file of list) {
        const result = await uploadFileTo(ENDPOINT, file);
        uploaded.push(attachmentFromUpload(result, file, uid(), slot));
      }
      return uploaded;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { isUploading, upload };
};
