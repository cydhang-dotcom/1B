import React from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Plus, Trash2, UserCog } from 'lucide-react';
import {
  CertificateUploadsField,
  NumberField,
  PersonReusePicker,
  SelectField,
  TextField,
  TextareaField,
} from './fields';
import { PERSON_ROLES, useNaturalPersonOptions } from './person-options';
import {
  BENEFIT_TYPES,
  CERTIFICATE_IMAGE_HINT,
  EQUITY_BENEFIT_HINT,
  INDUSTRIES,
  ORG_TYPES,
  SHAREHOLDER_TYPES,
  defaultBeneficiary,
  defaultShareholder,
  type FormValues,
} from './schema';

const GRID = 'grid gap-5 sm:grid-cols-2';
const SUB_CARD = 'rounded-2xl border border-stone-200/80 bg-stone-50/40 p-5';
const ADD_BUTTON =
  'inline-flex items-center gap-2 rounded-full border border-[#66cdb5]/60 bg-white px-5 py-2.5 text-sm font-semibold text-[#3f9d87] transition-colors hover:bg-[#f2fbf8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/15';

export function StepCard({
  badge,
  title,
  hint,
  children,
}: {
  badge: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-stone-200/80 bg-white p-6 shadow-[0_10px_36px_rgba(46,98,86,0.05)] sm:p-8">
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4fb69e]">{badge}</div>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">{title}</h2>
        {hint && <p className="mt-2 text-sm leading-6 text-stone-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * 与金桥镇经办人相关的说明。单独成块，避免混在灰色提示里被当成可选补充而略过。
 * 正文用 div 承载，方便调用方直接放列表。
 */
export function AgentNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#66cdb5]/35 bg-[#f2fbf8] px-4 py-3.5">
      <UserCog size={17} className="mt-0.5 shrink-0 text-[#4fb69e]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-[#3f7d6d]">{title}</p>
        <div className="mt-1 text-xs leading-5 text-[#3f7d6d]">{children}</div>
      </div>
    </div>
  );
}

/** 环节 2 · 名称申报 */
export function BasicStep() {
  const [tradeName, industry, orgType] = useWatch<FormValues>({
    name: ['tradeName', 'industry', 'orgType'],
  });
  const hasFullName = Boolean(tradeName && industry && orgType);

  return (
    <StepCard
      badge="环节 2 · 名称申报"
      title="企业基本信息"
      hint="依次选择名称字号、行业表述与组织形式，由平台自动比对名称是否可用。"
    >
      <div className={GRID}>
        <TextField name="tradeName" label="名称字号" required placeholder="如：数鲸云" maxLength={20} />
        <SelectField name="industry" label="行业表述" required options={INDUSTRIES} placeholder="请选择行业表述" />
        <SelectField name="orgType" label="组织形式" required options={ORG_TYPES} placeholder="请选择组织形式" />
        <NumberField name="registeredCapital" label="注册资本（万元）" required placeholder="如：50" />
      </div>

      {hasFullName && (
        <p className="mt-5 rounded-xl bg-[#f2fbf8] px-4 py-3 text-sm text-[#3f7d6d]">
          拟申报名称：
          <strong className="font-bold text-stone-900">
            {tradeName}（上海）{industry}
            {orgType}
          </strong>
        </p>
      )}
    </StepCard>
  );
}

/** 环节 5 · 住所信息 */
export function AddressStep() {
  return (
    <StepCard
      badge="环节 5 · 住所信息"
      title="住所信息（集中登记地址）"
      hint="住所地址须与租赁合同完全一致；集中登记地址的邮政编码固定为 201206。"
    >
      <div className={GRID}>
        <TextField
          name="leaseContractNo"
          label="租赁合同编号"
          required
          placeholder="请输入租赁合同编号"
          hint="由金桥镇经办人员提供"
        />
        <TextField name="address" label="住所地址" required placeholder="请按租赁合同填写集中登记地址" />
        <TextField
          name="postalCode"
          label="邮政编码"
          readOnly
          hint="集中登记地址固定邮编"
          autoComplete="postal-code"
        />
      </div>

      <AgentNote title="本环节须先联系金桥镇经办人员（环节 5 前置条件）">
        集中登记地址须先联系金桥镇经办人员确定租赁合同，取得合同编号后方可填写本步信息。请向经办人员索取合同编号，再回来填写。
      </AgentNote>
    </StepCard>
  );
}

/** 环节 6 · 联系与章程信息 */
export function CharterStep() {
  return (
    <StepCard
      badge="环节 6 · 联系与章程信息"
      title="联系电话、章程决议日期及经营范围"
      hint="联系电话填写注册客户联系电话；章程决议日期为股东会决议通过章程的日期。"
    >
      <div className={GRID}>
        <TextField
          name="contactPhone"
          label="注册客户联系电话"
          required
          type="tel"
          inputMode="tel"
          maxLength={13}
          placeholder="手机号或固定电话"
          autoComplete="tel"
        />
        <TextField name="articlesDate" label="章程决议日期" required type="date" />
        <TextareaField
          name="businessScope"
          label="经营范围"
          required
          className="sm:col-span-2"
          rows={5}
          placeholder="请填写经营范围，以平台规范条目为准，至少 10 个字"
        />
      </div>
    </StepCard>
  );
}

/** 环节 7 · 股东及出资信息 */
export function ShareholderStep() {
  const { control } = useFormContext<FormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'shareholders' });
  const shareholders = useWatch({ control, name: 'shareholders' });
  const registeredCapital = useWatch({ control, name: 'registeredCapital' });

  const total = (shareholders ?? []).reduce(
    (sum, item) => sum + (Number.isFinite(Number(item?.capital)) ? Number(item?.capital) : 0),
    0,
  );
  const capital = Number(registeredCapital);
  const mismatch =
    Number.isFinite(capital) && capital > 0 && Math.abs(total - capital) > 0.001;

  return (
    <StepCard
      badge="环节 7 · 股东及出资信息"
      title="股东及出资信息"
      hint="股东为企业法人的，也须填写移动电话，一般填写法人手机号。"
    >
      <p className="mb-5 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
        注册资本：
        <strong className="font-bold text-stone-900">
          {Number.isFinite(capital) && capital > 0 ? `${capital} 万元` : '未填写'}
        </strong>
        {' · '}
        认缴出资合计：
        <strong className="font-bold text-stone-900">{total} 万元</strong>
        {mismatch && <span className="ml-2 text-red-500">（须与注册资本一致）</span>}
      </p>

      <div className="grid gap-5">
        {fields.map((field, index) => (
          <div key={field.id} className={SUB_CARD}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-800">股东 {index + 1}</h3>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  删除
                </button>
              )}
            </div>
            <div className={GRID}>
              <TextField name={`shareholders.${index}.name`} label="股东名称" required placeholder="自然人或企业法人全称" />
              <SelectField
                name={`shareholders.${index}.type`}
                label="股东类型"
                required
                options={SHAREHOLDER_TYPES}
                placeholder="请选择股东类型"
              />
              <TextField
                name={`shareholders.${index}.idNumber`}
                label="证件号码"
                required
                hint="自然人填 18 位身份证号；企业法人填营业执照上以 91 开头的 18 位统一社会信用代码"
              />
              <TextField
                name={`shareholders.${index}.mobile`}
                label="移动电话"
                required
                type="tel"
                inputMode="tel"
                maxLength={11}
                placeholder="11 位手机号"
              />
              <NumberField
                name={`shareholders.${index}.capital`}
                label="认缴出资额（万元）"
                required
                placeholder="如：50"
              />
              <CertificateUploadsField
                name={`shareholders.${index}.certificateImages`}
                label="上传证件图片"
                hint={CERTIFICATE_IMAGE_HINT}
                className="sm:col-span-2"
              />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className={`${ADD_BUTTON} mt-5`} onClick={() => append(defaultShareholder())}>
        <Plus size={16} aria-hidden="true" />
        添加股东
      </button>
    </StepCard>
  );
}

/** 环节 8 · 人员信息 */
export function PersonnelStep() {
  const options = useNaturalPersonOptions();

  return (
    <StepCard
      badge="环节 8 · 人员信息"
      title="主要人员信息"
      hint="按平台要求填写法定代表人、董事、监事、财务负责人信息。同一个人只需录一次，其余角色点「复用已填人员」即可。"
    >
      <div className="grid gap-5">
        {PERSON_ROLES.map((role) => (
          <div key={role.key} className={SUB_CARD}>
            <h3 className="mb-4 text-sm font-bold text-stone-800">{role.label}</h3>
            <PersonReusePicker
              target={role.key}
              fields={['name', 'idNumber', 'mobile']}
              options={options}
              excludeId={role.key}
            />
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField name={`${role.key}.name`} label="姓名" required />
              <TextField name={`${role.key}.idNumber`} label="身份证号" required />
              <TextField
                name={`${role.key}.mobile`}
                label="手机号"
                required
                type="tel"
                inputMode="tel"
                maxLength={11}
              />
            </div>
          </div>
        ))}
      </div>
    </StepCard>
  );
}

/** 环节 9 · 受益人信息 */
export function BeneficiaryStep() {
  const { control } = useFormContext<FormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'beneficiaries' });
  const options = useNaturalPersonOptions();

  return (
    <StepCard
      badge="环节 9 · 受益人信息"
      title="受益所有人信息"
      hint="按平台要求填写受益所有人信息；持股类需填写持股比例。受益所有人通常是股东或主要人员，可直接复用。"
    >
      <div className="grid gap-5">
        {fields.map((field, index) => (
          <div key={field.id} className={SUB_CARD}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-800">受益所有人 {index + 1}</h3>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  删除
                </button>
              )}
            </div>
            <PersonReusePicker
              target={`beneficiaries.${index}`}
              fields={['name', 'idNumber']}
              options={options}
            />
            <div className={GRID}>
              <TextField name={`beneficiaries.${index}.name`} label="姓名" required />
              <TextField name={`beneficiaries.${index}.idNumber`} label="身份证号" required />
              <SelectField
                name={`beneficiaries.${index}.benefitType`}
                label="受益类型"
                required
                options={BENEFIT_TYPES}
                placeholder="请选择受益类型"
              />
              <NumberField
                name={`beneficiaries.${index}.shareRatio`}
                label="持股比例（%）"
                hint={EQUITY_BENEFIT_HINT}
                placeholder="如：60"
                step="0.01"
              />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className={`${ADD_BUTTON} mt-5`} onClick={() => append(defaultBeneficiary())}>
        <Plus size={16} aria-hidden="true" />
        添加受益所有人
      </button>
    </StepCard>
  );
}

const ReviewRow = ({ label, value }: { label: string; value: React.ReactNode } & React.Attributes) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
    <span className="w-32 shrink-0 text-xs text-stone-500">{label}</span>
    <span className="text-sm font-medium text-stone-800">{value || '—'}</span>
  </div>
);

const ReviewBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className={SUB_CARD}>
    <h3 className="mb-3 text-sm font-bold text-stone-800">{title}</h3>
    <div className="grid gap-2.5">{children}</div>
  </div>
);

/** 环节 12 之前的企业侧信息确认 */
export function ReviewStep() {
  const { getValues } = useFormContext<FormValues>();
  const data = getValues();
  const fullName = `${data.tradeName}（上海）${data.industry}${data.orgType}`;

  return (
    <StepCard
      badge="提交前确认"
      title="信息确认"
      hint="本页采集的是办理流程中的环节 2、5、6、7、8、9，请核对以下信息，确认无误后提交；后续环节由金桥镇经办人对接。"
    >
      <div className="grid gap-5">
        <ReviewBlock title="企业基本信息">
          <ReviewRow label="拟申报名称" value={fullName} />
          <ReviewRow label="注册资本" value={`${data.registeredCapital} 万元`} />
        </ReviewBlock>

        <ReviewBlock title="住所信息">
          <ReviewRow label="租赁合同编号" value={data.leaseContractNo} />
          <ReviewRow label="住所地址" value={data.address} />
          <ReviewRow label="邮政编码" value={data.postalCode} />
        </ReviewBlock>

        <ReviewBlock title="联系与章程">
          <ReviewRow label="联系电话" value={data.contactPhone} />
          <ReviewRow label="章程决议日期" value={data.articlesDate} />
          <ReviewRow label="经营范围" value={data.businessScope} />
        </ReviewBlock>

        <ReviewBlock title="股东及出资">
          {data.shareholders.map((item, index) => (
            <ReviewRow
              key={index}
              label={`股东 ${index + 1}`}
              value={`${item.name}（${item.type}）· ${item.idNumber} · ${item.mobile} · 认缴 ${item.capital} 万元 · ${
                item.certificateImages?.length ? `证件图片 ${item.certificateImages.length} 张` : '证件图片未上传'
              }`}
            />
          ))}
        </ReviewBlock>

        <ReviewBlock title="主要人员">
          {PERSON_ROLES.map((role) => {
            const person = data[role.key];
            return (
              <ReviewRow
                key={role.key}
                label={role.label}
                value={person.name ? `${person.name} · ${person.idNumber} · ${person.mobile}` : ''}
              />
            );
          })}
        </ReviewBlock>

        <ReviewBlock title="受益所有人">
          {data.beneficiaries.map((item, index) => (
            <ReviewRow
              key={index}
              label={`受益人 ${index + 1}`}
              value={`${item.name} · ${item.idNumber} · ${item.benefitType}${
                item.shareRatio === null || item.shareRatio === undefined ? '' : ` · ${item.shareRatio}%`
              }`}
            />
          ))}
        </ReviewBlock>

        <ReviewBlock title="法人委托书（环节 11 材料 · 由金桥镇服务专员填写）">
          <ReviewRow
            label="受托人"
            value={data.agency.agentName ? `${data.agency.agentName} · ${data.agency.agentIdNumber}` : ''}
          />
          <ReviewRow label="委托日期" value={data.agency.principalDate || '打印后与签名一并手写'} />
          <ReviewRow label="委托人签名" value={data.agency.principalSign || '打印后亲笔签名'} />
        </ReviewBlock>

        <AgentNote title="以下环节由金桥镇经办人在平台内办理，无需在此填写，但请提前准备">
          <ul className="grid gap-1">
            <li>
              环节 3 经办人信息、环节 4 申请机关、环节 10 办理方式与环节 11 刻章材料，已列在页面右侧的「服务专员填写步骤」菜单中，点击即可查看，由专员填写，企业无需操作。
            </li>
            <li>
              环节 11 刻章信息：须提供法定代表人亲笔签名的法人委托书及法定代表人身份证正反面照片，材料限 jpg、单张不超过
              500K，请提前准备。委托书可在左侧菜单「环节 11 · 法人委托书」中查看并打印。
            </li>
            <li>环节 12 材料提交：务必先下载预览文件（特别是公司章程）核对无误后再正式提交。</li>
            <li>环节 13 其他联办事项：五险一金、涉税事项及银行开户预约本次无需填报。</li>
            <li>环节 14 结果查询：经营主体登记与企业印章刻制均显示「已办结」后，及时反馈金桥对接人。</li>
          </ul>
        </AgentNote>
      </div>
    </StepCard>
  );
}
