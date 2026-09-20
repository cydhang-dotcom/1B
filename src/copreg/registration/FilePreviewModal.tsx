/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileAttachment } from './types';
import { formatSize } from './defaultData';
import { X, Download, FileText } from 'lucide-react';

interface FilePreviewModalProps {
  file: FileAttachment;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  const isImage = file.type.startsWith('image/') || file.data.startsWith('data:image/');
  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-sm font-bold text-slate-800 truncate max-w-md">
              {file.name}
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
          {isImage ? (
            <img
              src={file.data}
              alt={file.name}
              className="max-w-full max-h-[55vh] object-contain rounded-xl border border-slate-200 shadow-2xs"
            />
          ) : isPdf ? (
            <div className="w-full h-[55vh] bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
              <FileText className="w-12 h-12 text-[#36B39E] mb-3" />
              <h3 className="text-sm font-bold text-slate-800 mb-1">{file.name}</h3>
              <p className="text-xs text-slate-500 mb-4">PDF 格式电子凭证扫描件</p>
              <a
                href={file.data}
                download={file.name}
                className="px-5 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载文件至本地查看</span>
              </a>
            </div>
          ) : (
            <div className="text-center p-8">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 mb-4">该格式不支持网页直接预览</p>
              <a
                href={file.data}
                download={file.name}
                className="px-5 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载文件</span>
              </a>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-white flex justify-between items-center">
          <a
            href={file.data}
            download={file.name}
            className="text-xs font-semibold text-[#1D6C5E] hover:underline inline-flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下载文件</span>
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
