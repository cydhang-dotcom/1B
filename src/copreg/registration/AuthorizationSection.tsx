/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthorizationData, FileAttachment, RoleRecord, PersonRecord } from './types';
import { Printer, Download, Upload, Eye, Trash2, Check, FileText } from 'lucide-react';
import { formatSize, uid } from './defaultData';

interface AuthorizationSectionProps {
  data: AuthorizationData;
  roles: RoleRecord[];
  people: Record<string, PersonRecord>;
  onChange: (data: AuthorizationData) => void;
  onPreviewFile: (file: FileAttachment) => void;
  onToast: (msg: string) => void;
}

export const AuthorizationSection: React.FC<AuthorizationSectionProps> = ({
  data,
  roles,
  people,
  onChange,
  onPreviewFile,
  onToast,
}) => {
  // Find contact person to automatically fill as trustee
  const contactRole = roles.find((r) => r.roles.includes('联系人')) || roles[0];
  const contactPerson = contactRole ? people[contactRole.personId] : null;
  const trusteeName = data.trusteeName || contactPerson?.name || '林楚天';
  const trusteeIdNumber = data.trusteeIdNumber || '440301199308123418';

  const dateVal = data.entrustDate || new Date().toISOString().split('T')[0];
  const [y, m, d] = dateVal.split('-');

  const hasFile = data.files && data.files.length > 0;
  const firstFile = hasFile ? data.files[0] : null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    const reader = new FileReader();
    reader.onload = () => {
      const newFile: FileAttachment = {
        id: uid(),
        name: file.name,
        size: file.size,
        type: file.type,
        data: (reader.result as string) || '',
      };
      onChange({
        ...data,
        files: [newFile],
      });
      onToast('已上传签署完成的委托书！');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    onChange({
      ...data,
      files: [],
    });
    onToast('已移除委托书附件');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>法定代表人委托书</title>
<style>
  @page { size: A4; margin: 0; }
  body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;margin:0;padding:0;background:#fff}
  .page{
    width:210mm;min-height:297mm;box-sizing:border-box;
    padding:25mm 22mm;color:#0F172A;line-height:2.2;
    display:flex;flex-direction:column;
  }
  h1{text-align:center;font-size:22pt;letter-spacing:.06em;margin:0 0 30mm;font-weight:800}
  .body{font-size:12pt;line-height:2.4;text-align:justify}
  .underline{display:inline-block;min-width:100px;border-bottom:1px solid #0F172A;text-align:center;padding:0 8px;font-weight:600}
  .sign{margin-top:auto;padding-top:20mm;font-size:12pt}
  .line{display:inline-block;min-width:220px;border-bottom:1px solid #0F172A}
  .date{margin-top:8mm;font-size:12pt}
</style></head>
<body>
  <div class="page">
    <h1>法定代表人委托书</h1>
    <div class="body">
      兹委托 <span class="underline">${trusteeName}</span> （身份证号码： <span class="underline">${trusteeIdNumber}</span> ，注：受托人需与"一窗通"公章经办人一致）代表我公司办理公章刻制业务，受托人在上述事项内所签署的有关文件及提供的手续材料，本委托人均予以承认并承担相应的法律责任。
    </div>
    <div class="sign">委托人（法定代表人亲笔签名）：<span class="line"></span></div>
    <div class="date">委托日期：<span class="underline">${y}</span> 年 <span class="underline">${m}</span> 月 <span class="underline">${d}</span> 日</div>
  </div>
</body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `法定代表人委托书_${trusteeName}.html`;
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
                系统已依据经办人信息自动排版 A4 授权委托书，可直接打印或下载。
              </p>
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
                      <div className="text-xs font-bold text-slate-800 truncate">{firstFile.name}</div>
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
