import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Download, HelpCircle, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { RecordDialog, type EditTarget } from './dialogs';
import { exportDraft, importDraftFile, loadDraft, nowStamp, storeDraft } from './draft';
import { HelpDialog } from './help';
import {
  SHORT,
  SUBS,
  TITLES,
  clone,
  emptyPerson,
  initial,
  isPureNatural,
  personOf,
  uid,
  type ApplicationData,
  type ConfirmInfo,
  type RoleRecord,
  type Person,
  type ShareType,
  type Shareholder,
  type ValidationError,
} from './model';
import { ReviewStep } from './review';
import { sectionTouched, setupComplete, validate } from './schema';
import { BasicStep, PersonnelStep, SetupStep, ShareholderStep } from './steps';
import { Dialog, Field, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_BUTTON } from './ui';

type SectionState = 'blank' | 'partial' | 'complete';

const STATE_LABEL: Record<SectionState, string> = {
  blank: '空白',
  partial: '不完整',
  complete: '全部填写完成',
};

/** 章节导航：桌面端放在侧栏，窄屏放在正文顶部（标签改用简称） */
function NavList({
  labels,
  step,
  states,
  onGo,
  compact = false,
}: {
  labels: readonly string[];
  step: number;
  states: SectionState[];
  onGo: (index: number) => void;
  compact?: boolean;
}) {
  return (
    <nav
      className={compact ? 'grid grid-cols-2 gap-1.5' : 'mt-4 grid gap-1.5'}
      aria-label="申请章节"
    >
      {labels.map((label, index) => (
        <button
          key={label}
          type="button"
          onClick={() => onGo(index)}
          aria-current={index === step ? 'step' : undefined}
          title={`${TITLES[index]}：${STATE_LABEL[states[index]]}`}
          className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
            index === step
              ? 'border-[#66cdb5]/60 bg-[#e8f7f3] font-bold text-[#3f7d6d]'
              : 'border-transparent text-stone-500 hover:bg-stone-100'
          }`}
        >
          <span className="text-[10px] font-bold text-stone-400">{String(index + 1).padStart(2, '0')}</span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span
            aria-label={STATE_LABEL[states[index]]}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
              states[index] === 'complete'
                ? 'bg-[#66cdb5] text-white'
                : states[index] === 'partial'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-stone-200'
            }`}
          >
            {states[index] === 'complete' ? <Check size={10} aria-hidden="true" /> : null}
          </span>
        </button>
      ))}
    </nav>
  );
}

const SHARE_TYPE_CARDS: Array<{ type: ShareType; icon: string; desc: string }> = [
  { type: '自然人', icon: '♙', desc: '个人股东' },
  { type: '企业', icon: '▦', desc: '企业法人股东' },
  { type: '其他', icon: '◇', desc: '其他组织或主体' },
];

type ModalState =
  | { kind: 'type' }
  | { kind: 'record'; target: EditTarget; error: string }
  | { kind: 'verify' }
  | { kind: 'help' }
  | null;

export default function RegistrationApp() {
  const [data, setData] = useState<ApplicationData>(initial);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 短信验证是本地演示：验证码只在页面上显示，不发送也不校验真实短信
  const [sms, setSms] = useState<{ phone: string; code: string; expires: number } | null>(null);
  const [verifyPhone, setVerifyPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');

  const errors = useMemo<ValidationError[]>(() => (attempted ? validate(data) : []), [attempted, data]);

  useEffect(() => {
    let alive = true;
    loadDraft()
      .then((found) => {
        if (alive && found) setData(found);
      })
      .catch(() => setToast('读取本地草稿失败，已从空白申请开始'))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  /** 任何填写动作都会让「信息确认」与「免申报承诺」失效，需要重新勾选 */
  const update = (mutate: (draft: ApplicationData) => ApplicationData) => {
    setData((current) => {
      const next = mutate(current);
      return {
        ...next,
        status: 'draft',
        submittedAt: null,
        confirm: { ...next.confirm, accurate: false, exemption: false },
      };
    });
    setDirty(true);
  };

  const patchBasic = (patch: Partial<ApplicationData['basic']>) =>
    update((draft) => ({ ...draft, basic: { ...draft.basic, ...patch } }));

  const patchSetup = (patch: Partial<ApplicationData['setup']>) =>
    update((draft) => ({ ...draft, setup: { ...draft.setup, ...patch } }));

  const patchConfirm = (patch: Partial<ConfirmInfo>) => {
    setData((current) => {
      const next = { ...current.confirm, ...patch };
      if (patch.exemption !== undefined) {
        // 只有全部为自然人股东时免申报承诺才成立
        next.exemption = patch.exemption && isPureNatural(current);
        next.accurate = false;
      }
      return { ...current, confirm: next, status: 'draft', submittedAt: null };
    });
    setDirty(true);
  };

  const addName = () =>
    update((draft) => ({ ...draft, basic: { ...draft.basic, names: [...draft.basic.names, ''] } }));

  const removeName = (index: number) =>
    update((draft) => ({
      ...draft,
      basic: { ...draft.basic, names: draft.basic.names.filter((_, at) => at !== index) },
    }));

  /* ------------------------------------------------------------ 记录编辑 */

  const openRecord = (kind: 'share' | 'role', id: string | null = null, type: ShareType = '自然人') => {
    const list: Array<Shareholder | RoleRecord> = kind === 'share' ? data.shareholders : data.roles;
    const source = id ? (list.find((item) => item.id === id) ?? null) : null;
    const record: Shareholder | RoleRecord = source
      ? clone(source)
      : kind === 'share'
        ? { id: uid(), type, personId: null, name: '', code: '', ratio: '', amount: '', method: [], files: [] }
        : { id: uid(), personId: null, roles: [] };
    const person = record.personId ? clone(personOf(data, record)) : emptyPerson();
    const shared = Boolean(
      record.personId &&
        [...data.shareholders, ...data.roles].some(
          (item) => item.id !== record.id && item.personId === record.personId,
        ),
    );
    setModal({
      kind: 'record',
      target: { kind, isNew: !source, record, person, linked: Boolean(record.personId) && (!source || shared) },
      error: '',
    });
  };

  /** 打开记录并按报错定位，用于错误摘要里的跳转 */
  const openRecordWithError = (kind: 'share' | 'role', id: string, error: string) => {
    openRecord(kind, id);
    setModal((current) => (current?.kind === 'record' ? { ...current, error } : current));
  };

  const saveRecord = (
    kind: 'share' | 'role',
    payload: { record: Shareholder | RoleRecord; person: Person; linked: boolean; isNew: boolean; attachmentsDirty: boolean },
  ) => {
    const share = kind === 'share';
    update((draft) => {
      const natural = !share || (payload.record as Shareholder).type === '自然人';
      const people = { ...draft.people };
      let personId = payload.record.personId;

      if (natural) {
        if (!payload.linked) {
          // 手动填写或关联后取消关联：写入（或新建）一条人员
          personId = personId ?? uid();
          people[personId] = clone(payload.person);
        } else if (personId && payload.attachmentsDirty) {
          // 关联人员时基础信息不可改，只有附件允许回写
          people[personId] = { ...people[personId], files: clone(payload.person.files) };
        }
      }

      const next = { ...payload.record, personId };
      const replace = <T extends { id: string }>(list: T[]) =>
        payload.isNew
          ? [...list, next as unknown as T]
          : list.map((item) => (item.id === next.id ? (next as unknown as T) : item));

      const shareholders = share ? replace(draft.shareholders) : draft.shareholders;
      const roles = share ? draft.roles : replace(draft.roles);

      // 没人引用的人员不再保留，避免草稿里堆积孤儿数据
      const referenced = new Set(
        [...shareholders.map((item) => item.personId), ...roles.map((item) => item.personId)].filter(Boolean),
      );

      return {
        ...draft,
        shareholders,
        roles,
        people: Object.fromEntries(Object.entries(people).filter(([id]) => referenced.has(id))),
      };
    });
    setModal(null);
  };

  const deleteRecord = (kind: 'share' | 'role') => {
    if (modal?.kind !== 'record') return;
    const { record } = modal.target;
    if (!window.confirm('删除此条记录？其他模块中已关联的人员仍会保留。')) return;
    update((draft) => {
      const shareholders = kind === 'share' ? draft.shareholders.filter((item) => item.id !== record.id) : draft.shareholders;
      const roles = kind === 'share' ? draft.roles : draft.roles.filter((item) => item.id !== record.id);
      const referenced = new Set(
        [...shareholders.map((item) => item.personId), ...roles.map((item) => item.personId)].filter(Boolean),
      );
      return {
        ...draft,
        shareholders,
        roles,
        people: Object.fromEntries(Object.entries(draft.people).filter(([id]) => referenced.has(id))),
      };
    });
    setModal(null);
    setToast('记录已删除');
  };

  /* -------------------------------------------------------------- 暂存 */

  /** 暂存快照；patch 用于提交这类需要连同状态一起写盘的动作 */
  const save = async (
    quiet = false,
    patch: Partial<ApplicationData> = {},
  ): Promise<ApplicationData | null> => {
    const stamp = patch.savedAt ?? nowStamp();
    const snapshot: ApplicationData = { ...clone(data), ...patch, savedAt: stamp };
    try {
      await storeDraft(snapshot);
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : '暂存失败');
      return null;
    }
    setData(snapshot);
    setDirty(false);
    if (!quiet) setToast(`草稿及附件已暂存 · ${stamp}`);
    return snapshot;
  };

  const importDraft = async (file: File) => {
    try {
      const imported = await importDraftFile(file);
      setData(imported);
      setDirty(true);
      setAttempted(false);
      setStep(0);
      setModal(null);
      setToast('草稿已导入，暂存后写入当前浏览器');
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : '草稿导入失败');
    }
  };

  /* -------------------------------------------------------------- 提交 */

  const go = (target: number) => {
    setStep(Math.max(0, Math.min(TITLES.length - 1, target)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitStart = () => {
    setAttempted(true);
    const found = validate(data);
    if (found.length) {
      setErrorsOnFirst(found);
      return;
    }
    go(TITLES.length - 1);
    setSms(null);
    setVerifyError('');
    setModal({ kind: 'verify' });
  };

  const setErrorsOnFirst = (found: ValidationError[]) => {
    go(found[0].section);
    setToast(`请先完善 ${found.length} 项信息`);
    setTimeout(() => jumpError(found, 0), 60);
  };

  const jumpError = (found: ValidationError[], index: number) => {
    const target = found[index];
    if (!target) return;
    go(target.section);
    if (target.record) {
      openRecordWithError(target.record.kind, target.record.id, target.msg);
      return;
    }
    document.getElementById(target.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /** 只分享空白入口，链接里不含申请数据 */
  const copyLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.hash = '';
      await navigator.clipboard.writeText(url.href);
      setToast('已复制页面入口；不包含申请数据，不能跨设备查看草稿');
    } catch {
      setToast('无法访问剪贴板，请复制浏览器地址');
    }
  };

  const sendDemoCode = () => {
    if (!/^1\d{10}$/.test(verifyPhone.trim())) {
      setVerifyError('请输入有效的 11 位中国大陆手机号码');
      return;
    }
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const code = String(100000 + (values[0] % 900000));
    setSms({ phone: verifyPhone.trim(), code, expires: Date.now() + 300_000 });
    setVerifyError('');
    setVerifyCode('');
  };

  const verifySubmit = async (found: ValidationError[]) => {
    if (!sms) {
      setVerifyError('请先获取演示验证码');
      return;
    }
    if (
      Date.now() > sms.expires ||
      verifyPhone.trim() !== sms.phone ||
      verifyCode.trim() !== sms.code
    ) {
      setVerifyError('手机号或验证码不匹配，或验证码已过期');
      return;
    }
    if (found.length) {
      setModal(null);
      setErrorsOnFirst(found);
      return;
    }
    // 状态与提交时间要一起写进草稿，否则刷新后提交记录会丢失
    const stamp = nowStamp();
    const saved = await save(true, {
      status: 'submitted',
      submittedAt: stamp,
      savedAt: stamp,
      submissionPhone: sms.phone,
    });
    if (!saved) return;
    setModal(null);
    setToast('演示提交已完成，申请已保存在当前浏览器');
  };

  /* ------------------------------------------------------------ 导航状态 */

  const sectionStates = TITLES.map((_, index) => {
    if (!sectionTouched(data, index)) return 'blank' as SectionState;
    if (index === 3 && !setupComplete(data.setup)) return 'partial' as SectionState;
    return errors.some((error) => error.section === index) ? 'partial' : 'complete';
  });
  const completed = sectionStates.filter((state) => state === 'complete').length;
  const visibleErrors = errors.filter((error) => error.section === step);
  /** 落在具体元素上的报错，交给各步骤页内联显示 */
  const fieldErrors = visibleErrors.reduce<Record<string, string>>(
    (acc, error) => ({ ...acc, [error.id]: error.msg }),
    {},
  );
  const errorAt = (id: string) => fieldErrors[id];

  const recordsIn = (kind: 'share' | 'role') =>
    Object.fromEntries(
      errors
        .filter((error) => error.section === (kind === 'share' ? 1 : 2) && error.record?.kind === kind)
        .map((error) => [error.record!.id, error.msg]),
    );

  const status = dirty ? '填写中' : data.status === 'submitted' ? '已演示提交' : data.savedAt ? '已暂存' : '填写中';
  const saveLabel = dirty
    ? '有修改，尚未暂存'
    : data.savedAt
      ? `已暂存 ${data.savedAt}`
      : '草稿尚未暂存';

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-stone-400">正在载入本地草稿…</div>;
  }

  return (
    <div className="registration-app min-h-screen bg-stone-50 pb-32 text-stone-800">
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between gap-4 border-b border-stone-200 bg-white px-[max(28px,calc((100vw_-_1224px)/2))]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#66cdb5] text-sm font-black text-white">
            b
          </span>
          <span className="truncate text-sm font-bold">
            班步一企通
            <small className="ml-2 text-[10px] font-medium tracking-widest text-stone-400">BANBU ONEBIZ</small>
          </span>
          <span className="hidden border-l border-stone-200 pl-3 text-xs text-stone-500 sm:block">企业设立服务</span>
        </div>
        <span className="hidden text-xs text-stone-500 sm:block">企业注册服务申请</span>
      </header>

      <div className="mx-auto flex max-w-[1280px] gap-10 px-7 pt-[34px]">
        <aside className="hidden w-[220px] shrink-0 self-start lg:sticky lg:top-[108px] lg:block">
          <p className="text-[10px] font-bold tracking-[2px] text-[#42a98f]">COMPANY INCORPORATION</p>
          <h2 className="mt-1 text-[19px] font-bold">开启您的企业旅程</h2>
          <div className="mt-5 flex items-center justify-between text-xs text-stone-500">
            <span>申请填写进度</span>
            <span>
              {completed} / {TITLES.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-[#66cdb5] transition-all"
              style={{ width: `${(completed / TITLES.length) * 100}%` }}
            />
          </div>

          <NavList labels={TITLES} step={step} states={sectionStates} onGo={go} />

          <p className="mt-5 rounded-xl bg-white p-4 text-[11px] leading-5 text-stone-500">
            <strong className="mb-1 block text-stone-700">按您的节奏，安心填写</strong>
            可随时暂存，稍后继续。已有人员可直接复用，无需重复填写与上传。
          </p>
          <p className="mt-4 text-[11px] leading-5 text-stone-400">
            企业申请人 · 企业设立服务人员
            <br />
            申请表版本 2026.09.14
          </p>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-5 lg:hidden">
            <NavList labels={SHORT} step={step} states={sectionStates} onGo={go} compact />
          </div>

          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[2px] text-[#42a98f]">
                APPLICATION / {String(step + 1).padStart(2, '0')}
              </p>
              <h1 className="mt-1 text-[29px] font-bold leading-[1.3] tracking-[-0.7px]">{TITLES[step]}</h1>
              <p className="mt-1 text-[13px] text-stone-500">{SUBS[step]}</p>
            </div>
            <div className="text-right">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500">{status}</span>
              <p className="mt-1.5 text-[10px] font-bold tracking-widest text-stone-400">
                STEP {String(step + 1).padStart(2, '0')} / {String(TITLES.length).padStart(2, '0')}
              </p>
            </div>
          </div>

          <div aria-live="polite">
            {visibleErrors.length > 0 && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/70 px-5 py-4">
                <strong className="text-xs font-bold text-red-600">
                  本章节有 {visibleErrors.length} 项需要完善
                </strong>
                <div className="mt-2 grid gap-1">
                  {visibleErrors.map((error) => (
                    <button
                      key={`${error.id}-${error.msg}`}
                      type="button"
                      onClick={() => jumpError(errors, errors.indexOf(error))}
                      className="text-left text-xs leading-5 text-red-500 hover:underline"
                    >
                      {error.msg} ↗
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {step === 0 && (
            <BasicStep
              basic={data.basic}
              onChange={patchBasic}
              errors={fieldErrors}
              onAddName={addName}
              onRemoveName={removeName}
            />
          )}
          {step === 1 && (
            <ShareholderStep
              data={data}
              onAdd={() => setModal({ kind: 'type' })}
              onEdit={(id) => openRecord('share', id)}
              recordErrors={recordsIn('share')}
            />
          )}
          {step === 2 && (
            <PersonnelStep
              data={data}
              onAdd={() => openRecord('role')}
              onEdit={(id) => openRecord('role', id)}
              recordErrors={recordsIn('role')}
              roleError={errorAt('roles')}
            />
          )}
          {step === 3 && (
            <SetupStep
              setup={data.setup}
              onChange={patchSetup}
              errors={fieldErrors}
            />
          )}
          {step === 4 && (
            <ReviewStep
              data={data}
              errors={fieldErrors}
              onEditSection={go}
              onConfirm={patchConfirm}
              onExport={() => exportDraft(data)}
            />
          )}

          <footer className="mt-8 flex flex-wrap justify-between gap-2 text-[11px] text-stone-400">
            <span>班步一企通 · 企业注册服务申请</span>
            <span>交互演示版 · 短信与提交未接入服务</span>
          </footer>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1224px] flex-wrap items-center gap-x-[22px] gap-y-3 px-7 py-3.5">
          <span role="status" className="text-xs font-semibold text-stone-500">
            {saveLabel}
          </span>
          <span className="hidden text-[11px] text-stone-400 sm:block">带 * 的字段为必填项</span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" className={TEXT_BUTTON} onClick={() => setModal({ kind: 'help' })}>
              <HelpCircle size={13} className="mr-1 inline" aria-hidden="true" />
              帮助
            </button>
            {data.status === 'submitted' && /^https?:$/.test(window.location.protocol) && (
              <button type="button" className={TEXT_BUTTON} onClick={() => void copyLink()}>
                复制链接
              </button>
            )}
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => {
                setToast(`草稿已导出 · ${data.basic.names[0] || '未命名'}`);
                exportDraft(data);
              }}
            >
              <Download size={14} aria-hidden="true" />
              导出
            </button>
            <label className={`${SECONDARY_BUTTON} cursor-pointer`}>
              <Upload size={14} aria-hidden="true" />
              导入
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  event.target.value = '';
                  if (picked) void importDraft(picked);
                }}
              />
            </label>
            <button type="button" className={SECONDARY_BUTTON} onClick={() => void save()}>
              暂存
            </button>
            <button type="button" className={SECONDARY_BUTTON} disabled={step === 0} onClick={() => go(step - 1)}>
              <ArrowLeft size={14} aria-hidden="true" />
              上一项
            </button>
            {step < TITLES.length - 1 && (
              <button type="button" className={SECONDARY_BUTTON} onClick={() => go(step + 1)}>
                下一项
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
            <button type="button" className={PRIMARY_BUTTON} onClick={submitStart}>
              {step === TITLES.length - 1 ? '确认并提交' : '提交申请'}
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {modal?.kind === 'type' && (
        <Dialog
          title="添加股东"
          onClose={() => setModal(null)}
          footer={
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setModal(null)}>
              取消
            </button>
          }
        >
          <p className="mb-5 text-[13px] text-stone-500">选择股东类型，填写信息及出资安排。</p>
          <div className="grid grid-cols-3 gap-3">
            {SHARE_TYPE_CARDS.map((card) => (
              <button
                key={card.type}
                type="button"
                onClick={() => openRecord('share', null, card.type)}
                className="rounded-xl border border-stone-200 bg-white px-2.5 py-[26px] text-center transition-colors hover:border-[#66cdb5] hover:bg-[#f7fcfb]"
              >
                <span className="block text-[27px] text-[#4fb69e]" aria-hidden="true">
                  {card.icon}
                </span>
                <strong className="mt-2 block text-[15px] font-bold">{card.type}</strong>
                <span className="mt-0.5 block text-[11px] text-stone-400">{card.desc}</span>
              </button>
            ))}
          </div>
        </Dialog>
      )}

      {modal?.kind === 'record' && (
        <RecordDialog
          target={modal.target}
          data={data}
          initialError={modal.error}
          onClose={() => setModal(null)}
          onSaved={(payload) => saveRecord(modal.target.kind, payload)}
          onDelete={() => deleteRecord(modal.target.kind)}
        />
      )}

      {modal?.kind === 'verify' && (
        <Dialog
          title="验证手机并提交"
          error={verifyError}
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setModal(null)}>
                取消
              </button>
              <button type="button" className={PRIMARY_BUTTON} onClick={() => void verifySubmit(validate(data))}>
                验证并演示提交
              </button>
            </>
          }
        >
          <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
            演示验证：不会发送短信，也不会将申请传给服务人员。
          </p>
          <div className="grid gap-4">
            <Field
              id="verifyPhone"
              label="手机号码"
              required
              inputMode="tel"
              value={verifyPhone}
              placeholder="请输入中国大陆手机号码"
              onChange={setVerifyPhone}
            />
            <div>
              <div className="flex items-end gap-2.5">
                <div className="flex-1">
                  <Field
                    id="verifyCode"
                    label="验证码"
                    required
                    inputMode="numeric"
                    value={verifyCode}
                    placeholder="请输入 6 位演示验证码"
                    onChange={setVerifyCode}
                  />
                </div>
                <button type="button" className={SECONDARY_BUTTON} onClick={sendDemoCode}>
                  获取演示验证码
                </button>
              </div>
              {sms && (
                <p className="mt-1.5 text-xs text-stone-400">
                  演示验证码：{sms.code}（5 分钟内有效，未发送短信）
                </p>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {modal?.kind === 'help' && (
        <HelpDialog
          onClose={() => setModal(null)}
          onExport={() => exportDraft(data)}
          onImport={(file) => void importDraft(file)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-stone-800 px-5 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
