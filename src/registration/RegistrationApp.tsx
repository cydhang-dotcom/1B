import { useEffect, useMemo, useRef, useState } from 'react';

import { AuthorizationStep } from './authorization';
import { RecordDialog, type EditTarget } from './dialogs';
import { exportDraft, loadDraft, nowStamp, storeDraft } from './draft';
import { HelpDialog } from './help';
import {
  CONFIG,
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
import { Dialog, Field } from './ui';

/**
 * 类名与 DOM 结构对齐 企业注册服务申请系统-6.html；
 * 样式在 design.css，改动前先改原型。
 */

type SectionState = 'blank' | 'partial' | 'complete';

const STATE_LABEL: Record<SectionState, string> = {
  blank: '空白',
  partial: '不完整',
  complete: '全部填写完成',
};

/** 窄屏下导航标签换成简称，断点与原型一致 */
const NARROW = 760;

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
  const [narrow, setNarrow] = useState(() => window.innerWidth <= NARROW);
  const barRef = useRef<HTMLDivElement>(null);

  // 短信验证是本地演示：验证码只在页面上显示，不发送也不校验真实短信
  const [sms, setSms] = useState<{ phone: string; code: string; expires: number } | null>(null);
  const [verifyPhone, setVerifyPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');

  /**
   * 导航上的「完成 / 未完成」始终按真实校验结果算，与用户点没点过提交无关。
   * 否则填一个字段就先冒出一个 ✓，一点提交又整排退回未完成。
   */
  const allErrors = useMemo<ValidationError[]>(() => validate(data), [data]);
  /** 页面上要显示的报错：点过提交之后才提示，避免刚打开就满屏红字 */
  const errors = useMemo<ValidationError[]>(() => (attempted ? allErrors : []), [attempted, allErrors]);

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

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= NARROW);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 底部操作栏是 fixed 定位，高度写进 --actionbar-height 让正文留白与 toast 让位
  useEffect(() => {
    const node = barRef.current;
    if (!node) return;
    const sync = () =>
      document.documentElement.style.setProperty(
        '--actionbar-height',
        `${Math.ceil(node.getBoundingClientRect().height)}px`,
      );
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    window.addEventListener('resize', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [loading]);

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

  const patchAuthorization = (patch: Partial<ApplicationData['authorization']>) =>
    update((draft) => ({ ...draft, authorization: { ...draft.authorization, ...patch } }));

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
    if (Date.now() > sms.expires || verifyPhone.trim() !== sms.phone || verifyCode.trim() !== sms.code) {
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
    return allErrors.some((error) => error.section === index) ? 'partial' : 'complete';
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
  const saveLabel = dirty ? '有修改，尚未暂存' : data.savedAt ? `已暂存 ${data.savedAt}` : '草稿尚未暂存';
  const shareable = data.status === 'submitted' && /^https?:$/.test(window.location.protocol);

  if (loading) {
    return <div className="registration-app muted">正在载入本地草稿…</div>;
  }

  return (
    <div className="registration-app">
      <header className="topbar">
        <div className="brand">
          <div className="brandmark">b</div>
          <div className="brandname">
            班步一企通
            <small>BANBU ONEBIZ</small>
          </div>
          <div className="bar-divider" />
          <span className="bar-title">企业设立服务</span>
        </div>
        <span className="header-caption">企业注册服务申请</span>
      </header>

      <div className="shell">
        <aside className="sidebar">
          <div className="eyebrow">COMPANY INCORPORATION</div>
          <div className="side-title">开启您的企业旅程</div>
          <div className="progress-label">
            <span>申请填写进度</span>
            <span>
              {completed} / {TITLES.length}
            </span>
          </div>
          <div className="progress">
            <div style={{ width: `${(completed / TITLES.length) * 100}%` }} />
          </div>
          <nav className="nav" aria-label="申请章节">
            {TITLES.map((title, index) => (
              <button
                key={title}
                type="button"
                className={index === step ? 'active' : undefined}
                aria-current={index === step ? 'step' : undefined}
                title={`${title}：${STATE_LABEL[sectionStates[index]]}`}
                onClick={() => go(index)}
              >
                <span className="nav-no">{String(index + 1).padStart(2, '0')}</span>
                <span className="nav-text">
                  <span className="desktop-title">{narrow ? SHORT[index] : title}</span>
                </span>
                <span className={`state ${sectionStates[index]}`} aria-label={STATE_LABEL[sectionStates[index]]}>
                  {sectionStates[index] === 'complete' ? '✓' : ''}
                </span>
              </button>
            ))}
          </nav>
          <div className="side-note">
            <strong>按您的节奏，安心填写</strong>可随时暂存，稍后继续。
            <br />
            已有人员可直接复用，
            <br />
            无需重复填写与上传。
          </div>
          <div className="side-bottom">
            企业申请人 · 企业设立服务人员
            <br />
            申请表版本 {CONFIG.version.replaceAll('-', '.')}
          </div>
        </aside>

        <main className="main">
          <div className="intro">
            <div>
              <div className="eyebrow" id="chapterLabel">
                APPLICATION / {String(step + 1).padStart(2, '0')}
              </div>
              <h1 id="pageTitle">{TITLES[step]}</h1>
              <p id="pageSubtitle">{SUBS[step]}</p>
            </div>
            <div>
              <span className="badge" id="appStatus">
                {status}
              </span>
              <div className="step-count" id="stepCount">
                STEP {String(step + 1).padStart(2, '0')} / {String(TITLES.length).padStart(2, '0')}
              </div>
            </div>
          </div>

          <div id="errorSummary" aria-live="polite">
            {visibleErrors.length > 0 && (
              <div className="errors-box">
                <strong>本章节有 {visibleErrors.length} 项需要完善</strong>
                {visibleErrors.map((error) => (
                  <button
                    key={`${error.id}-${error.msg}`}
                    type="button"
                    onClick={() => jumpError(errors, errors.indexOf(error))}
                  >
                    {error.msg} ↗
                  </button>
                ))}
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
          {step === 3 && <SetupStep setup={data.setup} onChange={patchSetup} errors={fieldErrors} />}
          {step === 4 && (
            <AuthorizationStep data={data} onPatch={patchAuthorization} onToast={setToast} />
          )}
          {step === 5 && (
            <ReviewStep
              data={data}
              errors={fieldErrors}
              onEditSection={go}
              onConfirm={patchConfirm}
              onExport={() => exportDraft(data)}
            />
          )}

          <footer className="page-footer">
            <span>班步一企通 · 企业注册服务申请</span>
            <span>交互演示版 · 短信与提交未接入服务</span>
          </footer>
        </main>
      </div>

      <div className="bottom-nav" ref={barRef} aria-label="申请操作栏">
        <div className="actionbar-inner">
          <div className="action-meta">
            <span className="save-label" role="status">
              {saveLabel}
            </span>
            <span id="bottomHint">带 * 的字段为必填项</span>
          </div>
          <div className="utility-actions">
            <button type="button" id="helpBtn" onClick={() => setModal({ kind: 'help' })}>
              帮助
            </button>
            {shareable && (
              <button type="button" id="copyBtn" onClick={() => void copyLink()}>
                复制链接
              </button>
            )}
            <button type="button" id="saveBtn" onClick={() => void save()}>
              暂存
            </button>
          </div>
          <div className="step-actions">
            <button type="button" id="prevBtn" disabled={step === 0} onClick={() => go(step - 1)}>
              ← 上一项
            </button>
            {step < TITLES.length - 1 && (
              <button type="button" id="nextBtn" onClick={() => go(step + 1)}>
                下一项 →
              </button>
            )}
            <button type="button" className="primary" id="submitBtn" onClick={submitStart}>
              {step === TITLES.length - 1 ? '确认并提交 ↗' : '提交申请 ↗'}
            </button>
          </div>
        </div>
      </div>

      {modal?.kind === 'type' && (
        <Dialog
          title="添加股东"
          onClose={() => setModal(null)}
          footer={
            <>
              <div />
              <button type="button" onClick={() => setModal(null)}>
                取消
              </button>
            </>
          }
        >
          <p className="muted" style={{ margin: '0 0 20px', fontSize: 13 }}>
            选择股东类型，填写信息及出资安排。
          </p>
          <div className="type-cards">
            {SHARE_TYPE_CARDS.map((card) => (
              <button key={card.type} type="button" className="type-card" onClick={() => openRecord('share', null, card.type)}>
                <div style={{ fontSize: 27, color: 'var(--teal)' }} aria-hidden="true">
                  {card.icon}
                </div>
                <strong>{card.type}</strong>
                <span>{card.desc}</span>
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
          onClose={() => setModal(null)}
          footer={
            <>
              <div />
              <div>
                <button type="button" onClick={() => setModal(null)}>
                  取消
                </button>
                <button type="button" className="primary" id="verifySubmit" onClick={() => void verifySubmit(validate(data))}>
                  验证并演示提交
                </button>
              </div>
            </>
          }
        >
          <div className="note warm" style={{ marginBottom: 22 }}>
            演示验证：不会发送短信，也不会将申请传给服务人员。
          </div>
          <div className="dialog-error" role="alert">
            {verifyError}
          </div>
          <div className="grid">
            <div className="full">
              <Field
                id="verifyPhone"
                label="手机号码"
                required
                type="tel"
                inputMode="tel"
                value={verifyPhone}
                placeholder="请输入中国大陆手机号码"
                onChange={setVerifyPhone}
              />
            </div>
            <div className="field full">
              <label htmlFor="verifyCode">
                验证码<span className="req">*</span>
              </label>
              <div className="verification">
                <input
                  id="verifyCode"
                  inputMode="numeric"
                  value={verifyCode}
                  placeholder="请输入 6 位演示验证码"
                  onChange={(event) => setVerifyCode(event.target.value)}
                />
                <button type="button" onClick={sendDemoCode}>
                  获取演示验证码
                </button>
              </div>
              <div className="hint">{sms && `演示验证码：${sms.code}（5 分钟内有效，未发送短信）`}</div>
            </div>
          </div>
        </Dialog>
      )}

      {modal?.kind === 'help' && (
        <HelpDialog onClose={() => setModal(null)} />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
