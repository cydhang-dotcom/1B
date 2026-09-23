/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthorizationData, FileAttachment } from './types';
import { Printer, Download, Upload, Eye, Trash2, Check, FileText } from 'lucide-react';
import { formatSize } from './defaultData';
import { useAttachmentUpload } from './useAttachmentUpload';
import { authorizationLetterFileName, buildAuthorizationLetterHtml } from './authorizationDoc';
import { printHtmlDocument } from '../../utils/printDocument';

interface AuthorizationSectionProps {
  data: AuthorizationData;
  onChange: (data: AuthorizationData) => void;
  onPreviewFile: (file: FileAttachment) => void;
  onToast: (msg: string) => void;
}

export const AuthorizationSection: React.FC<AuthorizationSectionProps> = ({
  data,
  onChange,
  onPreviewFile,
  onToast,
}) => {
  // 选完文件直接上传：拿到 fileUuid 才替掉旧的委托书附件
  const { isUploading, upload } = useAttachmentUpload();

  // 受托人两项**初始化留空、由用户自己填**：不再回落到「联系人」那个人 ——
  // 受托人未必是联系人（要与「一窗通」公章经办人一致），拿别人的名字顶上去只会印错委托书
  const trusteeName = data.trusteeName;
  const trusteeIdNumber = data.trusteeIdNumber;

  const dateVal = data.entrustDate || new Date().toISOString().split('T')[0];
  const [y, m, d] = dateVal.split('-');

  const hasFile = data.files && data.files.length > 0;
  const firstFile = hasFile ? data.files[0] : null;

  /** 选完文件直接上传（`useAttachmentUpload`）：拿到 fileUuid 才替掉旧的委托书附件 */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    try {
      const uploaded = await upload([file]);
      if (uploaded.length > 0) {
        onChange({ ...data, files: [uploaded[0]] });
        onToast('已上传签署完成的委托书！');
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : '附件上传失败，请稍后重试');
    } finally {
      // 同一个文件再选一次也要能触发 onChange
      e.target.value = '';
    }
  };

  const handleRemoveFile = () => {
    onChange({
      ...data,
      files: [],
    });
    onToast('已移除委托书附件');
  };

  const handlePrint = () => {
    // 只打这份委托书：隐藏 iframe 里放同一份 A4 文档（直接 window.print() 会把整页导航、
    // 章节时间线与上传框一起印出来）
    printHtmlDocument(
      buildAuthorizationLetterHtml({ trusteeName, trusteeIdNumber, date: dateVal }),
      () => onToast('已唤起打印程序，请在打印预览中确认委托书内容'),
    );
  };

  const handleDownload = () => {
    const htmlContent = buildAuthorizationLetterHtml({
      trusteeName,
      trusteeIdNumber,
      date: dateVal,
    });

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = authorizationLetterFileName(trusteeName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    onToast('委托书模板已下载，可在浏览器中直接打印或另存为 PDF');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-start justify-between gap-4 mb-6 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <span>法定代表人委托书签署</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              用于公安特行公章刻制及市监局网上申报委托，按以下三步指引完成签署。
            </p>
          </div>
          <span className="text-xs font-bold text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
            05
          </span>
        </div>

        {/* Vertical Timeline */}
        <div className="relative pl-10 space-y-8">
          {/* Step 1: 打印委托书 */}
          <div className="relative">
            {/* Step Node badge */}
            <div className="absolute -left-10 top-0.5 w-7 h-7 rounded-full border-2 border-[#36B39E] bg-white text-[#1D6C5E] font-extrabold text-xs flex items-center justify-center shadow-xs">
              1
            </div>

            {/* Connecting line to node 2 */}
            <div className="absolute -left-[27px] top-8 bottom-[-24px] w-0.5 bg-[#E6F7F2]" />

            <div className="mb-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">第 1 步：生成并打印委托书</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                填写下面的受托人信息后，A4 委托书会同步排版；确认无误再打印或下载。
              </p>
            </div>

            {/* 受托人信息：委托书正文与打印件都取这两项（初始为空，可随时改） */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">受托人姓名</label>
                <input
                  type="text"
                  value={data.trusteeName}
                  maxLength={20}
                  onChange={(e) => onChange({ ...data, trusteeName: e.target.value })}
                  placeholder="请填写受托人姓名"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#36B39E]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">受托人身份证号码</label>
                <input
                  type="text"
                  value={data.trusteeIdNumber}
                  maxLength={18}
                  // 身份证号只可能是数字与结尾的 X：边输边滤，免得打印出来一串怪字符
                  onChange={(e) =>
                    onChange({
                      ...data,
                      trusteeIdNumber: e.target.value.replace(/[^0-9Xx]/g, '').toUpperCase(),
                    })
                  }
                  placeholder="请填写 18 位身份证号码"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#36B39E]"
                />
                <p className="text-[11px] text-slate-400 mt-1">需与「一窗通」公章经办人一致。</p>
              </div>
            </div>

            {/* Paper Presentation Stage */}
            <div className="bg-[#F8FCFB] border border-slate-200/80 rounded-xl p-4 sm:p-5">
              <div className="bg-white border border-slate-200/80 shadow-xs rounded-lg p-5 sm:p-7 max-w-lg mx-auto text-slate-800">
                <h4 className="text-center font-extrabold text-sm sm:text-base tracking-widest text-slate-900 mb-5">
                  法定代表人委托书
                </h4>
                <div className="text-xs leading-relaxed text-justify text-slate-700">
                  兹委托{' '}
                  <span className="border-b border-slate-900 font-bold px-1.5 py-0.5 text-slate-900 inline-block text-center min-w-[60px]">
                    {trusteeName}
                  </span>{' '}
                  （身份证号码：{' '}
                  <span className="border-b border-slate-900 font-bold px-1.5 py-0.5 text-slate-900 inline-block text-center min-w-[130px]">
                    {trusteeIdNumber}
                  </span>{' '}
                  ，注：受托人需与“一窗通”公章经办人一致）代表我公司办理公章刻制业务，受托人在上述事项内所签署的有关文件及提供的手续材料，本委托人均予以承认并承担相应的法律责任。
                </div>

                <div className="mt-6 text-xs text-slate-700">
                  <div className="flex items-center">
                    <span>委托人（法定代表人亲笔签名）：</span>
                    <span className="flex-1 max-w-[160px] border-b border-slate-900 h-4 inline-block ml-1" />
                  </div>
                  <div className="mt-2 text-slate-500 text-[11px]">
                    委托日期：{y} 年 {m} 月 {d} 日
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>直接打印</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>下载模板</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: 签字并盖章 */}
          <div className="relative">
            <div className="absolute -left-10 top-0.5 w-7 h-7 rounded-full border-2 border-[#36B39E] bg-white text-[#1D6C5E] font-extrabold text-xs flex items-center justify-center shadow-xs">
              2
            </div>

            {/* Connecting line to node 3 */}
            <div
              className={`absolute -left-[27px] top-8 bottom-[-24px] w-0.5 transition-colors ${
                hasFile ? 'bg-[#36B39E]' : 'bg-[#E6F7F2]'
              }`}
            />

            <div className="mb-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">第 2 步：法定代表人亲笔签字并盖章</h3>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FCFB] border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-lg shrink-0">✍️</span>
                <span className="text-xs text-slate-700 font-medium">
                  请将打印出的纸质委托书完成亲笔签字（新设企业未制发公章可先免章签名）：
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-0.5 rounded-md bg-white border border-[#2AA894]/30 text-[#1D6C5E] text-xs font-bold">
                  ✓ 亲笔签名
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 text-xs font-medium">
                  新设免章
                </span>
              </div>
            </div>
          </div>

          {/* Step 3: 上传已签署文件 */}
          <div className="relative">
            <div
              className={`absolute -left-10 top-0.5 w-7 h-7 rounded-full border-2 text-xs font-extrabold flex items-center justify-center transition-all ${
                hasFile
                  ? 'bg-[#36B39E] border-[#36B39E] text-white shadow-xs'
                  : 'border-[#36B39E] bg-white text-[#1D6C5E]'
              }`}
            >
              {hasFile ? '✓' : '3'}
            </div>

            <div className="mb-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">第 3 步：上传已签署委托书照片</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                拍摄签字后的纸质委托书原件（需边框完整、字迹清晰、无反光遮挡）
              </p>
            </div>

            {hasFile && firstFile ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-[#E6F7F2] border border-[#2AA894]/30 gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#2AA894]/20 flex items-center justify-center text-[#1D6C5E] shrink-0 font-bold">
                      <FileText className="w-4 h-4 text-[#36B39E]" />
                    </div>
                    <div className="min-w-0">
                      {/* 文件名取上传接口返回的那个（服务端没给才回落到本地文件名，见 attachmentFromUpload） */}
                      <div className="text-xs font-bold text-slate-800 truncate" title={firstFile.fileName}>
                        {firstFile.fileName || '已上传的委托书'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {formatSize(firstFile.size)} · 已就绪
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => onPreviewFile(firstFile)}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer shadow-2xs inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      <span>预览</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="px-3 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium cursor-pointer shadow-2xs inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>移除</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#1D6C5E] font-medium">
                  <Check className="w-4 h-4 text-[#36B39E]" />
                  <span>法定代表人委托书已上传完备，可通过初审。</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="border-2 border-dashed border-slate-300 hover:border-[#36B39E] bg-[#F8FCFB] hover:bg-[#E6F7F2]/40 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-[#36B39E] flex items-center justify-center mb-2 shadow-2xs group-hover:scale-105 transition-transform">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 mb-0.5">
                    点击上传已签字的委托书照片
                  </span>
                  <span className="text-[11px] text-slate-400">
                    支持 JPG、PNG、PDF 格式，文件大小建议不超过 10MB
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    disabled={isUploading}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
