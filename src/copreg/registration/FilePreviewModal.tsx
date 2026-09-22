/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileAttachment } from './types';
import { formatSize } from './defaultData';
import { fileUrlOf } from '../../utils/fileUrl';
import { X, Download, FileText, ExternalLink } from 'lucide-react';

interface FilePreviewModalProps {
  file: FileAttachment;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  // 表单里只存 fileUuid：地址现拼（空串 = 这个附件没有可用地址，下面按「打不开」处理）
  const url = fileUrlOf(file.fileUuid);
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.fileName.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-sm font-bold text-slate-800 truncate max-w-md">
              {file.fileName || '附件'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              文件大小：{formatSize(file.size)} · 格式：{file.type || '未指定'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex items-center justify-center min-h-[280px] bg-slate-50/50">
          {isImage && url ? (
            <img
              src={url}
              alt={file.fileName || '附件'}
              className="max-w-full max-h-[55vh] object-contain rounded-xl border border-slate-200 shadow-2xs"
            />
          ) : isPdf ? (
            <div className="w-full h-[55vh] bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
              <FileText className="w-12 h-12 text-[#36B39E] mb-3" />
              <h3 className="text-sm font-bold text-slate-800 mb-1">{file.fileName || '附件'}</h3>
              <p className="text-xs text-slate-500 mb-4">PDF 格式电子凭证扫描件</p>
              <a
                href={url || undefined}
                target="_blank"
                rel="noreferrer"
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm ${
                  url ? 'bg-[#36B39E] hover:bg-[#2AA894] text-white' : 'bg-slate-200 text-slate-400 pointer-events-none'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>在新窗口打开</span>
              </a>
            </div>
          ) : (
            <div className="text-center p-8">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 mb-4">该格式不支持网页直接预览</p>
              <a
                href={url || undefined}
                target="_blank"
                rel="noreferrer"
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm ${
                  url ? 'bg-[#36B39E] hover:bg-[#2AA894] text-white' : 'bg-slate-200 text-slate-400 pointer-events-none'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>在新窗口打开</span>
              </a>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-white flex justify-between items-center">
          <a
            href={url || undefined}
            target="_blank"
            rel="noreferrer"
            className={`text-xs font-semibold inline-flex items-center gap-1 ${
              url ? 'text-[#1D6C5E] hover:underline' : 'text-slate-300 pointer-events-none'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>在新窗口打开 / 下载</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
