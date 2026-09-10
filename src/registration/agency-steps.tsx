import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Save } from 'lucide-react';

import { API_HOST, SERVICE_CONFIRM_SAVE_PATH } from '../config/api';
import { StepCard } from './steps';
import { CheckboxField, LABEL_STYLE, SelectField, TextField, TextareaField } from './fields';
import { TAX_TYPES, type FormValues, type ServiceConfirmValues } from './schema';

const GRID = 'grid gap-5 sm:grid-cols-2';

const SAVE_BUTTON =
  'inline-flex items-center gap-2 rounded-full border border-[#66cdb5]/60 bg-white px-5 py-2.5 text-sm font-bold text-[#3f9d87] transition-colors hover:bg-[#f2fbf8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20 disabled:cursor-not-allowed disabled:opacity-60';

const SAVE_STATUS_STYLE = {
  ok: 'text-[#3f9d87]',
  error: 'text-red-500',
} as const;

/** 独立保存：不随企业侧主表单提交，因此单独一个接口、单独一次请求 */
const saveServiceConfirm = async (value: ServiceConfirmValues) => {
  if (!SERVICE_CONFIRM_SAVE_PATH) throw new Error('保存接口尚未接入，本次填写暂未发送到服务端');
  const res = await fetch(`${API_HOST}${SERVICE_CONFIRM_SAVE_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`保存失败（${res.status}）`);
};

/**
 * 《企业服务委托单》第八节 · 本次服务确认（金桥镇服务专员填写）。
 * 与登记流程的环节无关，因此不占 PDF 环节号，列在右栏菜单第一位。
 * 金额、年月的格式校验在 schema 里，均为可选——企业不应被尚未确认的服务口径卡住提交。
 */
export function ServiceConfirmStep() {
  const { getValues, trigger } = useFormContext<FormValues>();
  const [saveStatus, setSaveStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaveStatus(null);
    // 只校验本节：右栏其它步骤不该被这一下顺手点亮或拦下
    if (!(await trigger('serviceConfirm'))) return;
    setSaving(true);
    try {
      await saveServiceConfirm(getValues('serviceConfirm'));
      setSaveStatus({ tone: 'ok', text: '企业服务确认已保存' });
    } catch (error) {
      setSaveStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : '保存失败，请稍后重试',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepCard
      badge="企业服务委托单 · 本次服务确认"
      title="企业服务确认"
      hint="本节由金桥镇服务专员按企业与金桥镇约定的服务方案填写，企业无需操作。服务项目、税务类型及费用以《企业服务委托单》为准。"
    >
      <div className={GRID}>
        {/* 多选项用 fieldset/legend 成组，读屏才会把「服务项目」念在每一项前面 */}
        <fieldset className="m-0 min-w-0 border-0 p-0 sm:col-span-2">
          <legend className={LABEL_STYLE}>服务项目</legend>
          <div className={GRID}>
            <CheckboxField name="serviceConfirm.basicService" label="基础服务（必选）" disabled />
            <CheckboxField name="serviceConfirm.taxService" label="税务/财税托管服务" />
            <CheckboxField name="serviceConfirm.hrService" label="人力资源托管服务" />
            <CheckboxField name="serviceConfirm.subsidyService" label="政府补贴服务" />
          </div>
        </fieldset>

        <SelectField
          name="serviceConfirm.taxType"
          label="税务类型"
          options={TAX_TYPES}
          placeholder="请选择税务类型"
        />
        <TextField
          name="serviceConfirm.durationMonths"
          label="服务时长（个月）"
          inputMode="numeric"
          placeholder="如：12"
        />
        <TextField
          name="serviceConfirm.startYear"
          label="托管起始年份"
          inputMode="numeric"
          maxLength={4}
          placeholder="如：2026"
        />
        <TextField
          name="serviceConfirm.startMonth"
          label="托管起始月份"
          inputMode="numeric"
          maxLength={2}
          placeholder="如：9"
        />
        <TextField
          name="serviceConfirm.standardFee"
          label="标准服务费用（元）"
          inputMode="decimal"
          placeholder="如：2600"
        />
        <TextField
          name="serviceConfirm.paidAmount"
          label="本次实付金额（元）"
          inputMode="decimal"
          placeholder="如：2600"
        />
        <TextareaField
          name="serviceConfirm.remark"
          label="备注"
          className="sm:col-span-2"
          rows={3}
          placeholder="服务内容、费用增减或其他需说明的事项"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-stone-200/70 pt-5">
        <button type="button" className={SAVE_BUTTON} onClick={handleSave} disabled={saving}>
          <Save size={16} aria-hidden="true" />
          {saving ? '保存中…' : '保存服务确认'}
        </button>
        <p
          role="status"
          aria-live="polite"
          className={`text-xs ${saveStatus ? SAVE_STATUS_STYLE[saveStatus.tone] : 'text-stone-400'}`}
        >
          {saveStatus?.text ?? '本节单独保存，不影响后续步骤，也不会随企业侧信息一起提交。'}
        </p>
      </div>
    </StepCard>
  );
}

/** 右栏菜单里的只读项：PDF 中固定不变，无需采集 */
const StaticRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3">
    <span className="shrink-0 text-xs text-stone-500">{label}</span>
    <span className="text-right text-sm font-semibold text-stone-800">{value}</span>
  </div>
);

/** 环节 3 · 经办人信息（金桥镇服务专员填写） */
export function AgentStep() {
  return (
    <StepCard
      badge="环节 3 · 经办人信息"
      title="经办人信息"
      hint="本环节由金桥镇服务专员填写：经办人类型选「经营主体登记注册代理人」，「是否代理机构」选「否」。企业无需填写，可在此核对。"
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <StaticRow label="经办人类型" value="经营主体登记注册代理人" />
        <StaticRow label="是否代理机构" value="否" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="agency.agentName"
          label="经办人姓名"
          placeholder="金桥镇指定人员"
          hint="须为金桥镇指定人员"
        />
        <TextField name="agency.agentIdNumber" label="经办人身份证号" placeholder="18 位身份证号" />
        <TextField
          name="agency.agentMobile"
          label="经办人手机号"
          type="tel"
          inputMode="tel"
          maxLength={11}
          placeholder="11 位手机号"
        />
      </div>
    </StepCard>
  );
}

/** 环节 4 · 选择申请机关（固定值，无需采集） */
export function AuthorityStep() {
  return (
    <StepCard
      badge="环节 4 · 选择申请机关"
      title="选择申请机关"
      hint="由金桥镇服务专员在平台内选择，企业无需操作；以下为本环节的固定内容。"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <StaticRow label="登记机关" value="中国（上海）自由贸易试验区" />
        <StaticRow label="办理地点" value="新金桥路 27 号 14 号楼" />
      </div>
    </StepCard>
  );
}

/** 环节 10 · 办理方式（固定值，无需采集） */
export function MethodStep() {
  return (
    <StepCard
      badge="环节 10 · 办理方式"
      title="办理方式"
      hint="由金桥镇服务专员在平台内选择；辅导通过后再由企业相关人员电子签名并提交。"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <StaticRow label="办理方式" value="全程网办" />
        <StaticRow label="辅导方式" value="需要材料辅导" />
      </div>
    </StepCard>
  );
}
