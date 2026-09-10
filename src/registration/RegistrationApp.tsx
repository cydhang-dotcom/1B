import React, { useEffect, useState } from 'react';
import { FormProvider, useForm, type FieldErrors, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ListChecks, Send } from 'lucide-react';

import {
  AddressStep,
  BasicStep,
  BeneficiaryStep,
  CharterStep,
  PersonnelStep,
  ReviewStep,
  ShareholderStep,
} from './steps';
import { AttorneyStep } from './attorney';
import { AgentStep, AuthorityStep, MethodStep, ServiceConfirmStep } from './agency-steps';
import { defaultValues, registrationSchema, type FormValues } from './schema';
import { devDefaultValues } from './dev-defaults';
import { ENTERPRISE_FLOW_COUNT, FLOW_STEPS, type FlowOwner } from './flow';

/** 开发阶段预填示例数据，生产构建自动回到空表单 */
const initialValues = import.meta.env.DEV ? devDefaultValues : defaultValues;

/** 企业侧 / 金桥镇服务专员侧，决定步骤归到左栏还是右栏菜单 */
type StepGroup = 'enterprise' | 'agency';

type StepConfig = {
  key: string;
  /** 对应 PDF 中的环节序号；企业侧信息确认不是 PDF 环节，故缺省 */
  pdfStep?: number;
  title: string;
  group: StepGroup;
  /** 该步骤负责校验的字段，用于「下一步」与提交失败时定位 */
  fields: FieldPath<FormValues>[];
  render: () => React.ReactNode;
  /** 最终提交步骤，页脚显示「提交信息」 */
  submit?: boolean;
  /** 除所属栏外，同时挂到企业侧菜单，且不受填写进度限制（环节 11 只读，企业要打印） */
  viewableByEnterprise?: boolean;
};

/**
 * 步骤名与环节号均取自 PDF 第 2 页的环节一览，按环节号排列，保证与流程指引一一对应。
 * 两栏菜单是同一份列表按 group 过滤出来的，因此左右菜单里的先后顺序仍是流程顺序。
 */
const STEPS: StepConfig[] = [
  {
    // 《企业服务委托单》第八节，不属于 PDF 的 14 个环节，因此没有环节号。
    // 排在首位，右栏菜单里它就是第一项。
    key: 'service-confirm',
    title: '企业服务确认',
    group: 'agency',
    fields: ['serviceConfirm'],
    render: () => <ServiceConfirmStep />,
  },
  {
    key: 'basic',
    pdfStep: 2,
    title: '名称申报',
    group: 'enterprise',
    fields: ['tradeName', 'industry', 'orgType', 'registeredCapital'],
    render: () => <BasicStep />,
  },
  {
    key: 'agent',
    pdfStep: 3,
    title: '经办人信息',
    group: 'agency',
    fields: ['agency.agentName', 'agency.agentIdNumber', 'agency.agentMobile'],
    render: () => <AgentStep />,
  },
  {
    key: 'authority',
    pdfStep: 4,
    title: '选择申请机关',
    group: 'agency',
    fields: [],
    render: () => <AuthorityStep />,
  },
  {
    key: 'address',
    pdfStep: 5,
    title: '住所信息',
    group: 'enterprise',
    fields: ['leaseContractNo', 'address', 'postalCode'],
    render: () => <AddressStep />,
  },
  {
    key: 'charter',
    pdfStep: 6,
    title: '联系与章程信息',
    group: 'enterprise',
    fields: ['contactPhone', 'articlesDate', 'businessScope'],
    render: () => <CharterStep />,
  },
  {
    key: 'shareholders',
    pdfStep: 7,
    title: '股东及出资信息',
    group: 'enterprise',
    fields: ['shareholders'],
    render: () => <ShareholderStep />,
  },
  {
    key: 'personnel',
    pdfStep: 8,
    title: '人员信息',
    group: 'enterprise',
    fields: ['legalPerson', 'director', 'supervisor', 'financeManager'],
    render: () => <PersonnelStep />,
  },
  {
    key: 'beneficiaries',
    pdfStep: 9,
    title: '受益人信息',
    group: 'enterprise',
    fields: ['beneficiaries'],
    render: () => <BeneficiaryStep />,
  },
  {
    key: 'method',
    pdfStep: 10,
    title: '办理方式',
    group: 'agency',
    fields: [],
    render: () => <MethodStep />,
  },
  {
    // 环节 11 的材料：内容由环节 3 的经办人信息带出，本步只读预览 + 打印，故无需校验字段
    key: 'attorney',
    pdfStep: 11,
    title: '法人委托书',
    group: 'agency',
    fields: [],
    viewableByEnterprise: true,
    render: () => <AttorneyStep />,
  },
  {
    key: 'review',
    title: '提交前确认',
    group: 'enterprise',
    fields: [],
    submit: true,
    render: () => <ReviewStep />,
  },
];

/** 企业侧的第一步。右栏的「企业服务确认」占了 STEPS[0]，进度起点不能写死为 0 */
const FIRST_ENTERPRISE_INDEX = STEPS.findIndex((step) => step.group === 'enterprise');

/** 该步骤是否出现在这一栏的菜单里 */
const inMenu = (step: StepConfig, group: StepGroup) =>
  step.group === group || (group === 'enterprise' && step.viewableByEnterprise === true);

/**
 * 同栏菜单内的前后步骤，用于「上一步 / 下一步」——不允许跨栏跳，避免企业被带到专员环节。
 * 环节 11 两栏都挂，因此按「从哪一栏进来的」决定前后是谁，而不是按步骤自己所属的栏。
 */
const siblingIndexes = (group: StepGroup): number[] =>
  STEPS.map((step, index) => ({ step, index }))
    .filter(({ step }) => inMenu(step, group))
    .map(({ index }) => index);

const OWNER_BADGE: Record<FlowOwner, string> = {
  企业: 'bg-[#e8f7f3] text-[#3f9d87]',
  金桥: 'bg-stone-100 text-stone-500',
  无需办理: 'bg-stone-100 text-stone-400',
};

/** 展开可见 PDF 的全部 14 个环节，标出哪些由企业在本页填写、哪些由金桥镇经办人办理 */
function FlowOverview({
  maxStep,
  onJump,
}: {
  maxStep: number;
  onJump: (index: number, group: StepGroup) => void;
}) {
  return (
    <details className="group mb-6 rounded-2xl border border-stone-200/80 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-2xl px-5 py-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20">
        <ListChecks size={17} className="shrink-0 text-[#4fb69e]" aria-hidden="true" />
        <span className="flex-1">
          查看完整办理流程
          <span className="ml-2 font-normal text-stone-400">
            共 {FLOW_STEPS.length} 个环节，本页填写其中 {ENTERPRISE_FLOW_COUNT} 个
          </span>
        </span>
        <ChevronDown
          size={17}
          className="shrink-0 text-stone-400 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <ol className="grid gap-1.5 border-t border-stone-200/70 px-4 py-4">
        {FLOW_STEPS.map((item) => {
          const index = item.formKey ? STEPS.findIndex((step) => step.key === item.formKey) : -1;
          // 企业侧步骤要按填写进度解锁；专员侧步骤随时可看，不受进度限制
          const jumpable = index >= 0 && (item.owner !== '企业' || index <= maxStep);
          return (
            <li
              key={item.step}
              className="flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-stone-50/70"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-bold text-stone-500">
                {item.step}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-stone-800">{item.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${OWNER_BADGE[item.owner]}`}
                  >
                    {item.owner}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-stone-500">{item.keyPoint}</p>
              </div>
              {jumpable && (
                <button
                  type="button"
                  onClick={() => onJump(index, item.owner === '企业' ? 'enterprise' : 'agency')}
                  className="mt-0.5 shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-[#3f9d87] transition-colors hover:bg-[#e8f7f3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20"
                >
                  {item.owner === '企业' ? '去填写' : '去查看'}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

const hasPath = (source: unknown, path: string): boolean =>
  path.split('.').reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
    source,
  ) != null;

const PILL_BASE =
  'shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20';
const PILL_CURRENT = 'bg-[#66cdb5] text-white shadow-sm';
const PILL_DONE = 'bg-[#e8f7f3] text-[#3f9d87] hover:bg-[#dbf1eb]';
const PILL_TODO = 'bg-stone-100 text-stone-400';
/** 专员侧菜单：换一组配色，一眼能看出不是自己要填的 */
const PILL_AGENCY_CURRENT = 'bg-[#3f7d6d] text-white shadow-sm';
const PILL_AGENCY_IDLE = 'bg-[#eef7f4] text-[#3f7d6d] hover:bg-[#e2f0eb]';
const NAV_ROW =
  'no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0 lg:mx-0 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:px-0 lg:pb-0';
const NAV_PILL = `${PILL_BASE} lg:w-full lg:rounded-xl lg:px-4 lg:py-2.5 lg:text-left`;

/**
 * 侧栏菜单：只负责选中步骤，内容统一在中间渲染。
 * 企业侧未走到的步骤禁用；专员侧随时可看，不受填写进度限制。
 */
function StepMenu({
  group,
  label,
  current,
  maxStep,
  onSelect,
  className,
}: {
  group: StepGroup;
  label: string;
  current: number;
  maxStep: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const ownerMenu = group === 'enterprise';

  return (
    <nav aria-label={label} className={`mb-6 lg:sticky lg:top-6 lg:mb-0 lg:w-56 lg:shrink-0 ${className}`}>
      <p className="mb-2 px-1 text-[10px] font-bold tracking-[0.18em] text-[#4fb69e] lg:px-4">{label}</p>
      <div className={NAV_ROW}>
        {STEPS.map((step, index) => {
          if (!inMenu(step, group)) return null;
          const disabled = ownerMenu && step.viewableByEnterprise !== true && index > maxStep;
          const state = ownerMenu
            ? index === current
              ? PILL_CURRENT
              : disabled
                ? PILL_TODO
                : PILL_DONE
            : index === current
              ? PILL_AGENCY_CURRENT
              : PILL_AGENCY_IDLE;
          return (
            <button
              key={step.key}
              type="button"
              disabled={disabled}
              aria-current={index === current ? 'step' : undefined}
              onClick={() => !disabled && onSelect(index)}
              className={`${NAV_PILL} ${state}`}
            >
              {step.pdfStep ? `环节 ${step.pdfStep} · ${step.title}` : step.title}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
const PRIMARY_BUTTON =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#66cdb5] px-7 text-sm font-bold text-white shadow-lg shadow-[#66cdb5]/20 transition-all hover:bg-[#57bea6] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/25';
const GHOST_BUTTON =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-6 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-stone-200';

function SuccessView({ data, onReset }: { data: FormValues; onReset: () => void }) {
  const summary = [
    { label: '拟申报名称', value: `${data.tradeName}（上海）${data.industry}${data.orgType}` },
    { label: '注册资本', value: `${data.registeredCapital} 万元` },
    { label: '股东数量', value: `${data.shareholders.length} 名` },
    { label: '受益所有人', value: `${data.beneficiaries.length} 名` },
    { label: '联系电话', value: data.contactPhone },
    { label: '租赁合同编号', value: data.leaseContractNo },
  ];

  return (
    <section className="rounded-[1.75rem] border border-stone-200/80 bg-white p-6 shadow-[0_10px_36px_rgba(46,98,86,0.05)] sm:p-10">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8f7f3] text-[#3f9d87]">
          <Check size={26} strokeWidth={3} aria-hidden="true" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4fb69e]">
            COMPLETED
          </div>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
            信息已填写完成
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            提交接口尚未接入，本次填写暂未发送到服务端。如需立即办理，请直接联系金桥镇服务专员。
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-4 rounded-2xl border border-stone-200/80 bg-stone-50/40 p-5 sm:grid-cols-2">
        {summary.map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <span className="text-xs text-stone-500">{item.label}</span>
            <span className="text-sm font-semibold text-stone-800">{item.value}</span>
          </div>
        ))}
      </div>

      <button type="button" className={`${PRIMARY_BUTTON} mt-7`} onClick={onReset}>
        再填一份
      </button>
    </section>
  );
}

export default function RegistrationApp() {
  const [current, setCurrent] = useState(FIRST_ENTERPRISE_INDEX);
  /** 当前步骤是从哪一栏菜单进入的，决定「上一步 / 下一步」沿哪条链走 */
  const [menu, setMenu] = useState<StepGroup>('enterprise');
  const [maxStep, setMaxStep] = useState(FIRST_ENTERPRISE_INDEX);
  const [submitted, setSubmitted] = useState<FormValues | null>(null);

  const methods = useForm<FormValues>({
    resolver: zodResolver(registrationSchema),
    mode: 'onBlur',
    defaultValues: initialValues,
  });
  const { trigger, handleSubmit, reset, formState } = methods;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current, submitted]);

  const goTo = (index: number) => {
    setCurrent(index);
    if (STEPS[index].group === 'enterprise') setMaxStep((prev) => Math.max(prev, index));
  };

  const siblings = siblingIndexes(menu);
  const at = siblings.indexOf(current);
  const prevIndex = at > 0 ? siblings[at - 1] : null;
  const nextIndex = at < siblings.length - 1 ? siblings[at + 1] : null;

  const goNext = async () => {
    if (nextIndex === null) return;
    const valid = await trigger(STEPS[current].fields, { shouldFocus: true });
    if (!valid) return;
    goTo(nextIndex);
  };

  const goPrev = () => {
    if (prevIndex !== null) goTo(prevIndex);
  };

  const onSubmit = (data: FormValues) => {
    // ponytail: 提交接口未接入 —— 当前只做前端校验与汇总，不发起网络请求。
    // 接口确认后，在此 POST data（参考 components/TrustModal.tsx 的订阅接口写法），
    // 并把 setSubmitted 移到请求成功的回调里。
    // 注意：data.serviceConfirm 由「企业服务确认」步骤内的独立接口保存，不要并进这里的载荷。
    setSubmitted(data);
  };

  const onInvalid = (errors: FieldErrors<FormValues>) => {
    const index = STEPS.findIndex((step) => step.fields.some((field) => hasPath(errors, field)));
    if (index >= 0) goTo(index);
  };

  const handleReset = () => {
    reset(initialValues);
    setSubmitted(null);
    setCurrent(FIRST_ENTERPRISE_INDEX);
    setMenu('enterprise');
    setMaxStep(FIRST_ENTERPRISE_INDEX);
  };

  /** 菜单与总览都从这里进：选定步骤的同时记下来源栏 */
  const jumpTo = (index: number, group: StepGroup) => {
    setMenu(group);
    goTo(index);
  };

  return (
    <div className="min-h-screen bg-[#fbfbfa]">
      <header className="border-b border-stone-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4fb69e]">
              班步一企通 · 金桥镇
            </div>
            <h1 className="mt-1 text-lg font-extrabold tracking-tight text-stone-900 sm:text-xl">
              新企业注册信息采集
            </h1>
          </div>
          <span className="hidden text-xs text-stone-400 sm:block">
            上海一网通办 · 企业登记在线
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
        {submitted ? (
          <SuccessView data={submitted} onReset={handleReset} />
        ) : (
          <FormProvider {...methods}>
            {/* 两栏菜单只负责选中，内容统一在中间显示。
                窄屏是顶部两行横滑胶囊（靠 order 把右栏提到内容之前），lg 起分列两侧并随页面滚动保持可见 */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8">
              <StepMenu
                group="enterprise"
                label="用户填写步骤"
                current={current}
                maxStep={maxStep}
                onSelect={(index) => jumpTo(index, 'enterprise')}
                className="order-1"
              />

              <div className="order-3 min-w-0 flex-1 lg:order-2">
                <FlowOverview maxStep={maxStep} onJump={jumpTo} />

                <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
                  {STEPS[current].render()}

                  <div className="mt-6 flex items-center gap-3">
                    {prevIndex !== null && (
                      <button type="button" className={GHOST_BUTTON} onClick={goPrev}>
                        <ArrowLeft size={16} aria-hidden="true" />
                        上一步
                      </button>
                    )}
                    <div className="flex-1" />
                    {/* 专员链末位（如右栏的环节 11）既无下一步也不是提交，就不放按钮 */}
                    {nextIndex !== null ? (
                      <button type="button" className={PRIMARY_BUTTON} onClick={goNext}>
                        下一步
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    ) : STEPS[current].submit ? (
                      <button
                        type="submit"
                        className={PRIMARY_BUTTON}
                        disabled={formState.isSubmitting}
                      >
                        <Send size={16} aria-hidden="true" />
                        提交信息
                      </button>
                    ) : null}
                  </div>

                  <p className="mt-4 text-xs leading-5 text-stone-400">
                    本页面仅采集企业侧需提供的信息。右栏「服务专员填写步骤」中的企业服务确认、经办人信息、申请机关与办理方式由专员办理；环节 11
                    的法人委托书可在左侧菜单中查看并打印。材料提交及五险一金 / 涉税 / 开户预约等环节，由专员在「上海企业登记在线」平台内完成。
                  </p>
                </form>
              </div>

              <StepMenu
                group="agency"
                label="服务专员填写步骤"
                current={current}
                maxStep={maxStep}
                onSelect={(index) => jumpTo(index, 'agency')}
                className="order-2 lg:order-3"
              />
            </div>
          </FormProvider>
        )}
      </main>
    </div>
  );
}
