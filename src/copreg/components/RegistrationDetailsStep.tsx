/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { RegistrationDetails } from '../types';
import {
  RegistrationFullForm,
  ValidationErrorItem,
  FileAttachment,
  PersonRecord,
} from '../registration/types';
import {
  createBlankForm,
  STORAGE_KEY,
  uid,
} from '../registration/defaultData';
import { BasicInfoSection } from '../registration/BasicInfoSection';
import { ShareholderSection } from '../registration/ShareholderSection';
import { PersonnelSection } from '../registration/PersonnelSection';
import { AuthorizationSection } from '../registration/AuthorizationSection';
import { ReviewSection } from '../registration/ReviewSection';
import { RecordModal } from '../registration/RecordModal';
import { ShareholderTypeModal } from '../registration/ShareholderTypeModal';
import { VerificationModal } from '../registration/VerificationModal';
import { HelpModal } from '../registration/HelpModal';
import { FilePreviewModal } from '../registration/FilePreviewModal';
import { useCustomerServiceQr } from '../../hooks/useCustomerServiceQr';
import { registrationSeedFrom } from '../registrationSeed';
import type { RegistrationPlan, SurveyData } from '../types';
import {
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  Save,
  CheckCircle2,
  AlertCircle,
  Send,
  MessageSquare,
  X,
  FileText,
  Check,
} from 'lucide-react';

interface RegistrationDetailsStepProps {
  details: RegistrationDetails;
  /** 第 1 步问卷：申报表的企业描述 / 业务描述 / 经营范围 / 注册资本等由它转换而来 */
  survey: SurveyData;
  /** 第 2 步方案：名称建议、组织形式、注册资本建议由它转换而来 */
  plan: RegistrationPlan;
  /** 确认/支付步骤用过的手机号（本地不落，拿到就带上） */
  contactPhone?: string;
  onUpdateDetails: (details: RegistrationDetails) => void;
  onSubmitForReview: () => void;
  /**
   * 返回第 3 步的**支付成功页**（`#paid`）：页头与底部操作条两颗「返回办理清单」都走它
   * —— 办理清单（服务进度状态与办理清单）就在那一页上，所以按钮就照那一页的东西命名。
   * （原来是回第 4 步服务群；服务群仍解锁、hash 仍可直达，只是不再是这一页的返回目标。）
   */
  onBackToPaid: () => void;
}

const CHAPTERS = [
  { id: 0, num: '01', title: '基本信息', fullTitle: '企业基本信息' },
  { id: 1, num: '02', title: '股东出资', fullTitle: '股东及出资结构' },
  { id: 2, num: '03', title: '主要人员', fullTitle: '企业主要管理人员' },
  { id: 3, num: '04', title: '委托书办理', fullTitle: '法定代表人委托书签署' },
  { id: 4, num: '05', title: '确认提交', fullTitle: '信息确认并提交初审' },
];

export const RegistrationDetailsStep: React.FC<RegistrationDetailsStepProps> = ({
  details,
  survey,
  plan,
  contactPhone,
  onUpdateDetails,
  onSubmitForReview,
  onBackToPaid,
}) => {
  // Main form state
  const [form, setForm] = useState<RegistrationFullForm>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Partial<RegistrationFullForm> | null;
        if (parsed && parsed.basic && parsed.people) {
          // 存档可能来自旧版本、也可能被手改过：按「空骨架 + 存档覆盖」合并，
          // 缺的字段回落到默认值而不是 undefined —— 之前只检查 basic/people 存在，
          // 一份残缺草稿（如 basic.scope 缺失）会在校验里直接 .trim() 崩掉整页。
          const blank = createBlankForm();
          const next: RegistrationFullForm = {
            ...blank,
            ...parsed,
            basic: { ...blank.basic, ...parsed.basic },
            setup: { ...blank.setup, ...(parsed.setup ?? {}) },
            authorization: { ...blank.authorization, ...(parsed.authorization ?? {}) },
            confirm: { ...blank.confirm, ...(parsed.confirm ?? {}) },
          };
          // 老存档里没有的几项结构默认值（与迁移前的口径一致）
          if (!next.basic.board) next.basic.board = '不设董事会';
          if (!next.basic.singleDirector) next.basic.singleDirector = '由总经理代行职务（不设董事）';
          if (next.basic.unanimous === undefined || next.basic.unanimous === null) next.basic.unanimous = true;
          if (!next.basic.regAddressNature) next.basic.regAddressNature = '租赁用房';
          if (!next.basic.workAddressNature) next.basic.workAddressNature = '商业租赁';
          return next;
        }
      }
    } catch (e) {
      console.warn('Failed to load cached registration form', e);
    }
    // 没有草稿 → 按前面几步的真实数据生成一份（拿不到的字段留空，不再塞假示例）
    return registrationSeedFrom({ survey, plan, contactPhone });
  });

  const [currentChapter, setCurrentChapter] = useState<number>(0);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals state
  const [showTypeModal, setShowTypeModal] = useState<boolean>(false);
  const [editRecordState, setEditRecordState] = useState<{
    kind: 'share' | 'role';
    isNew: boolean;
    recordId?: string;
    targetType?: '自然人' | '企业' | '其他';
  } | null>(null);

  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [showWecomModal, setShowWecomModal] = useState<boolean>(false);

  // 「微信扫码咨询」弹窗里的专属顾问企微码：点开才去查，查到专属码用它，查不到用通用兜底图
  const wecomQr = useCustomerServiceQr(showWecomModal);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const updateForm = (partial: Partial<RegistrationFullForm>) => {
    setForm((prev) => ({ ...prev, ...partial }));
    setIsDirty(true);
  };

  // Validation engine
  const validate = (): ValidationErrorItem[] => {
    const errs: ValidationErrorItem[] = [];
    const add = (
      s: number,
      id: string,
      msg: string,
      record?: { kind: 'share' | 'role'; id: string }
    ) => {
      errs.push({ s, id, msg, record });
    };

    const b = form.basic;
    // Chapter 0: Basic
    if (!b.org) add(0, 'org', '请选择企业组织形式');
    if (b.org === '其他' && !b.orgOther.trim()) add(0, 'orgOther', '请填写具体组织形式');
    if (!b.scope.trim()) add(0, 'scope', '请填写经营范围');
    if (!b.capital.trim() || !/^\d+$/.test(b.capital.trim()) || Number(b.capital.trim()) <= 0) {
      add(0, 'capital', '注册资本需填写大于 0 的非负整数金额（万元）');
    }
    if (!b.names.some((n) => n.trim().length > 0)) {
      add(0, 'name-0', '请至少填写一个拟注册名称');
    }
    b.names.forEach((n, idx) => {
      if (idx >= 3 && !n.trim()) {
        add(0, `name-${idx}`, `请填写新增的第 ${idx + 1} 个企业名称，或移除该项`);
      }
    });
    // 法定注册地址校验
    if (!b.regRecommend) {
      if (!b.regAddress?.trim()) {
        add(0, 'regAddress', '请填写法定注册详细地址，或勾选由服务商提供');
      }
      if (!b.regAddressNature) {
        add(0, 'regAddressNature', '未勾选由服务商提供时，需选择法定注册地址性质');
      }
      if (!b.regFiles || b.regFiles.length === 0) {
        add(0, 'regFiles', '未勾选由服务商提供时，需上传法定注册场地证明材料');
      }
    }

    // 实际经营办公地址校验
    if (!b.workRecommend) {
      if (!b.workAddress?.trim()) {
        add(0, 'workAddress', '请填写实际经营办公地址，或勾选由服务商提供');
      }
      if (!b.workAddressNature) {
        add(0, 'workAddressNature', '未勾选由服务商提供时，需选择实际经营办公地址性质');
      }
      if (!b.workFiles || b.workFiles.length === 0) {
        add(0, 'workFiles', '未勾选由服务商提供时，需上传实际经营办公场地证明材料');
      }
    }

    if (b.board === '设董事会') {
      const dNum = Number(b.directors);
      if (!b.directors || isNaN(dNum) || dNum < 3) {
        add(0, 'directors', '设立董事会成员人数至少为 3 人');
      }
    }
    if (b.singleSupervisor === '不设监事' && b.unanimous === false) {
      add(0, 'unanimous', '不设监事须经全体股东一致同意确认');
    }

    // Chapter 1: Shareholders
    if (form.shareholders.length < 1) {
      add(1, 'shareholders', '请添加至少 1 位股东');
    }
    form.shareholders.forEach((s, idx) => {
      const p = s.personId ? form.people[s.personId] : null;
      const title = s.type === '自然人' ? p?.name || '未命名' : s.name || '未命名';
      const prefix = `股东 ${idx + 1}（${title}）：`;
      const sErrors: string[] = [];

      if (s.type === '自然人') {
        if (!p?.name.trim()) sErrors.push('请填写姓名');
        if (!p?.phone.trim()) sErrors.push('请填写联系电话');
        if (!p?.address.trim()) sErrors.push('请填写居住地址');
        const hasFront = (p?.files || []).some((f) => f.slot === 'idFront');
        const hasBack = (p?.files || []).some((f) => f.slot === 'idBack');
        if (!hasFront || !hasBack) sErrors.push('请补齐身份证人像面和国徽面照片');
      } else if (s.type === '企业') {
        if (!s.name.trim()) sErrors.push('请填写企业全称');
        if (!s.code.trim()) sErrors.push('请填写统一社会信用代码');
        const hasLicense = (s.files || []).some((f) => f.slot === 'license');
        if (!hasLicense) sErrors.push('请上传加盖公章的营业执照照片');
      } else {
        if (!s.name.trim()) sErrors.push('请填写股东说明');
      }

      const ratioNum = Number(s.ratio);
      if (!s.ratio || isNaN(ratioNum) || ratioNum <= 0 || ratioNum > 100) {
        sErrors.push('出资比例需大于 0 且不超过 100%');
      }
      if (s.amount && (isNaN(Number(s.amount)) || Number(s.amount) < 0)) {
        sErrors.push('出资金额需为非负数字');
      }

      if (sErrors.length > 0) {
        add(1, `share-${s.id}`, prefix + sErrors.join('；'), { kind: 'share', id: s.id });
      }
    });

    // Chapter 2: Key Personnel
    const assignedRoles = form.roles.flatMap((r) => r.roles);
    const requiredRoles = ['法定代表人', '财务负责人', '联系人'];

    const hasDirector =
      b.board === '设董事会' ||
      b.singleDirector === '设 1 名董事' ||
      b.singleDirector === '设1名董事' ||
      b.singleDirector === '董事';

    const hasSupervisor =
      b.singleSupervisor === '设 1 名监事' ||
      b.singleSupervisor === '设1名监事' ||
      b.singleSupervisor === '一名监事';

    const hasGeneralManagerExercising =
      b.board === '不设董事会' &&
      (b.singleDirector?.includes('总经理') ||
       b.singleDirector?.includes('代行') ||
       b.singleDirector?.includes('经理') ||
       !hasDirector);

    if (hasDirector) requiredRoles.push('董事');
    if (hasGeneralManagerExercising) requiredRoles.push('总经理');
    if (hasSupervisor) requiredRoles.push('监事');

    requiredRoles.forEach((reqRole) => {
      if (!assignedRoles.includes(reqRole)) {
        add(2, 'roles', `根据基本信息设置要求，主要管理人员必须指定【${reqRole}】`);
      }
    });

    form.roles.forEach((r, idx) => {
      const p = form.people[r.personId];
      const pErrors: string[] = [];
      if (!p?.name.trim()) pErrors.push('请填写姓名');
      if (!p?.phone.trim()) pErrors.push('请填写电话');
      if (!p?.address.trim()) pErrors.push('请填写居住地址');
      if (!r.roles || r.roles.length === 0) pErrors.push('请选择人员角色');

      if (r.roles.includes('监事')) {
        const conflicts = r.roles.filter((x) =>
          ['董事', '法定代表人', '总经理', '财务负责人'].includes(x)
        );
        if (conflicts.length > 0) {
          pErrors.push(`依据《公司法》规定，监事不得兼任【${conflicts.join('、')}】职务`);
        }
      }

      const hasFront = (p?.files || []).some((f) => f.slot === 'idFront');
      const hasBack = (p?.files || []).some((f) => f.slot === 'idBack');
      if (!hasFront || !hasBack) pErrors.push('请补齐身份证正反面照片');

      if (pErrors.length > 0) {
        add(2, `role-${r.id}`, `主要人员 ${idx + 1}（${p?.name || '未命名'}）：${pErrors.join('；')}`, {
          kind: 'role',
          id: r.id,
        });
      }
    });

    // Chapter 3: Authorization
    if (!form.authorization.files || form.authorization.files.length === 0) {
      add(3, 'auth', '请上传已签字盖章的法定代表人委托书');
    }

    // Chapter 4: Confirm
    if (!form.confirm.accurate) {
      add(4, 'accurate', '请勾选信息真实性确认');
    }

    return errs;
  };

  const allErrors = useMemo(() => validate(), [form]);

  // Chapter completion states
  const chapterStates = useMemo(() => {
    return [0, 1, 2, 3, 4].map((chIdx) => {
      const chErrors = allErrors.filter((e) => e.s === chIdx);
      return chErrors.length === 0 ? 'complete' : 'partial';
    });
  }, [allErrors]);

  const completedCount = chapterStates.filter((s) => s === 'complete').length;
  const currentChapterErrors = allErrors.filter((e) => e.s === currentChapter);
  const currentErrorsMap = useMemo(() => {
    const map: Record<string, string> = {};
    currentChapterErrors.forEach((e) => {
      map[e.id] = e.msg;
    });
    return map;
  }, [currentChapterErrors]);

  // Save draft locally
  const handleSaveDraft = (silent = false) => {
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
    const snapshot: RegistrationFullForm = {
      ...form,
      savedAt: nowStr,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      setForm(snapshot);
      setIsDirty(false);
      if (!silent) showToast(`申报草稿已成功保存 · ${nowStr}`);
      return true;
    } catch (e) {
      showToast('草稿保存完成');
      return false;
    }
  };

  const handleRefillFromPlan = () => {
    setForm(registrationSeedFrom({ survey, plan, contactPhone }));
    setIsDirty(true);
    setShowHelpModal(false);
    showToast('已按前面步骤的方案重新填充申报表');
  };

  // Step Navigation
  const handleGoChapter = (chIdx: number) => {
    setCurrentChapter(Math.max(0, Math.min(4, chIdx)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = () => {
    if (currentChapter < 4) {
      handleGoChapter(currentChapter + 1);
    }
  };

  const handlePrev = () => {
    if (currentChapter > 0) {
      handleGoChapter(currentChapter - 1);
    }
  };

  // Submit trigger
  const handleSubmitStart = () => {
    if (form.status === 'submitted') {
      showToast('正在前往“服务进度状态与办理清单”...');
      onSubmitForReview();
      return;
    }
    if (allErrors.length > 0) {
      const firstErr = allErrors[0];
      handleGoChapter(firstErr.s);
      showToast(`仍有 ${allErrors.length} 项信息待完善，请先补充`);
      return;
    }
    setShowVerifyModal(true);
  };

  // Verification success
  const handleVerifySuccess = (phone: string) => {
    setShowVerifyModal(false);
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
    const updated: RegistrationFullForm = {
      ...form,
      status: 'submitted',
      submittedAt: nowStr,
      submissionPhone: phone,
    };
    setForm(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}

    /**
     * 把申报表回写成「办理进度」页用的摘要（企业名称、法定代表人、收件地址、股东结构）。
     *
     * 只搬申报表里确实存在的值：上游这里曾经用一套写死的示例姓名 / 证件号 / 邮箱兜底，
     * 空白申报表会被回写成一份假身份，进度页也就分不清哪些是真填的。
     * 申报表里没有的字段（身份证号）保持原值，进度页对空值显示占位。
     */
    const firstFilled = (list: string[]) => list.find((item) => item.trim().length > 0) ?? '';

    const personInRole = (role: string) => {
      const record = form.roles.find((item) => item.roles.includes(role));
      return record ? form.people[record.personId] ?? null : null;
    };

    const repPerson = personInRole('法定代表人');
    const financePerson = personInRole('财务负责人');
    const supervisorPerson = personInRole('监事');

    onUpdateDetails({
      ...details,
      primaryName: firstFilled(form.basic.names),
      backupName1: form.basic.names[1]?.trim() ?? '',
      backupName2: form.basic.names[2]?.trim() ?? '',
      registeredCapital: form.basic.capital ? `${form.basic.capital} 万元人民币` : '',
      legalRepresentative: {
        name: repPerson?.name ?? '',
        // 申报表只收身份证正反面照片，没有证件号文本，这里补不出来
        idCard: details.legalRepresentative.idCard,
        phone: repPerson?.phone || phone,
        email: repPerson?.email ?? '',
      },
      supervisor: {
        name: supervisorPerson?.name ?? details.supervisor.name,
        idCard: details.supervisor.idCard,
        phone: supervisorPerson?.phone ?? details.supervisor.phone,
      },
      financeOfficer: {
        name: financePerson?.name ?? details.financeOfficer.name,
        idCard: details.financeOfficer.idCard,
        phone: financePerson?.phone ?? details.financeOfficer.phone,
      },
      shareholders: form.shareholders.map((s) => {
        const sp = s.personId ? form.people[s.personId] ?? null : null;
        return {
          id: s.id,
          name: s.type === '自然人' ? sp?.name ?? '' : s.name,
          idCard: '',
          phone: sp?.phone ?? phone,
          // 转不出数字就给 0，不编一个「看着像真的」的股比与出资额
          ratio: Number(s.ratio) || 0,
          capitalAmount: Number(s.amount) || 0,
        };
      }),
      // 进度页的「收件地址」：执照与印章按实际经营地址寄送，没填就退回注册地址
      officeAddress: {
        ...details.officeAddress,
        region: form.basic.workAddress?.trim() || form.basic.regAddress?.trim() || '',
      },
    });

    showToast('申报资料已成功提交！正在跳转到“服务进度状态与办理清单”...');
    setTimeout(() => {
      onSubmitForReview();
    }, 400);
  };

  // Modal Save/Delete Handlers
  const handleSaveModalRecord = (payload: {
    kind: 'share' | 'role';
    isNew: boolean;
    record: any;
    person?: PersonRecord;
    linked: boolean;
  }) => {
    const { kind, isNew, record, person, linked } = payload;
    const nextPeople = { ...form.people };

    if (person) {
      if (!record.personId) {
        record.personId = person.id || uid();
      }
      nextPeople[record.personId] = { ...person, id: record.personId };
    }

    if (kind === 'share') {
      let nextShareholders = [...form.shareholders];
      if (isNew) {
        nextShareholders.push(record);
      } else {
        nextShareholders = nextShareholders.map((s) => (s.id === record.id ? record : s));
      }
      setForm((prev) => ({
        ...prev,
        people: nextPeople,
        shareholders: nextShareholders,
      }));
    } else {
      let nextRoles = [...form.roles];
      if (isNew) {
        nextRoles.push(record);
      } else {
        nextRoles = nextRoles.map((r) => (r.id === record.id ? record : r));
      }
      setForm((prev) => ({
        ...prev,
        people: nextPeople,
        roles: nextRoles,
      }));
    }

    setIsDirty(true);
    setEditRecordState(null);
    showToast('记录已保存');
  };

  const handleDeleteModalRecord = () => {
    if (!editRecordState || editRecordState.isNew || !editRecordState.recordId) return;
    const { kind, recordId } = editRecordState;

    if (kind === 'share') {
      setForm((prev) => ({
        ...prev,
        shareholders: prev.shareholders.filter((s) => s.id !== recordId),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        roles: prev.roles.filter((r) => r.id !== recordId),
      }));
    }

    setIsDirty(true);
    setEditRecordState(null);
    showToast('记录已删除');
  };

  return (
    <div className="pb-32">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#36B39E]" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-4">
        {/* ==================== INDEPENDENT MODULE HEADING ==================== */}
        <section className="mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#1D6C5E] border border-[#2AA894]/30 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2AA894]" />
              <span className="font-bold">独立业务模块</span>
              <span className="text-[#2AA894]">·</span>
              <span>企业注册申报资料填报与初审</span>
            </div>

            <button
              type="button"
              onClick={onBackToPaid}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span>返回办理清单</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1.5 text-slate-900">
                <span className="text-[#1D6C5E]">企业注册申报资料填报与初审</span>
              </h1>
              <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                本模块为独立的政务设立申报资料采集与初审系统。请按标准化指引完善企业基本信息、股东及出资结构、主要人员及法定代表人委托书，初审通过后将自动对接政务审批团队办理。
              </p>
            </div>
          </div>
        </section>

        {/* ==================== DELICATE CONNECTED CIRCLE STEPPER (NO BOXES) ==================== */}
        <div className="mb-6 pt-1 px-1">
          <div className="relative">
            {/* Connecting Track Line behind circles (center aligned with w-6 circles, top-3 = 12px) */}
            <div className="absolute top-3 left-[10%] right-[10%] h-[1.5px] bg-slate-200/80 -z-0 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2AA894] to-[#36B39E] transition-all duration-500 ease-out rounded-full"
                style={{
                  width: `${(Math.max(currentChapter, completedCount) / (CHAPTERS.length - 1)) * 100}%`,
                }}
              />
            </div>

            {/* 5 Connected Circle Step Nodes */}
            <div className="grid grid-cols-5 relative z-10">
              {CHAPTERS.map((ch) => {
                const isActive = currentChapter === ch.id;
                const isCompleted = chapterStates[ch.id] === 'complete';
                const stepNumber = ch.id + 1;

                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleGoChapter(ch.id)}
                    className="group flex flex-col items-center text-center cursor-pointer focus:outline-none transition-all"
                  >
                    {/* Compact Circle Node */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-bold transition-all duration-200 ${
                        isActive
                          ? 'bg-white border-2 border-[#2AA894] text-[#1D6C5E] ring-3 ring-[#2AA894]/20 shadow-2xs'
                          : isCompleted
                          ? 'bg-[#2AA894] text-white shadow-2xs group-hover:bg-[#239983]'
                          : 'bg-white border border-slate-200 text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : (
                        stepNumber
                      )}
                    </div>

                    {/* Step Title Label */}
                    <span
                      className={`mt-1.5 text-xs sm:text-[13px] tracking-tight truncate max-w-full px-1 transition-colors ${
                        isActive
                          ? 'text-[#1D6C5E] font-bold'
                          : isCompleted
                          ? 'text-slate-700 font-medium group-hover:text-slate-900'
                          : 'text-slate-400 font-normal group-hover:text-slate-600'
                      }`}
                    >
                      {ch.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Current Chapter Error Banner */}
        {currentChapterErrors.length > 0 && (
          <div className="mb-5 p-4 rounded-xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-800 space-y-1 animate-in fade-in">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>本章节尚有 {currentChapterErrors.length} 项需完善，填写完成后可继续下一步：</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-amber-700 text-[11px]">
              {currentChapterErrors.map((e, i) => (
                <li key={i}>{e.msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ==================== ACTIVE CHAPTER CONTENT ==================== */}
        <div>
          {currentChapter === 0 && (
            <BasicInfoSection
              data={form.basic}
              onChange={(basic) => updateForm({ basic })}
              errors={currentErrorsMap}
              onPreviewFile={(file) => setPreviewFile(file)}
              onToast={showToast}
            />
          )}

          {currentChapter === 1 && (
            <ShareholderSection
              shareholders={form.shareholders}
              people={form.people}
              onAddShareholder={() => setShowTypeModal(true)}
              onEditShareholder={(id) => {
                setEditRecordState({ kind: 'share', isNew: false, recordId: id });
              }}
              errors={currentErrorsMap}
            />
          )}

          {currentChapter === 2 && (
            <PersonnelSection
              roles={form.roles}
              people={form.people}
              basic={form.basic}
              onAddPersonnel={() => {
                setEditRecordState({ kind: 'role', isNew: true });
              }}
              onEditPersonnel={(id) => {
                setEditRecordState({ kind: 'role', isNew: false, recordId: id });
              }}
              onGoBasic={() => handleGoChapter(0)}
              errors={currentErrorsMap}
            />
          )}

          {currentChapter === 3 && (
            <AuthorizationSection
              data={form.authorization}
              roles={form.roles}
              people={form.people}
              onChange={(authorization) => updateForm({ authorization })}
              onPreviewFile={(file) => setPreviewFile(file)}
              onToast={showToast}
            />
          )}

          {currentChapter === 4 && (
            <ReviewSection
              form={form}
              onGoChapter={handleGoChapter}
              onUpdateConfirm={(confirmPartial) => {
                updateForm({ confirm: { ...form.confirm, ...confirmPartial } });
              }}
              onPreviewFile={(file) => setPreviewFile(file)}
              onProceedToDelivery={onSubmitForReview}
              errors={currentErrorsMap}
            />
          )}
        </div>
      </div>

      {/* ==================== STICKY BOTTOM ACTION BAR (MATCHING SYSTEM STYLE) ==================== */}
      <div className="fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-3 px-4 sm:px-6 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={currentChapter === 0 ? onBackToPaid : handlePrev}
              className="px-3.5 sm:px-5 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{currentChapter === 0 ? '返回办理清单' : '上一项'}</span>
            </button>

            {/* 草稿已保存 / 保存草稿 */}
            <button
              type="button"
              onClick={() => handleSaveDraft(false)}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="点击手动保存当前填报草稿"
            >
              <Save className="w-3.5 h-3.5 text-[#36B39E]" />
              <span>{isDirty ? '保存草稿' : '草稿已保存'}</span>
            </button>

            {/* 填报须知 */}
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="查看填报规范与申报指引"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>填报须知</span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:block text-right">
              <span className="text-[11px] text-slate-400 block">
                {form.savedAt ? `已自动保存 ${form.savedAt}` : '带 * 字段为必填项'}
              </span>
            </div>

            {currentChapter < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 sm:px-6 py-2.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>下一项</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitStart}
                className="px-6 sm:px-7 py-2.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#36B39E]/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>确认并提交申请</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================== DIALOG MODALS ==================== */}

      {/* Shareholder Type Modal */}
      {showTypeModal && (
        <ShareholderTypeModal
          onSelect={(type) => {
            setShowTypeModal(false);
            setEditRecordState({
              kind: 'share',
              isNew: true,
              targetType: type,
            });
          }}
          onClose={() => setShowTypeModal(false)}
        />
      )}

      {/* Record Editor Modal */}
      {editRecordState && (
        <RecordModal
          kind={editRecordState.kind}
          isNew={editRecordState.isNew}
          shareRecord={
            editRecordState.kind === 'share'
              ? editRecordState.isNew
                ? {
                    id: uid(),
                    type: editRecordState.targetType || '自然人',
                    personId: null,
                    name: '',
                    code: '',
                    ratio: '',
                    amount: '',
                    method: ['货币'],
                    files: [],
                  }
                : form.shareholders.find((s) => s.id === editRecordState.recordId)
              : undefined
          }
          roleRecord={
            editRecordState.kind === 'role'
              ? editRecordState.isNew
                ? {
                    id: uid(),
                    personId: '',
                    roles: [],
                  }
                : form.roles.find((r) => r.id === editRecordState.recordId)
              : undefined
          }
          people={form.people}
          existingRoles={form.roles}
          basic={form.basic}
          onSave={handleSaveModalRecord}
          onDelete={handleDeleteModalRecord}
          onClose={() => setEditRecordState(null)}
          onPreviewFile={(file) => setPreviewFile(file)}
        />
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <HelpModal
          onRefillFromPlan={handleRefillFromPlan}
          onClose={() => setShowHelpModal(false)}
          onOpenWecom={() => setShowWecomModal(true)}
        />
      )}

      {/* SMS Phone Verification Modal */}
      {showVerifyModal && (
        <VerificationModal
          defaultPhone={form.submissionPhone || contactPhone || ''}
          onVerifySuccess={handleVerifySuccess}
          onClose={() => setShowVerifyModal(false)}
        />
      )}

      {/* WeCom QR Code Modal */}
      {showWecomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#2AA894]" />
                <span className="text-xs font-bold text-slate-800">专属顾问企业微信</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWecomModal(false)}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="w-36 h-36 mx-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col items-center justify-center my-2">
              {wecomQr.loading ? (
                <span className="text-[11px] text-slate-400 leading-relaxed px-2">
                  正在获取专属顾问二维码…
                </span>
              ) : (
                <img src={wecomQr.url} alt="专属顾问企业微信二维码" className="w-full h-full object-contain" />
              )}
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 inline-block mt-1">
              企业微信官方认证
            </span>
            <p className="text-[11px] text-slate-400 mt-2">微信扫一扫添加，专属顾问全程跟进代办</p>
          </div>
        </div>
      )}
    </div>
  );
};
