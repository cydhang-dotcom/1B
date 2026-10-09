/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { BasicInfoData, FileAttachment } from './types';
import { formatSize, uid } from './defaultData';
import { useAttachmentUpload } from './useAttachmentUpload';
import {
  DEFAULT_REG_ADDRESS_NATURE,
  DEFAULT_WORK_ADDRESS_NATURE,
  REG_ADDRESS_NATURES,
  WORK_ADDRESS_NATURES,
  addressHintOf,
  regAddressPlaceholder,
  workAddressPlaceholder,
  workNatureForCopiedRegNature,
} from './addressNatureHints';
import {
  ADD_NAME_LABEL,
  NAME_PANEL_HINT,
  alternateNamePlaceholderOf,
  primaryNamePlaceholderFor,
} from './nameHints';
import { SectionDecor, sectionCardClass } from '../components/SectionDecor';
import { CAPITAL_EXPERT_HINT, capitalEditPatch } from './capitalHints';
import {
  Plus,
  Trash2,
  Building,
  MapPin,
  ShieldCheck,
  UserCheck,
  Info,
  CheckCircle2,
  UploadCloud,
  FileText,
  Eye,
  X,
  Copy,
  Paperclip,
} from 'lucide-react';

interface BasicInfoSectionProps {
  data: BasicInfoData;
  onChange: (data: BasicInfoData) => void;
  errors: Record<string, string>;
  onPreviewFile?: (file: FileAttachment) => void;
  onToast?: (msg: string) => void;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  data,
  onChange,
  errors,
  onPreviewFile,
  onToast,
}) => {
  const regFileInputRef = useRef<HTMLInputElement | null>(null);
  const workFileInputRef = useRef<HTMLInputElement | null>(null);

  const update = (partial: Partial<BasicInfoData>) => {
    onChange({ ...data, ...partial });
  };

  /**
   * 每张面板「有没有待完善项」——高亮条**只在这一块校验过了才亮**（与 #survey 同一口径）。
   * 判据直接用这一章的校验结果（`errors` 是章节级 id→文案）：这块的字段还错着就说明没填好。
   * 面板 ↔ 校验 id 的对应关系写死在这里（`RegistrationDetailsStep.validate()` 用的是同一批 id）。
   */
  const PANEL_ERROR_IDS: Record<string, string[]> = {
    '01': ['org', 'orgOther'],
    '02': ['__names__'], // 名称那一组：id 形如 name-0 / name-1 …
    '03': ['capital'],
    '04': ['scope'],
    '05': ['regAddress', 'regAddressNature', 'regFiles', 'workAddress', 'workAddressNature', 'workFiles'],
    '06': ['board', 'directors', 'singleDirector'],
    '07': ['singleSupervisor', 'unanimous'],
  };
  const basicPanelDone = (panel: string): boolean => {
    const ids = PANEL_ERROR_IDS[panel] ?? [];
    const keys = Object.keys(errors || {});
    if (ids.includes('__names__')) return !keys.some((key) => key.startsWith('name-'));
    return !keys.some((key) => ids.includes(key));
  };

  /** 两个地址当前的提示口径（占位 / 缺填报错 / 需上传材料 / 要不要红字强调），按所选性质取 */
  const regHint = addressHintOf('reg', data.regAddressNature);
  const workHint = addressHintOf('work', data.workAddressNature);
  const regMaterials = regHint.materials;
  const workMaterials = workHint.materials;

  // 默认选择不设董事会、不设董事（由总经理代行职权）
  const currentBoard = data.board || '不设董事会';
  const currentSingleDirector = data.singleDirector || '由总经理代行职务（不设董事）';

  useEffect(() => {
    const updates: Partial<BasicInfoData> = {};
    if (!data.board) updates.board = '不设董事会';
    if (!data.singleDirector) updates.singleDirector = '由总经理代行职务（不设董事）';
    if (data.unanimous === undefined || data.unanimous === null) updates.unanimous = true;
    if (!data.regAddressNature) updates.regAddressNature = DEFAULT_REG_ADDRESS_NATURE;
    if (!data.workAddressNature) updates.workAddressNature = DEFAULT_WORK_ADDRESS_NATURE;
    if (Object.keys(updates).length > 0) {
      update(updates);
    }
  }, []);

  const isDirectorSelected =
    currentBoard === '设董事会' ||
    currentSingleDirector === '设 1 名董事' ||
    currentSingleDirector === '设1名董事' ||
    currentSingleDirector === '董事';

  const isGeneralManagerExercising =
    currentBoard === '不设董事会' &&
    (currentSingleDirector === '由总经理代行职务（不设董事）' ||
     currentSingleDirector === '由经理代行（不设董事）' ||
     currentSingleDirector === '不设董事' ||
     currentSingleDirector?.includes('总经理') ||
     currentSingleDirector?.includes('代行') ||
     currentSingleDirector?.includes('不设董事'));

  // 选完文件直接上传：拿到 fileUuid 才往表单里加行（见 handleFileUpload）
  const { isUploading, upload } = useAttachmentUpload();

  const isSupervisorSelected =
    data.singleSupervisor === '设 1 名监事' ||
    data.singleSupervisor === '设1名监事' ||
    data.singleSupervisor === '一名监事';

  /**
   * 选完文件直接上传（`useAttachmentUpload`）：拿到 fileUuid 才往表单里加行。
   * 失败只 toast 原因、不加行 —— 一行没有 fileUuid 的附件既显示不出图，也提交不上去。
   */
  const handleFileUpload = async (files: FileList | null, target: 'reg' | 'work') => {
    if (!files || files.length === 0) return;
    const slot = target === 'reg' ? 'regAddressProof' : 'workAddressProof';
    try {
      const uploaded = await upload(files, slot);
      if (uploaded.length === 0) return;
      if (target === 'reg') {
        update({ regFiles: [...(data.regFiles || []), ...uploaded] });
      } else {
        update({ workFiles: [...(data.workFiles || []), ...uploaded] });
      }
      if (onToast) onToast(`已上传 ${uploaded.length} 份场地证明材料`);
    } catch (error) {
      if (onToast) onToast(error instanceof Error ? error.message : '附件上传失败，请稍后重试');
    }
  };

  const handleRemoveFile = (fileId: string, target: 'reg' | 'work') => {
    if (target === 'reg') {
      update({ regFiles: (data.regFiles || []).filter((f) => f.id !== fileId) });
    } else {
      update({ workFiles: (data.workFiles || []).filter((f) => f.id !== fileId) });
    }
    if (onToast) onToast('已移除附件');
  };

  const handleOrgSelect = (org: string) => {
    update({ org });
  };

  const handleNameChange = (index: number, val: string) => {
    const updated = [...data.names];
    updated[index] = val;
    update({ names: updated });
  };

  const handleAddName = () => {
    if (data.names.length >= 9) return;
    update({ names: [...data.names, ''] });
  };

  const handleRemoveName = (index: number) => {
    if (data.names.length <= 1) return;
    const updated = data.names.filter((_, i) => i !== index);
    update({ names: updated });
  };

  return (
    <div className="space-y-5">
      {/* Panel 01: 企业组织形式 */}
      <div
        data-fill-panel="01"
        data-card-done={String(basicPanelDone('01'))}
        className={`rounded-2xl p-5 sm:p-6 border transition-all duration-300 relative overflow-hidden ${sectionCardClass(basicPanelDone('01'))}`}
      >
        {basicPanelDone('01') && <SectionDecor />}
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <span>企业组织形式</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              请选择本次拟设立企业的组织形式。
            </p>
          </div>
          <span className="text-xs font-bold text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
            01
          </span>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            {['有限责任公司', '股份有限公司', '合伙企业'].map((orgType) => {
              const isSelected = data.org === orgType;
              return (
                <button
                  key={orgType}
                  type="button"
                  onClick={() => handleOrgSelect(orgType)}
                  className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#36B39E] bg-[#E6F7F2] text-[#1D6C5E] shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {orgType}
                </button>
              );
            })}

            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <button
                type="button"
                onClick={() => handleOrgSelect('其他')}
                className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  data.org === '其他'
                    ? 'border-[#36B39E] bg-[#E6F7F2] text-[#1D6C5E] shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                其他
              </button>

              {data.org === '其他' && (
                <input
                  type="text"
                  value={data.orgOther}
                  onChange={(e) => update({ orgOther: e.target.value })}
                  placeholder="请输入具体组织形式 *"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none"
                />
              )}
            </div>
          </div>

          {errors.org && <p className="text-xs text-rose-500 mt-2 font-medium">{errors.org}</p>}
          {errors.orgOther && <p className="text-xs text-rose-500 mt-2 font-medium">{errors.orgOther}</p>}
        </div>
      </div>

      {/* Panel 02: 拟注册企业名称 */}
      <div
        data-fill-panel="02"
        data-card-done={String(basicPanelDone('02'))}
        className={`rounded-2xl p-5 sm:p-6 border transition-all duration-300 relative overflow-hidden ${sectionCardClass(basicPanelDone('02'))}`}
      >
        {basicPanelDone('02') && <SectionDecor />}
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <span>拟注册企业名称（按优先级排序）</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{NAME_PANEL_HINT}</p>
          </div>
          <span className="text-xs font-bold text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
            02
          </span>
        </div>

        <div className="space-y-3">
          {data.names.map((name, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-6 text-center text-xs font-mono font-bold text-slate-400">
                {index + 1}.
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                // 第一个框的示例名按「企业组织形式」联动（选股份公司就示例「…股份有限公司」），
                // 让人一眼看出要填**带组织形式后缀的完整名称**；备选框只提示是第几个
                placeholder={
                  index === 0
                    ? primaryNamePlaceholderFor(data.org, data.orgOther)
                    : alternateNamePlaceholderOf(index)
                }
                className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition-colors ${
                  errors[`name-${index}`]
                    ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                    : 'border-slate-200 bg-white text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2]'
                }`}
              />
              {data.names.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveName(index)}
                  className="p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                  title="删除该备选名称"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {errors['name-0'] && (
            <p className="text-xs text-rose-500 font-medium pl-8">{errors['name-0']}</p>
          )}

          {data.names.length < 9 && (
            <div className="pt-2 pl-8">
              <button
                type="button"
                onClick={handleAddName}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-dashed border-slate-300 hover:border-[#36B39E] text-xs font-semibold text-slate-600 hover:text-[#1D6C5E] transition-colors cursor-pointer bg-slate-50/60"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{ADD_NAME_LABEL}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Panel 03: 注册资本 */}
      <div
        data-fill-panel="03"
        data-card-done={String(basicPanelDone('03'))}
        className={`rounded-2xl p-5 sm:p-6 border transition-all duration-300 relative overflow-hidden ${sectionCardClass(basicPanelDone('03'))}`}
      >
        {basicPanelDone('03') && <SectionDecor />}
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <span>注册资本（万元人民币）</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              新《公司法》实施后，认缴出资需在 5 年内实缴完毕。建议结合企业经营规划与实际出资能力合理设定。
            </p>
          </div>
          <span className="text-xs font-bold text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
            03
          </span>
        </div>

        <div className="space-y-3">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              value={data.capital}
              // 用户自己动过这一格就不再算「专家推荐」（见 capitalHints.ts）：
              // 否则 05 确认提交那一章会一直显示「专家推荐」、把他填的数字吞掉
              onChange={(e) => update(capitalEditPatch(e.target.value))}
              placeholder="例如：100"
              className={`w-full px-3.5 py-2.5 pr-12 rounded-xl border text-xs sm:text-sm outline-none transition-colors ${
                errors.capital
                  ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                  : 'border-slate-200 bg-white text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2]'
              }`}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
              万元
            </span>
          </div>

          {/* 还是方案建议值时把来源说清楚：用户改一下就撤标记，这行也跟着消失 */}
          {data.expert && <p className="text-xs text-slate-500 leading-relaxed">{CAPITAL_EXPERT_HINT}</p>}

          {errors.capital && (
            <p className="text-xs text-rose-500 font-medium">{errors.capital}</p>
          )}
        </div>
      </div>

      {/* Panel 04: 企业简介与主营服务 */}
      <div
        data-fill-panel="04"
        data-card-done={String(basicPanelDone('04'))}
        className={`rounded-2xl p-5 sm:p-6 border transition-all duration-300 relative overflow-hidden ${sectionCardClass(basicPanelDone('04'))}`}
      >
        {basicPanelDone('04') && <SectionDecor />}
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <span>企业简介与主营业务说明</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              用于规范化匹配经营范围与政务申报行业归属分类。
            </p>
          </div>
          <span className="text-xs font-bold text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
            04
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                企业业务简介及定位
              </label>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                仅供展示
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed select-text">
              {data.intro || <span className="text-slate-400">（尚未填写，回到第 1 步问卷或在此补填）</span>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                主营服务及核心产品
              </label>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                仅供展示
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed select-text">
              {data.service || <span className="text-slate-400">（尚未填写，回到第 1 步问卷或在此补填）</span>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              拟申请经营范围表述 <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={data.scope}
              onChange={(e) => update({ scope: e.target.value })}
              placeholder="例如：一般项目：日用百货销售；电子产品销售；软件开发；技术进出口..."
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition-colors font-mono ${
                errors.scope
                  ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                  : 'border-slate-200 bg-white text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2]'
              }`}
            />
            {errors.scope && <p className="text-xs text-rose-500 font-medium mt-1">{errors.scope}</p>}
            <p className="text-[11px] text-slate-400 mt-1">
              * 专属顾问将依据最新全国统一市监局规范条目协助核实规范表述。
            </p>
          </div>
        </div>
      </div>

      {/* Panel 05: 注册地址与实际经营地址 */}
      <div
        data-fill-panel="05"
        data-card-done={String(basicPanelDone('05'))}
        className={`rounded-2xl p-5 sm:p-6 border transition-all duration-300 relative overflow-hidden ${sectionCardClass(basicPanelDone('05'))}`}
      >
        {basicPanelDone('05') && <SectionDecor />}
        <div className="flex items-start justify-between gap-4 mb-5 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#2AA894]" />
              <span>法定注册地址与实际经营办公地址</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              两类地址均可由服务商提供合规托管方案；若未勾选服务商提供，需选择地址性质并上传场地证明材料。
            </p>
          </div>
          <span className="text-xs font-bold text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full shrink-0">
            05
          </span>
        </div>

        <div className="space-y-6">
          {/* ================= 1. 法定注册地址 ================= */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-slate-50/40 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs sm:text-sm font-bold text-slate-800">
                  法定注册地址 <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">（用于营业执照登记及政务文书送达）</span>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-emerald-50/80 hover:bg-emerald-100/70 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors shadow-2xs">
                <input
                  type="checkbox"
                  checked={data.regRecommend}
                  onChange={(e) => update({ regRecommend: e.target.checked })}
                  className="w-4 h-4 rounded text-[#2AA894] focus:ring-[#2AA894] accent-[#2AA894]"
                />
                <span className="text-xs text-[#1D6C5E] font-bold">由服务商提供</span>
              </label>
            </div>

            {data.regRecommend ? (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-[#2AA894] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>已选择由服务商提供合规商务秘书挂靠 / 集中托管地址</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">免自行提供场地证明</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    平台专属顾问已为您匹配自贸园区/集中托管商务秘书注册地址方案，包含标准 25 位房屋编码与场所承诺备案，符合市监局设立标准，无需您自行准备和上传场地证明材料。
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* 地址输入 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    法定注册详细地址 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={data.regAddress}
                    onChange={(e) => update({ regAddress: e.target.value })}
                    placeholder={regAddressPlaceholder(data.regAddressNature)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition-colors bg-white ${
                      errors.regAddress
                        ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                        : 'border-slate-200 text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2]'
                    } ${regHint.emphasis ? 'placeholder:text-rose-400/90' : ''}`}
                  />
                  {/* 输入框下面**只留一行**：「地址怎么填」已经在占位里（换性质会跟着换），
                      再写一行小字就会和红字报错叠在一起、两句话说同一件事，不好看（用户 2026-10-08）。
                      无偿使用证明那一档靠**红色占位** + 红色报错保留「红字重点」（不带 ⚠️ 前缀） */}
                  {errors.regAddress && (
                    <p className="text-xs text-rose-500 font-medium mt-1">{errors.regAddress}</p>
                  )}
                </div>

                {/* 地址性质 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    地址性质 <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {REG_ADDRESS_NATURES.map((item) => {
                      const isSelected = (data.regAddressNature || DEFAULT_REG_ADDRESS_NATURE) === item.val;
                      return (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => update({ regAddressNature: item.val })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer text-left ${
                            isSelected
                              ? 'bg-[#E6F7F2] border-[#36B39E] text-[#1D6C5E] font-semibold ring-1 ring-[#36B39E]'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>{item.val}</span>
                          <span className="block text-[10px] text-slate-400 font-normal">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.regAddressNature && (
                    <p className="text-xs text-rose-500 font-medium mt-1">{errors.regAddressNature}</p>
                  )}
                </div>

                {/* 证明材料上传 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <span>注册场地证明材料</span>
                      <span className="text-rose-500">*</span>
                      {/* 有材料清单时明细在下面那块里，这里就不再重复举例 */}
                      {regMaterials.length === 0 && (
                        <span className="text-[11px] text-slate-400 font-normal">（如租赁合同、房产证复印件或场地使用证明）</span>
                      )}
                    </label>
                  </div>

                  {/* 需上传材料：按所选地址性质给出（用户 2026-10-08 给的口径） */}
                  {regMaterials.length > 0 && (
                    <div className="mb-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5">
                      <p className="text-[11px] font-bold text-slate-700 mb-1">
                        需上传材料（{data.regAddressNature || DEFAULT_REG_ADDRESS_NATURE}）
                      </p>
                      <ul className="space-y-0.5">
                        {regMaterials.map((item) => (
                          <li key={item} className="text-[11px] text-slate-600 leading-relaxed flex gap-1.5">
                            <span className="text-[#2AA894] shrink-0">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Upload Box */}
                  <input
                    ref={regFileInputRef}
                    type="file"
                    multiple
                    disabled={isUploading}
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files, 'reg')}
                  />
                  <div
                    onClick={() => {
                      if (isUploading) return;
                      regFileInputRef.current?.click();
                    }}
                    className="border-2 border-dashed border-slate-200 hover:border-[#36B39E] rounded-xl p-4 text-center bg-white hover:bg-emerald-50/20 transition-all cursor-pointer group"
                  >
                    <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-[#2AA894] mx-auto mb-1 transition-colors" />
                    <p className="text-xs font-medium text-slate-700">
                      {isUploading ? '上传中…' : '点击或将证明文件拖拽至此处上传'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      支持 JPG、PNG、PDF 格式，单个文件不超过 20MB（可上传多份）
                    </p>
                  </div>

                  {/* Uploaded Files List */}
                  {data.regFiles && data.regFiles.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {data.regFiles.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-[#2AA894] shrink-0" />
                            <span className="text-slate-800 font-medium truncate max-w-[240px] sm:max-w-md">
                              {f.fileName}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({formatSize(f.size)})
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {onPreviewFile && (
                              <button
                                type="button"
                                onClick={() => onPreviewFile(f)}
                                className="p-1 text-slate-500 hover:text-[#2AA894] hover:bg-emerald-50 rounded transition-colors"
                                title="预览文件"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(f.id, 'reg')}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                              title="移除此文件"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.regFiles && (
                    <p className="text-xs text-rose-500 font-medium mt-1">{errors.regFiles}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ================= 2. 实际经营办公地址 ================= */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-slate-50/40 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs sm:text-sm font-bold text-slate-800">
                  实际经营办公地址 <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">（企业实际日常办公或仓储场地）</span>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-emerald-50/80 hover:bg-emerald-100/70 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors shadow-2xs">
                <input
                  type="checkbox"
                  checked={data.workRecommend}
                  onChange={(e) => update({ workRecommend: e.target.checked })}
                  className="w-4 h-4 rounded text-[#2AA894] focus:ring-[#2AA894] accent-[#2AA894]"
                />
                <span className="text-xs text-[#1D6C5E] font-bold">由服务商提供</span>
              </label>
            </div>

            {data.workRecommend ? (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-[#2AA894] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>已选择由服务商提供实际经营办公地址</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">免自行提供场地证明</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    由服务商配套提供同套商务托管场地或园区共享办公位方案，免去自行租赁和上传场地证明流程。
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* 地址输入 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      实际经营办公详细地址 <span className="text-rose-500">*</span>
                    </label>
                    {data.regAddress && !data.regRecommend && (
                      <button
                        type="button"
                        onClick={() => {
                          // 两个地址现在是**同一套性质**：性质直接跟着切过去（认不出就只搬地址与材料）
                          const workNature = workNatureForCopiedRegNature(data.regAddressNature);
                          // 场地证明材料一起搬：**保留 fileUuid**（服务端已经收过这份文件，不必重传），
                          // 只换本地行 id，免得两份清单共用同一个 id
                          const copiedFiles: FileAttachment[] = (data.regFiles || []).map((file) => ({
                            ...file,
                            id: uid(),
                          }));
                          update({
                            workAddress: data.regAddress,
                            ...(workNature ? { workAddressNature: workNature } : {}),
                            ...(copiedFiles.length > 0 ? { workFiles: copiedFiles } : {}),
                          });
                          if (onToast) {
                            onToast(
                              copiedFiles.length > 0
                                ? '已复制法定注册地址，并同步地址性质与场地证明材料'
                                : '已复制法定注册地址并同步地址性质'
                            );
                          }
                        }}
                        className="text-[11px] text-[#2AA894] hover:underline cursor-pointer flex items-center gap-1 font-medium"
                      >
                        <Copy className="w-3 h-3" />
                        <span>同法定注册地址</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={data.workAddress}
                    onChange={(e) => update({ workAddress: e.target.value })}
                    placeholder={workAddressPlaceholder(data.workAddressNature)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition-colors bg-white ${
                      errors.workAddress
                        ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                        : 'border-slate-200 text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2]'
                    } ${workHint.emphasis ? 'placeholder:text-rose-400/90' : ''}`}
                  />
                  {/* 同法定注册地址：输入框下面只留报错那一行（见上面的说明） */}
                  {errors.workAddress && (
                    <p className="text-xs text-rose-500 font-medium mt-1">{errors.workAddress}</p>
                  )}
                </div>

                {/* 地址性质 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    实际地址性质 <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WORK_ADDRESS_NATURES.map((item) => {
                      const isSelected = (data.workAddressNature || DEFAULT_WORK_ADDRESS_NATURE) === item.val;
                      return (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => update({ workAddressNature: item.val })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer text-left ${
                            isSelected
                              ? 'bg-[#E6F7F2] border-[#36B39E] text-[#1D6C5E] font-semibold ring-1 ring-[#36B39E]'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>{item.val}</span>
                          <span className="block text-[10px] text-slate-400 font-normal">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.workAddressNature && (
                    <p className="text-xs text-rose-500 font-medium mt-1">{errors.workAddressNature}</p>
                  )}
                </div>

                {/* 证明材料上传 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <span>实际办公场地证明材料</span>
                      <span className="text-rose-500">*</span>
                      {workMaterials.length === 0 && (
                        <span className="text-[11px] text-slate-400 font-normal">（如租赁合同、物业入驻证明或场地使用协议）</span>
                      )}
                    </label>
                  </div>

                  {/* 需上传材料：按所选地址性质给出（居家办公申报这一档没有口径，不显示这块） */}
                  {workMaterials.length > 0 && (
                    <div className="mb-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5">
                      <p className="text-[11px] font-bold text-slate-700 mb-1">
                        需上传材料（{data.workAddressNature || DEFAULT_WORK_ADDRESS_NATURE}）
                      </p>
                      <ul className="space-y-0.5">
                        {workMaterials.map((item) => (
                          <li key={item} className="text-[11px] text-slate-600 leading-relaxed flex gap-1.5">
                            <span className="text-[#2AA894] shrink-0">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Upload Box */}
                  <input
                    ref={workFileInputRef}
                    type="file"
                    multiple
                    disabled={isUploading}
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files, 'work')}
                  />
                  <div
                    onClick={() => {
                      if (isUploading) return;
                      workFileInputRef.current?.click();
                    }}
                    className="border-2 border-dashed border-slate-200 hover:border-[#36B39E] rounded-xl p-4 text-center bg-white hover:bg-emerald-50/20 transition-all cursor-pointer group"
                  >
                    <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-[#2AA894] mx-auto mb-1 transition-colors" />
                    <p className="text-xs font-medium text-slate-700">
                      点击或将实际办公场地证明拖拽至此处上传
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      支持 JPG、PNG、PDF 格式，单个文件不超过 20MB
                    </p>
                  </div>

                  {/* Uploaded Files List */}
                  {data.workFiles && data.workFiles.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {data.workFiles.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-[#2AA894] shrink-0" />
                            <span className="text-slate-800 font-medium truncate max-w-[240px] sm:max-w-md">
                              {f.fileName}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({formatSize(f.size)})
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {onPreviewFile && (
                              <button
                                type="button"
                                onClick={() => onPreviewFile(f)}
                                className="p-1 text-slate-500 hover:text-[#2AA894] hover:bg-emerald-50 rounded transition-colors"
                                title="预览文件"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(f.id, 'work')}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                              title="移除此文件"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.workFiles && (
                    <p className="text-xs text-rose-500 font-medium mt-1">{errors.workFiles}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel 06: 董事设置 */}
      <div
        data-fill-panel="06"
        data-card-done={String(basicPanelDone('06'))}
        className={`rounded-2xl p-5 sm:p-6 border transition-all duration-300 relative overflow-hidden ${sectionCardClass(basicPanelDone('06'))}`}
      >
        {basicPanelDone('06') && <SectionDecor />}
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2AA894]" />
              <span>董事设置</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              新《公司法》施行后，已取消“执行董事”职务；企业可选择设立董事会、设立 1 名董事，或由经理代行职权。
            </p>
          </div>
          <span className="text-xs font-bold text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
            06
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              是否设立董事会
            </label>
            <div className="flex flex-wrap gap-2.5">
              {['不设董事会', '设董事会'].map((val) => {
                const isSelected = currentBoard === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      if (val === '不设董事会') {
                        const currentIsDirector =
                          currentSingleDirector === '设 1 名董事' ||
                          currentSingleDirector === '设1名董事' ||
                          currentSingleDirector === '董事';
                        if (!currentIsDirector) {
                          update({ board: val, singleDirector: '由总经理代行职务（不设董事）' });
                        } else {
                          update({ board: val });
                        }
                      } else {
                        update({ board: val });
                      }
                    }}
                    className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#36B39E] bg-[#E6F7F2] text-[#1D6C5E] shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>

          {currentBoard === '设董事会' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  董事会成员人数（法定至少 3 人）
                </label>
                <div className="flex items-center gap-2 max-w-xs">
                  <input
                    type="number"
                    min={3}
                    value={data.directors || '3'}
                    onChange={(e) => update({ directors: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none"
                  />
                  <span className="text-xs text-slate-500 shrink-0">人</span>
                </div>
                {errors.directors && (
                  <p className="text-xs text-rose-500 mt-1 font-medium">{errors.directors}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  不设董事会时的职务安排（默认由总经理代行职权，已去除原“执行董事”选项）
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { val: '由总经理代行职务（不设董事）', label: '由总经理代行职务（不设董事）' },
                    { val: '设 1 名董事', label: '设 1 名董事（行使董事会职权）' },
                  ].map((item) => {
                    const isSelected =
                      item.val === '由总经理代行职务（不设董事）'
                        ? currentSingleDirector !== '设 1 名董事' &&
                          currentSingleDirector !== '设1名董事' &&
                          currentSingleDirector !== '董事'
                        : currentSingleDirector === '设 1 名董事' ||
                          currentSingleDirector === '设1名董事' ||
                          currentSingleDirector === '董事';
                    return (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => update({ singleDirector: item.val })}
                        className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#36B39E] bg-[#E6F7F2] text-[#1D6C5E] shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 联动规则提示 */}
          {isDirectorSelected ? (
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-800 flex items-start gap-2">
              <UserCheck className="w-4 h-4 text-[#2AA894] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">主要人员联动：</span>
                当前已选择设立【董事】，系统已联动在【主要人员】中增加【董事】职务，且为
                <span className="font-bold underline ml-1">必选人员</span>
                （请在主要人员中为相应成员勾选董事职务）。
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-800 flex items-start gap-2">
              <UserCheck className="w-4 h-4 text-[#2AA894] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">主要人员联动：</span>
                当前已选择【由总经理代行职务（不设董事）】，主要人员中无需设立【董事】，系统已联动要求【总经理】为
                <span className="font-bold underline ml-1">必选职务</span>
                （由总经理行使公司法规定职权）。
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel 07: 监事设置 */}
      <div
        data-fill-panel="07"
        data-card-done={String(basicPanelDone('07'))}
        className={`rounded-2xl p-5 sm:p-6 border transition-all duration-300 relative overflow-hidden ${sectionCardClass(basicPanelDone('07'))}`}
      >
        {basicPanelDone('07') && <SectionDecor />}
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2AA894]" />
              <span>监事设置</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              根据新《公司法》第六十九条、第八十三条，有限责任公司经全体股东一致同意可不设监事；若设监事，则仅设 1 名监事。
            </p>
          </div>
          <span className="text-xs font-bold text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
            07
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              监事职务设立安排
            </label>
            <div className="flex flex-wrap gap-2.5">
              {[
                { val: '不设监事', label: '不设监事（经全体股东一致同意）' },
                { val: '设 1 名监事', label: '设 1 名监事（行使监督职权）' },
              ].map((item) => {
                const isSelected =
                  data.singleSupervisor === item.val ||
                  (item.val === '不设监事' &&
                    (data.singleSupervisor === '不设监事' || !data.singleSupervisor)) ||
                  (item.val === '设 1 名监事' &&
                    (data.singleSupervisor === '设1名监事' || data.singleSupervisor === '一名监事'));
                return (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => {
                      if (item.val === '不设监事') {
                        update({ singleSupervisor: item.val, unanimous: true });
                      } else {
                        update({ singleSupervisor: item.val });
                      }
                    }}
                    className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#36B39E] bg-[#E6F7F2] text-[#1D6C5E] shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 联动与合规说明 */}
          {isSupervisorSelected ? (
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-800 flex items-start gap-2">
              <UserCheck className="w-4 h-4 text-[#2AA894] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">主要人员联动：</span>
                当前已选择设立【1 名监事】，系统已联动在【主要人员】中增加【监事】职务，且为
                <span className="font-bold underline ml-1">必选人员</span>
                （注：依据公司法规定，董事、高级管理人员不得兼任监事）。
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={data.unanimous !== false}
                  onChange={(e) => update({ unanimous: e.target.checked })}
                  className="w-4 h-4 rounded text-[#2AA894] focus:ring-[#2AA894] accent-[#2AA894]"
                />
                <span className="text-xs text-slate-800 font-medium">
                  全体股东已一致同意本次设立不设监事会及监事（依据新《公司法》第八十三条规定）
                </span>
              </label>
              {errors.unanimous && (
                <p className="text-xs text-rose-500 font-medium">{errors.unanimous}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
