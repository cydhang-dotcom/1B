/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RegistrationFullForm, FileAttachment } from './types';
import { formatSize } from './defaultData';
import { ExternalLink, CheckCircle2, AlertCircle, FileText, ChevronDown, Check, ArrowRight } from 'lucide-react';

interface ReviewSectionProps {
  form: RegistrationFullForm;
  onGoChapter: (chapterIndex: number) => void;
  onUpdateConfirm: (partial: Partial<RegistrationFullForm['confirm']>) => void;
  onPreviewFile: (file: FileAttachment) => void;
  onProceedToDelivery: () => void;
  errors: Record<string, string>;
}

export const ReviewSection: React.FC<ReviewSectionProps> = ({
  form,
  onGoChapter,
  onUpdateConfirm,
  onPreviewFile,
  onProceedToDelivery,
  errors,
}) => {
  const { basic, shareholders, people, roles, authorization, confirm, status, submittedAt, submissionPhone } = form;

  const isPureNatural = shareholders.length > 0 && shareholders.every((s) => s.type === '自然人');

  const contactRole = roles.find((r) => r.roles.includes('联系人')) || roles[0];
  const contactPerson = contactRole ? people[contactRole.personId] : null;
  const trusteeName = authorization.trusteeName || contactPerson?.name || '林楚天';
  const trusteeIdNumber = authorization.trusteeIdNumber || '440301199308123418';

  const renderFilesList = (files: FileAttachment[]) => {
    if (!files || files.length === 0) {
      return <span className="text-slate-400 text-xs">未附资料照片</span>;
    }
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {files.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPreviewFile(f)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-[#E6F7F2] hover:text-[#1D6C5E] border border-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition-colors shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate max-w-[160px]">{f.name}</span>
            <span className="text-slate-400 text-[10px]">({formatSize(f.size)})</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Submission Success Banner */}
      {status === 'submitted' && (
        <div className="rounded-2xl p-6 border border-emerald-200/90 bg-gradient-to-br from-[#F0FDF4]/90 via-white to-[#F0FDF9] shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#2AA894] to-[#36B39E] text-white flex items-center justify-center shadow-md shadow-emerald-600/20 ring-4 ring-emerald-100/90 shrink-0">
              <Check className="w-5 h-5 stroke-[2.8]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full mb-1 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>初审通过 · 资料已移交政务交付团队</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight mb-1">
                企业注册申报资料已成功提交！
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed mb-1">
                您填报的信息与附件均已完成系统智能排查，政务专员已开展市监局“一窗通”网上申报立项。
              </p>
              <div className="text-[11px] text-slate-400 font-mono mb-4">
                提交时间：{submittedAt || '刚刚'} · 验证经办手机：{submissionPhone || '13800138000'}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onProceedToDelivery}
                  className="px-6 py-2.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#36B39E]/25 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>查看服务进度状态与办理清单</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Section 1: 企业基本信息 */}
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
          <h2 className="text-sm sm:text-base font-bold text-slate-800">1. 企业基本信息</h2>
          <button
            type="button"
            onClick={() => onGoChapter(0)}
            className="text-xs font-semibold text-[#2AA894] hover:text-[#1D6C5E] flex items-center gap-1 cursor-pointer"
          >
            <span>修改</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs sm:text-sm">
          <div className="sm:col-span-2">
            <dt className="text-slate-400 font-medium">拟注册企业名称（按优选顺序）：</dt>
            <dd className="text-slate-800 font-semibold mt-0.5 whitespace-pre-line">
              {basic.names.filter(Boolean).map((n, i) => `${i + 1}. ${n}`).join('\n') || '未填写'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">企业组织形式：</dt>
            <dd className="text-slate-800 font-semibold mt-0.5">
              {basic.org === '其他' ? basic.orgOther || '其他' : basic.org || '未选择'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">注册资本：</dt>
            <dd className="text-slate-800 font-semibold mt-0.5">
              {basic.expert ? '专家推荐（由顾问出资建议方案确定）' : basic.capital ? `${basic.capital} 万元人民币` : '未填写'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-400 font-medium">企业主营服务及简介：</dt>
            <dd className="text-slate-700 mt-0.5 leading-relaxed">{basic.service || basic.intro || '未填写'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-400 font-medium">拟申请经营范围：</dt>
            <dd className="text-slate-700 mt-0.5 leading-relaxed">{basic.scope || '未填写'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-400 font-medium">注册地址：</dt>
            <dd className="text-slate-700 mt-0.5">
              {basic.regRecommend ? '由服务商提供合规商务秘书挂靠地址方案' : basic.regAddress || '未填写'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-400 font-medium">实际经营地址：</dt>
            <dd className="text-slate-700 mt-0.5">
              {basic.workRecommend ? '与注册地址一致 / 由服务商推荐' : basic.workAddress || '未填写'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">董事设置：</dt>
            <dd className="text-slate-800 font-semibold mt-0.5">
              {basic.board || '不设董事会'}{' '}
              {basic.board === '设董事会'
                ? `（${basic.directors || 3} 人）`
                : `（${basic.singleDirector || '由总经理代行职务（不设董事）'}）`}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">监事设置：</dt>
            <dd className="text-slate-800 font-semibold mt-0.5">
              {basic.singleSupervisor || '不设监事'}
              {(basic.singleSupervisor === '不设监事' || !basic.singleSupervisor) && (
                <span className="text-[11px] text-slate-500 font-normal ml-1">· 全体股东一致同意</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Review Section 2: 股东及出资 */}
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-800">2. 股东及出资结构</h2>
            <span className="text-xs text-slate-400">（共 {shareholders.length} 位股东）</span>
          </div>
          <button
            type="button"
            onClick={() => onGoChapter(1)}
            className="text-xs font-semibold text-[#2AA894] hover:text-[#1D6C5E] flex items-center gap-1 cursor-pointer"
          >
            <span>修改</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {shareholders.length > 0 ? (
          <div className="space-y-3.5 divide-y divide-slate-100">
            {shareholders.map((s, idx) => {
              const p = s.personId ? people[s.personId] : null;
              const title = s.type === '自然人' ? p?.name || '未填写姓名' : s.name;
              const files = s.type === '自然人' ? p?.files || [] : s.files || [];

              return (
                <div key={s.id} className={idx > 0 ? 'pt-3.5' : ''}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-800 text-sm">
                      {title}
                      <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {s.type}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-[#1D6C5E]">
                      持股 {s.ratio || 0}% {s.amount ? `· 出资 ${s.amount} 万元` : ''}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 text-xs text-slate-600">
                    {s.type === '自然人' && p && (
                      <>
                        <div>联系电话：{p.phone || '未填写'}</div>
                        <div>电子邮箱：{p.email || '未填写'}</div>
                        <div className="sm:col-span-2">居住地址：{p.address || '未填写'}</div>
                      </>
                    )}
                    {s.type === '企业' && (
                      <div className="sm:col-span-2">统一社会信用代码：{s.code || '未填写'}</div>
                    )}
                    <div>出资形式：{(s.method || []).join('、') || '货币'}</div>
                  </dl>

                  {renderFilesList(files)}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400">尚未添加股东</p>
        )}
      </div>

      {/* Review Section 3: 企业主要人员 */}
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
          <h2 className="text-sm sm:text-base font-bold text-slate-800">3. 企业主要管理人员</h2>
          <button
            type="button"
            onClick={() => onGoChapter(2)}
            className="text-xs font-semibold text-[#2AA894] hover:text-[#1D6C5E] flex items-center gap-1 cursor-pointer"
          >
            <span>修改</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {roles.length > 0 ? (
          <div className="space-y-3.5 divide-y divide-slate-100">
            {roles.map((r, idx) => {
              const p = people[r.personId];
              return (
                <div key={r.id} className={idx > 0 ? 'pt-3.5' : ''}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800 text-sm">{p?.name || '未填写姓名'}</span>
                    {r.roles.map((role) => (
                      <span
                        key={role}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#E6F7F2] text-[#1D6C5E] border border-[#2AA894]/20"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div>电话：{p?.phone || '未填写'} · 邮箱：{p?.email || '未填写'}</div>
                    <div>居住地址：{p?.address || '未填写'}</div>
                  </div>
                  {renderFilesList(p?.files || [])}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400">尚未添加主要管理人员</p>
        )}
      </div>

      {/* Review Section 4: 法定代表人委托书 */}
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
          <h2 className="text-sm sm:text-base font-bold text-slate-800">4. 法定代表人委托书签署</h2>
          <button
            type="button"
            onClick={() => onGoChapter(3)}
            className="text-xs font-semibold text-[#2AA894] hover:text-[#1D6C5E] flex items-center gap-1 cursor-pointer"
          >
            <span>修改</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs sm:text-sm mb-3">
          <div>
            <dt className="text-slate-400 font-medium">受托经办人姓名：</dt>
            <dd className="text-slate-800 font-semibold mt-0.5">{trusteeName}</dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">受托人身份证号：</dt>
            <dd className="text-slate-800 font-semibold mt-0.5">{trusteeIdNumber}</dd>
          </div>
        </dl>

        {authorization.files && authorization.files.length > 0 ? (
          renderFilesList(authorization.files)
        ) : (
          <p className="text-xs text-amber-600 font-medium">尚未上传已签字盖章的委托书扫描件</p>
        )}
      </div>

      {/* Review Section 6: 免申报受益所有人信息承诺 */}
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <div className="mb-3">
          <h2 className="text-sm sm:text-base font-bold text-slate-800">
            免申报受益所有人信息承诺（选填）
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">符合条件的小微企业可申请免除额外备案受益所有人信息。</p>
        </div>

        {isPureNatural ? (
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirm.exemption}
              onChange={(e) => onUpdateConfirm({ exemption: e.target.checked })}
              className="w-4 h-4 rounded text-[#36B39E] focus:ring-[#36B39E] mt-0.5"
            />
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold text-slate-800">
                我确认本企业股东均为自然人，申请免申报受益所有人信息，并同意由服务专员核验适用条件。
              </span>
              {confirm.exemption && (
                <div className="text-[11px] text-[#1D6C5E] font-semibold mt-1">
                  ✓ 已勾选承诺 · 适用资格由专员在网申环节初核
                </div>
              )}
            </div>
          </label>
        ) : (
          <p className="text-xs text-slate-500">
            {shareholders.length > 0
              ? '本申请包含非自然人股东，不适用于纯自然人免申报政策。'
              : '完善股东信息后，可按实际情况选择是否作出承诺。'}
          </p>
        )}

        <details className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 group">
          <summary className="font-semibold text-[#2AA894] cursor-pointer hover:underline flex items-center justify-between">
            <span>查看免申报适用条件说明</span>
            <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2.5 space-y-1.5 text-slate-500 pl-2 border-l-2 border-emerald-200 text-[11px]">
            <div>• 股东结构：全部为自然人</div>
            <div>• 注册资本规模及出资安排符合国家市场监管及反洗钱相关规定</div>
            <div>• 本勾选由专属顾问进行资质核验，符合政策标准方可享受免备案通道。</div>
          </div>
        </details>
      </div>

      {/* Review Section 7: 信息真实性确认 */}
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirm.accurate}
            onChange={(e) => onUpdateConfirm({ accurate: e.target.checked })}
            className="w-4 h-4 rounded text-[#36B39E] focus:ring-[#36B39E] mt-0.5"
          />
          <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-semibold">
            我已核对本次拟申报的全部企业信息与证件资料，确认所填内容真实、完整、有效，并同意专员依此提交政务初审。
            <span className="text-rose-500 ml-0.5">*</span>
          </div>
        </label>
        {errors.accurate && (
          <p className="text-xs text-rose-500 font-medium mt-2 ml-7">{errors.accurate}</p>
        )}
      </div>
    </div>
  );
};
