/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { BasicInfoData, FileAttachment } from './types';
import { uid, formatSize } from './defaultData';
import {
  Plus,
  Trash2,
  Building,
  MapPin,
  Sparkles,
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

  // 默认选择不设董事会、不设董事（由总经理代行职权）
  const currentBoard = data.board || '不设董事会';
  const currentSingleDirector = data.singleDirector || '由总经理代行职务（不设董事）';

  useEffect(() => {
    const updates: Partial<BasicInfoData> = {};
    if (!data.board) updates.board = '不设董事会';
    if (!data.singleDirector) updates.singleDirector = '由总经理代行职务（不设董事）';
    if (data.unanimous === undefined || data.unanimous === null) updates.unanimous = true;
    if (!data.regAddressNature) updates.regAddressNature = '租赁用房';
    if (!data.workAddressNature) updates.workAddressNature = '商业租赁';
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

  const isSupervisorSelected =
    data.singleSupervisor === '设 1 名监事' ||
    data.singleSupervisor === '设1名监事' ||
    data.singleSupervisor === '一名监事';

  const handleFileUpload = (files: FileList | null, target: 'reg' | 'work') => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newAttachment: FileAttachment = {
          id: uid(),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          data: (reader.result as string) || '',
          slot: target === 'reg' ? 'regAddressProof' : 'workAddressProof',
        };
        if (target === 'reg') {
          const current = data.regFiles || [];
          update({ regFiles: [...current, newAttachment] });
        } else {
          const current = data.workFiles || [];
          update({ workFiles: [...current, newAttachment] });
        }
      };
      reader.readAsDataURL(file);
    });
    if (onToast) onToast('已添加场地证明材料');
  };

  const handleRemoveFile = (fileId: string, target: 'reg' | 'work') => {
    if (target === 'reg') {
      update({ regFiles: (data.regFiles || []).filter((f) => f.id !== fileId) });
    } else {
      update({ workFiles: (data.workFiles || []).filter((f) => f.id !== fileId) });
    }
    if (onToast) onToast('已移除附件');
  };

  const handleAddSampleProof = (target: 'reg' | 'work') => {
    if (target === 'reg') {
      const sampleFile: FileAttachment = {
        id: uid(),
        name: '房屋租赁合同及不动产权属证明（已备案）.pdf',
        size: 1420500,
        type: 'application/pdf',
        slot: 'regAddressProof',
        data: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCg==',
      };
      update({
        regAddressNature: data.regAddressNature || '租赁用房',
        regFiles: [...(data.regFiles || []), sampleFile],
      });
    } else {
      const sampleFile: FileAttachment = {
        id: uid(),
        name: '实际经营办公场所租赁协议与物业入驻证明.pdf',
        size: 985200,
        type: 'application/pdf',
        slot: 'workAddressProof',
        data: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCg==',
      };
      update({
        workAddressNature: data.workAddressNature || '商业租赁',
        workFiles: [...(data.workFiles || []), sampleFile],
      });
    }
    if (onToast) onToast('已载入合规示例场地证明材料');
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
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
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
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <span>拟注册企业名称（按优先级排序）</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              请输入 1 ~ 9 个字号，我们将按照由上到下的顺序依次向市监局发起名称自主申报核准。
            </p>
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
                placeholder={
                  index === 0
                    ? '首选名称，例如：云帆盛景（深圳）科技有限公司 *'
                    : `备选字号 ${index + 1}`
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
                <span>添加备选字号（最多 9 个）</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Panel 03: 注册资本 */}
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
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
              onChange={(e) => update({ capital: e.target.value.replace(/[^\d]/g, '') })}
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

          {errors.capital && (
            <p className="text-xs text-rose-500 font-medium">{errors.capital}</p>
          )}
        </div>
      </div>

      {/* Panel 04: 企业简介与主营服务 */}
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
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
              {data.intro || '拟设立有限责任公司，依托数字化与全渠道服务网络，面向目标市场提供合规、高品质的产品与专业技术服务。'}
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
              {data.service || '主营海外仓配履约、跨境独立站全渠道运营、供应链数字化协同及品牌海外推广咨询服务。'}
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
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
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
                    placeholder="请输入详细注册地址（含省/市/区/街道/大厦/楼层及房号，需与产权证明一致）"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition-colors bg-white ${
                      errors.regAddress
                        ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                        : 'border-slate-200 text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2]'
                    }`}
                  />
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
                    {[
                      { val: '租赁用房', desc: '商业写字楼/租赁办公' },
                      { val: '自有房产', desc: '股东或企业自有产权' },
                      { val: '集中办公/众创空间', desc: '众创空间/工位协议' },
                      { val: '园区孵化器', desc: '产业园集中入驻' },
                      { val: '无偿使用证明', desc: '关联方提供无偿使用' },
                    ].map((item) => {
                      const isSelected = (data.regAddressNature || '租赁用房') === item.val;
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
                      <span className="text-[11px] text-slate-400 font-normal">（如租赁合同、房产证复印件或场地使用证明）</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddSampleProof('reg')}
                      className="text-[11px] text-[#2AA894] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>载入示例证明</span>
                    </button>
                  </div>

                  {/* Upload Box */}
                  <input
                    ref={regFileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files, 'reg')}
                  />
                  <div
                    onClick={() => regFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-[#36B39E] rounded-xl p-4 text-center bg-white hover:bg-emerald-50/20 transition-all cursor-pointer group"
                  >
                    <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-[#2AA894] mx-auto mb-1 transition-colors" />
                    <p className="text-xs font-medium text-slate-700">
                      点击或将证明文件拖拽至此处上传
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
                              {f.name}
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
                          update({
                            workAddress: data.regAddress,
                            workAddressNature: data.regAddressNature === '租赁用房' ? '商业租赁' : '自有产权',
                          });
                          if (onToast) onToast('已复制法定注册地址');
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
                    placeholder="请输入企业实际经营或日常办公地址"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition-colors bg-white ${
                      errors.workAddress
                        ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                        : 'border-slate-200 text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2]'
                    }`}
                  />
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
                    {[
                      { val: '商业租赁', desc: '写字楼/商业办公租赁' },
                      { val: '自有产权', desc: '股东或企业商用房产' },
                      { val: '联合办公/众创工位', desc: '众创空间/共享工位' },
                      { val: '居家办公申报', desc: '电商/咨询合规居家申报' },
                    ].map((item) => {
                      const isSelected = (data.workAddressNature || '商业租赁') === item.val;
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
                      <span className="text-[11px] text-slate-400 font-normal">（如租赁合同、物业入驻证明或场地使用协议）</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddSampleProof('work')}
                      className="text-[11px] text-[#2AA894] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>载入示例证明</span>
                    </button>
                  </div>

                  {/* Upload Box */}
                  <input
                    ref={workFileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files, 'work')}
                  />
                  <div
                    onClick={() => workFileInputRef.current?.click()}
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
                              {f.name}
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
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
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
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
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
