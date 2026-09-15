import { Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  CONFIG,
  ORG_OPTIONS,
  ROLES,
  filesOf,
  personOf,
  titleOf,
  type ApplicationData,
  type Attachment,
  type BasicInfo,
  type RoleRecord,
  type SetupInfo,
  type Shareholder,
} from './model';
import {
  Checkbox,
  ChoiceRow,
  Field,
  Panel,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  TEXT_BUTTON,
  TextArea,
} from './ui';

/** 一步里元素 id → 报错文案；记录类报错不在其中，单独挂在记录上 */
export type ErrorMap = Record<string, string>;

const GRID = 'grid gap-5 sm:grid-cols-2';

/* ---------------------------------------------------------------- 步骤 1 */

export function BasicStep({
  basic,
  onChange,
  errors,
  onAddName,
  onRemoveName,
}: {
  basic: BasicInfo;
  onChange: (patch: Partial<BasicInfo>) => void;
  errors: ErrorMap;
  onAddName: () => void;
  onRemoveName: (index: number) => void;
}) {
  return (
    <div className="grid gap-5">
      <Panel
        title={
          <>
            企业组织形式<span className="ml-0.5 text-[#42a98f]">*</span>
          </>
        }
        subtitle="请选择本次拟设立企业的组织形式。"
        number="01"
      >
        <ChoiceRow
          id="org"
          label="组织形式"
          options={ORG_OPTIONS}
          value={basic.org}
          onChange={(org) => onChange({ org })}
          error={errors.org}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={basic.org === '其他'}
            onClick={() => onChange({ org: '其他' })}
            className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20 ${
              basic.org === '其他'
                ? 'border-[#66cdb5] bg-[#66cdb5] text-white'
                : 'border-stone-300/70 bg-white text-stone-600 hover:border-[#66cdb5]/60'
            }`}
          >
            其他
          </button>
          {basic.org === '其他' && (
            <input
              id="orgOther"
              aria-label="具体组织形式"
              value={basic.orgOther}
              placeholder="请输入具体组织形式"
              onChange={(event) => onChange({ orgOther: event.target.value })}
              className="h-11 min-w-52 flex-1 rounded-xl border border-stone-300/70 bg-white px-3.5 text-sm outline-none focus:border-[#66cdb5] focus:ring-4 focus:ring-[#66cdb5]/10"
            />
          )}
        </div>
        {errors.orgOther && (
          <p id="orgOther-error" className="mt-1.5 text-xs font-medium text-red-500">
            {errors.orgOther}
          </p>
        )}
      </Panel>

      <Panel title="企业业务" subtitle="帮助我们了解您的企业及拟开展的经营活动。" number="02">
        <div className={GRID}>
          <TextArea
            id="intro"
            label="企业简介"
            value={basic.intro}
            placeholder="简要介绍企业定位、发展方向或项目情况"
            error={errors.intro}
            onChange={(intro) => onChange({ intro })}
          />
          <TextArea
            id="service"
            label="主营服务简介"
            value={basic.service}
            placeholder="说明主要产品、服务及客户群体"
            error={errors.service}
            onChange={(service) => onChange({ service })}
          />
          <TextArea
            id="scope"
            label="经营范围"
            value={basic.scope}
            placeholder="填写拟开展的经营项目，可分行填写"
            error={errors.scope}
            onChange={(scope) => onChange({ scope })}
          />
        </div>
      </Panel>

      <Panel title="注册资金" number="03">
        <div className={GRID}>
          <div className="sm:col-span-2">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
              <label htmlFor="capital" className="text-sm font-semibold text-stone-700">
                注册资本<span className="ml-0.5 text-[#42a98f]">*</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-stone-600">
                <input
                  type="checkbox"
                  checked={basic.expert}
                  onChange={(event) => onChange({ expert: event.target.checked })}
                  className="h-4 w-4 cursor-pointer accent-[#66cdb5]"
                />
                专家推荐
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-l-xl border border-r-0 border-stone-300/70 bg-stone-50 px-3 py-3 text-xs text-stone-500">
                人民币 ¥
              </span>
              <input
                id="capital"
                inputMode="numeric"
                value={basic.capital}
                disabled={basic.expert}
                placeholder="请输入整数金额"
                aria-invalid={errors.capital ? true : undefined}
                aria-describedby={errors.capital ? 'capital-error' : undefined}
                onChange={(event) => onChange({ capital: event.target.value })}
                className={`h-11 w-full rounded-r-xl border border-stone-300/70 bg-white px-3.5 text-sm outline-none focus:border-[#66cdb5] focus:ring-4 focus:ring-[#66cdb5]/10 ${
                  basic.expert ? 'cursor-not-allowed bg-stone-50 text-stone-400' : ''
                } ${errors.capital ? 'border-red-400' : ''}`}
              />
              <span className="shrink-0 text-xs text-stone-500">万元</span>
            </div>
            {basic.expert && (
              <p className="mt-1.5 text-xs leading-5 text-stone-400">由服务人员根据企业情况提供注册资金建议。</p>
            )}
            {errors.capital && (
              <p id="capital-error" className="mt-1.5 text-xs font-medium text-red-500">
                {errors.capital}
              </p>
            )}
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-amber-50/70 px-4 py-3 text-xs leading-5 text-amber-700">
          核名至设立完成期间，原则上请勿更改注册资金。
        </p>
      </Panel>

      <Panel title="拟注册名称" subtitle="按您的意愿顺序填写。" number="04">
        <div className="grid gap-3">
          {basic.names.map((name, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-xs font-bold text-stone-400">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <input
                  id={`name-${index}`}
                  aria-label={`第 ${index + 1} 个拟注册名称`}
                  value={name}
                  placeholder={
                    index === 0
                      ? '首选企业名称'
                      : index < CONFIG.nameInitial
                        ? '备选企业名称'
                        : '新增企业名称（必填）'
                  }
                  onChange={(event) => {
                    const names = [...basic.names];
                    names[index] = event.target.value;
                    onChange({ names });
                  }}
                  className={`h-11 w-full rounded-xl border border-stone-300/70 bg-white px-3.5 text-sm outline-none focus:border-[#66cdb5] focus:ring-4 focus:ring-[#66cdb5]/10 ${
                    errors[`name-${index}`] ? 'border-red-400' : ''
                  }`}
                />
                {errors[`name-${index}`] && (
                  <p className="mt-1.5 text-xs font-medium text-red-500">{errors[`name-${index}`]}</p>
                )}
              </div>
              {index >= CONFIG.nameInitial && (
                <button
                  type="button"
                  aria-label={`移除第 ${index + 1} 个名称`}
                  onClick={() => onRemoveName(index)}
                  className="shrink-0 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-red-500"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onAddName}
          disabled={basic.names.length >= CONFIG.nameMaximum}
          className={`${TEXT_BUTTON} mt-3 inline-flex items-center gap-1`}
        >
          <Plus size={14} aria-hidden="true" />
          添加名称
        </button>
      </Panel>

      <Panel title="地址信息" subtitle="您可以填写已有地址，也可由服务商提供推荐。" number="05">
        <div className={GRID}>
          {(
            [
              ['regAddress', 'regRecommend', '注册地址'],
              ['workAddress', 'workRecommend', '实际经营地址'],
            ] as const
          ).map(([key, flag, label]) => (
            <div key={key} className="sm:col-span-2">
              <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
                <label htmlFor={key} className="text-sm font-semibold text-stone-700">
                  {label}
                  <span className="ml-0.5 text-[#42a98f]">*</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-stone-600">
                  <input
                    type="checkbox"
                    checked={basic[flag]}
                    onChange={(event) => onChange({ [flag]: event.target.checked } as Partial<BasicInfo>)}
                    className="h-4 w-4 cursor-pointer accent-[#66cdb5]"
                  />
                  由服务商推荐
                </label>
              </div>
              <input
                id={key}
                value={basic[key]}
                disabled={basic[flag]}
                placeholder={
                  basic[flag] ? '服务人员将与您沟通地址方案' : '省 / 市 / 区 / 街道及详细门牌号'
                }
                onChange={(event) => onChange({ [key]: event.target.value } as Partial<BasicInfo>)}
                className={`h-11 w-full rounded-xl border border-stone-300/70 bg-white px-3.5 text-sm outline-none focus:border-[#66cdb5] focus:ring-4 focus:ring-[#66cdb5]/10 ${
                  basic[flag] ? 'cursor-not-allowed bg-stone-50 text-stone-400' : ''
                } ${errors[key] ? 'border-red-400' : ''}`}
              />
              {errors[key] && (
                <p id={`${key}-error`} className="mt-1.5 text-xs font-medium text-red-500">
                  {errors[key]}
                </p>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- 步骤 2 */

/** 记录列表里的一行：头像 + 标题 + 副标题 + 右侧数值 */
function RecordRow({
  id,
  avatar,
  title,
  tags,
  subtitle,
  side,
  onClick,
}: {
  id: string;
  avatar: string;
  title: string;
  tags?: string[];
  subtitle: ReactNode;
  side?: { value: string; unit: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-xl border border-stone-200/80 bg-white px-4 py-3.5 text-left transition-colors hover:border-[#66cdb5]/60 hover:bg-[#f7fcfb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f7f3] text-sm font-bold text-[#3f9d87]">
        {avatar}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-stone-800">{title || '未填写名称'}</span>
          {tags?.map((tag) => (
            <span key={tag} className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">
              {tag}
            </span>
          ))}
        </span>
        <span className="mt-0.5 block truncate text-xs text-stone-500">{subtitle}</span>
      </span>
      {side && (
        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold text-stone-700">{side.value || '—'}</span>
          <span className="block text-[10px] text-stone-400">{side.unit}</span>
        </span>
      )}
      <span className="shrink-0 text-lg text-stone-300" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

/** 附件状态文案：缺照片时优先提示补齐 */
function attachmentState(files: Attachment[], needed = true, complete = false): ReactNode {
  if (needed && !complete) return <span className="font-semibold text-amber-600">照片待补齐</span>;
  return files.length ? <span className="text-stone-500">资料 {files.length} 份</span> : needed ? <span className="font-semibold text-amber-600">没有照片</span> : <span className="text-stone-400">未附资料</span>;
}

export function ShareholderStep({
  data,
  onAdd,
  onEdit,
  recordErrors,
}: {
  data: ApplicationData;
  onAdd: () => void;
  onEdit: (id: string) => void;
  recordErrors: Record<string, string>;
}) {
  const total = data.shareholders.reduce((sum, record) => sum + (Number(record.ratio) || 0), 0);

  return (
    <Panel title="股东及出资" subtitle={data.shareholders.length ? '点击股东记录可修改信息。' : '支持自然人、企业及其他类型股东。'} number="01">
      {data.shareholders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <button type="button" className={PRIMARY_BUTTON} onClick={onAdd}>
            <Plus size={15} aria-hidden="true" />
            添加股东
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-6 rounded-xl bg-stone-50 px-4 py-3 text-xs text-stone-500">
            <span>
              股东人数 <strong className="text-sm text-stone-800">{data.shareholders.length}</strong> 人 / 家
            </span>
            <span>
              出资比例合计 <strong className="text-sm text-stone-800">{+total.toFixed(6)}</strong> %
            </span>
          </div>

          <div className="grid gap-2.5">
            {data.shareholders.map((record: Shareholder) => {
              const person = personOf(data, record);
              const files = filesOf(record, person);
              return (
                <div key={record.id}>
                  <RecordRow
                    id={`share-${record.id}`}
                    avatar={person.name.slice(0, 1) || (record.type === '企业' ? '企' : '其')}
                    title={titleOf(record, person)}
                    tags={[record.type]}
                    subtitle={
                      <>
                        {record.type === '自然人'
                          ? person.phone || '未填写联系电话'
                          : record.type === '企业'
                            ? record.code || '未填写证件号码'
                            : '其他类型股东'}
                        {' · '}
                        {attachmentState(
                          files,
                          record.type !== '其他',
                          record.type === '自然人'
                            ? ['idFront', 'idBack'].every((slot) => files.some((f) => f.slot === slot))
                            : files.some((f) => f.slot === 'license'),
                        )}
                      </>
                    }
                    side={{ value: record.ratio, unit: '出资比例 %' }}
                    onClick={() => onEdit(record.id)}
                  />
                  {recordErrors[record.id] && (
                    <p className="mt-1.5 px-1 text-xs font-medium text-red-500">{recordErrors[record.id]}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-center">
            <button type="button" className={SECONDARY_BUTTON} onClick={onAdd}>
              <Plus size={15} aria-hidden="true" />
              添加股东
            </button>
          </div>
        </>
      )}
      <p className="mt-4 text-xs leading-5 text-stone-400">证件照片可稍后补充，提交前需上传齐全。</p>
    </Panel>
  );
}

/* ---------------------------------------------------------------- 步骤 3 */

export function PersonnelStep({
  data,
  onAdd,
  onEdit,
  recordErrors,
  roleError,
}: {
  data: ApplicationData;
  onAdd: () => void;
  onEdit: (id: string) => void;
  recordErrors: Record<string, string>;
  roleError?: string;
}) {
  const assigned = data.roles.flatMap((record) => record.roles);

  return (
    <Panel title="企业主要人员" subtitle="可复用已有自然人，也可添加新人员。" number="01">
      <div className="mb-4 flex flex-wrap gap-2">
        {ROLES.map((role) => {
          const done = assigned.includes(role);
          const required = (CONFIG.requiredRoles as readonly string[]).includes(role);
          return (
            <span
              key={role}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                done ? 'bg-[#e8f7f3] text-[#3f9d87]' : 'bg-stone-100 text-stone-400'
              }`}
            >
              {done && '✓ '}
              {role}
              {required && ' *'}
            </span>
          );
        })}
      </div>
      {roleError && <p className="mb-3 text-xs font-medium text-red-500">{roleError}</p>}

      {data.roles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <button type="button" className={PRIMARY_BUTTON} onClick={onAdd}>
            <Plus size={15} aria-hidden="true" />
            添加人员
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-2.5">
            {data.roles.map((record: RoleRecord) => {
              const person = personOf(data, record);
              const files = person.files;
              return (
                <div key={record.id}>
                  <RecordRow
                    id={`role-${record.id}`}
                    avatar={person.name.slice(0, 1) || '人'}
                    title={person.name}
                    tags={record.roles}
                    subtitle={
                      <>
                        {person.phone || '未填写联系电话'}
                        {' · '}
                        {attachmentState(
                          files,
                          true,
                          ['idFront', 'idBack'].every((slot) => files.some((f) => f.slot === slot)),
                        )}
                      </>
                    }
                    onClick={() => onEdit(record.id)}
                  />
                  {recordErrors[record.id] && (
                    <p className="mt-1.5 px-1 text-xs font-medium text-red-500">{recordErrors[record.id]}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-center">
            <button type="button" className={SECONDARY_BUTTON} onClick={onAdd}>
              <Plus size={15} aria-hidden="true" />
              添加人员
            </button>
          </div>
        </>
      )}
      <p className="mt-4 text-xs leading-5 text-stone-400">同一人员可选择多个角色，点击已有记录可调整。</p>
    </Panel>
  );
}

/* ---------------------------------------------------------------- 步骤 4 */

export function SetupStep({
  setup,
  onChange,
  errors,
}: {
  setup: SetupInfo;
  onChange: (patch: Partial<SetupInfo>) => void;
  errors: ErrorMap;
}) {
  return (
    <div className="grid gap-5">
      <Panel title="董事会设置" subtitle="请根据企业的实际组织安排填写。" number="01">
        <ChoiceRow
          id="board"
          label="是否设董事会"
          options={['设董事会', '不设董事会']}
          value={setup.board}
          onChange={(board) => onChange({ board })}
        />
        {setup.board === '设董事会' && (
          <div className="mt-4 max-w-xs">
            <Field
              id="directors"
              label="董事人数"
              type="number"
              inputMode="numeric"
              value={setup.directors}
              placeholder="请输入人数"
              error={errors.directors}
              onChange={(directors) => onChange({ directors })}
            />
          </div>
        )}
        {setup.board === '不设董事会' && (
          <div className="mt-4">
            <ChoiceRow
              id="singleDirector"
              label="董事安排"
              options={['一名董事', '执行董事']}
              value={setup.singleDirector}
              onChange={(singleDirector) => onChange({ singleDirector })}
            />
          </div>
        )}
      </Panel>

      <Panel title="监事会设置" number="02">
        <ChoiceRow
          id="supervisorBoard"
          label="是否设监事会"
          options={['设监事会', '不设监事会']}
          value={setup.supervisorBoard}
          onChange={(supervisorBoard) => onChange({ supervisorBoard })}
        />
        {setup.supervisorBoard === '设监事会' && (
          <div className="mt-4 max-w-xs">
            <Field
              id="supervisors"
              label="监事人数"
              type="number"
              inputMode="numeric"
              value={setup.supervisors}
              placeholder="请输入人数"
              error={errors.supervisors}
              onChange={(supervisors) => onChange({ supervisors })}
            />
          </div>
        )}
        {setup.supervisorBoard === '不设监事会' && (
          <div className="mt-4 grid gap-4">
            <ChoiceRow
              id="singleSupervisor"
              label="监事安排"
              options={['一名监事', '不设监事']}
              value={setup.singleSupervisor}
              onChange={(singleSupervisor) => onChange({ singleSupervisor })}
            />
            {setup.singleSupervisor === '不设监事' && (
              <Checkbox
                id="unanimous"
                checked={setup.unanimous}
                onChange={(unanimous) => onChange({ unanimous })}
              >
                全体股东一致同意不设监事
              </Checkbox>
            )}
          </div>
        )}
      </Panel>

      <Panel title="经营安排" number="03">
        <div className={GRID}>
          <div>
            <ChoiceRow
              id="term"
              label="设立期限"
              options={['长期', '固定年限']}
              value={setup.term}
              onChange={(term) => onChange({ term })}
            />
            {setup.term === '固定年限' && (
              <div className="mt-4 max-w-xs">
                <Field
                  id="termYears"
                  label="年限"
                  required
                  type="number"
                  inputMode="numeric"
                  suffix="年"
                  value={setup.termYears}
                  placeholder="请输入年限"
                  error={errors.termYears}
                  onChange={(termYears) => onChange({ termYears })}
                />
              </div>
            )}
            {setup.legacyTerm && !setup.term && (
              <p className="mt-2 text-xs leading-5 text-amber-600">
                原填写期限：{setup.legacyTerm}。请选择新的期限方式。
              </p>
            )}
          </div>
          <Field
            id="employees"
            label="员工人数"
            type="number"
            inputMode="numeric"
            value={setup.employees}
            placeholder="请输入人数"
            error={errors.employees}
            onChange={(employees) => onChange({ employees })}
          />
        </div>
      </Panel>

      <p className="rounded-2xl bg-stone-50 px-5 py-4 text-xs leading-6 text-stone-500">
        请结合企业组织形式自行确定治理安排。本页暂不作治理结构强制校验，设立期限可选长期或固定年限。
      </p>
    </div>
  );
}
