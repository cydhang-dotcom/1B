import type { ReactNode } from 'react';

import {
  CONFIG,
  ORG_OPTIONS,
  ROLES,
  filesOf,
  personOf,
  titleOf,
  type ApplicationData,
  type BasicInfo,
  type RoleRecord,
  type SetupInfo,
  type Shareholder,
} from './model';
import { Checkbox, ChoiceRow, Field, Panel, TextArea, attachmentState } from './ui';

/**
 * 类名与 DOM 结构对齐 企业注册服务申请系统-6.html；
 * 样式在 design.css，改动前先改原型。
 */

/** 一步里元素 id → 报错文案；记录类报错不在其中，单独挂在记录上 */
export type ErrorMap = Record<string, string>;

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
    <>
      <Panel
        title={
          <>
            企业组织形式<span className="req">*</span>
          </>
        }
        subtitle="请选择本次拟设立企业的组织形式。"
        number="01"
      >
        <div className={`field${errors.org || errors.orgOther ? ' invalid' : ''}`} id="field-org">
          <div className="choice-row" id="org" role="group" aria-label="企业组织形式">
            {ORG_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={basic.org === option}
                onClick={() => onChange({ org: option })}
                className={`choice${basic.org === option ? ' selected' : ''}`}
              >
                {option}
              </button>
            ))}
            <div className="other-group">
              <button
                type="button"
                aria-pressed={basic.org === '其他'}
                onClick={() => onChange({ org: '其他' })}
                className={`choice${basic.org === '其他' ? ' selected' : ''}`}
              >
                其他
              </button>
              {basic.org === '其他' && (
                <input
                  id="orgOther"
                  aria-label="具体组织形式"
                  value={basic.orgOther}
                  placeholder="请输入具体组织形式 *"
                  onChange={(event) => onChange({ orgOther: event.target.value })}
                />
              )}
            </div>
          </div>
          <div className="error">{errors.org}</div>
          <div className="error">{errors.orgOther}</div>
        </div>
      </Panel>

      <Panel title="企业业务" subtitle="帮助我们了解您的企业及拟开展的经营活动。" number="02">
        <div className="grid">
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
        <div className="grid">
          <div className={`field full${errors.capital ? ' invalid' : ''}`} id="field-capital">
            <div className="inline-label">
              <label htmlFor="capital">
                注册资本<span className="req">*</span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={basic.expert}
                  onChange={(event) => onChange({ expert: event.target.checked })}
                />
                专家推荐
              </label>
            </div>
            <div className="unit-input">
              <span className="currency">人民币 ¥</span>
              <input
                id="capital"
                inputMode="numeric"
                value={basic.capital}
                disabled={basic.expert}
                placeholder="请输入整数金额"
                aria-invalid={errors.capital ? true : undefined}
                onChange={(event) => onChange({ capital: event.target.value })}
              />
              <span className="unit">万元</span>
            </div>
            <div className="error">{errors.capital}</div>
            {basic.expert && <div className="hint">由服务人员根据企业情况提供注册资金建议。</div>}
          </div>
          <div className="note full">核名至设立完成期间，原则上请勿更改注册资金。</div>
        </div>
      </Panel>

      <Panel title="拟注册名称" subtitle="按您的意愿顺序填写。" number="04">
        <div className="names">
          {basic.names.map((name, index) => (
            <div key={index} className="name-row">
              <span className="name-order">{String(index + 1).padStart(2, '0')}</span>
              <div className={`field${errors[`name-${index}`] ? ' invalid' : ''}`} id={`field-name-${index}`}>
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
                />
                <div className="error">{errors[`name-${index}`]}</div>
              </div>
              {index >= CONFIG.nameInitial && (
                <button type="button" className="text" aria-label={`移除第 ${index + 1} 个名称`} onClick={() => onRemoveName(index)}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <button type="button" className="text" onClick={onAddName} disabled={basic.names.length >= CONFIG.nameMaximum}>
            ＋ 添加名称
          </button>
        </div>
      </Panel>

      <Panel title="地址信息" subtitle="您可以填写已有地址，也可由服务商提供推荐。" number="05">
        <div className="grid">
          {(
            [
              ['regAddress', 'regRecommend', '注册地址'],
              ['workAddress', 'workRecommend', '实际经营地址'],
            ] as const
          ).map(([key, flag, label]) => (
            <div key={key} className={`field full${errors[key] ? ' invalid' : ''}`} id={`field-${key}`}>
              <div className="inline-label">
                <label htmlFor={key}>
                  {label}
                  <span className="req">*</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={basic[flag]}
                    onChange={(event) => onChange({ [flag]: event.target.checked } as Partial<BasicInfo>)}
                  />
                  由服务商推荐
                </label>
              </div>
              <input
                id={key}
                value={basic[key]}
                disabled={basic[flag]}
                placeholder={basic[flag] ? '服务人员将与您沟通地址方案' : '省 / 市 / 区 / 街道及详细门牌号'}
                onChange={(event) => onChange({ [key]: event.target.value } as Partial<BasicInfo>)}
              />
              <div className="error">{errors[key]}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

/* ---------------------------------------------------------------- 步骤 2 */

/** 记录列表里的一行：头像 + 标题 + 副标题 + 右侧数值，对应原型 .record */
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
    <button type="button" id={id} className="record" onClick={onClick}>
      <span className="avatar">{avatar}</span>
      <span className="record-info">
        <span className="record-title">
          {title || '未填写名称'}
          {tags?.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </span>
        <span className="record-sub">{subtitle}</span>
      </span>
      {side && (
        <span className="record-side">
          {side.value || '—'}
          <small>{side.unit}</small>
        </span>
      )}
      <span className="record-chevron" aria-hidden="true">
        ›
      </span>
    </button>
  );
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
    <Panel
      title="股东及出资"
      subtitle={data.shareholders.length ? '点击股东记录可修改信息。' : '支持自然人、企业及其他类型股东。'}
      number="01"
    >
      {data.shareholders.length === 0 ? (
        <div className="empty">
          <button type="button" className="primary" onClick={onAdd}>
            ＋ 添加股东
          </button>
        </div>
      ) : (
        <>
          <div className="stat-strip">
            <span>
              股东人数 <strong>{data.shareholders.length}</strong> 人 / 家
            </span>
            <span>
              出资比例合计 <strong>{+total.toFixed(6)}</strong> %
            </span>
          </div>

          <div className="records">
            {data.shareholders.map((record: Shareholder) => {
              const person = personOf(data, record);
              const files = filesOf(record, person);
              return (
                <div key={record.id}>
                  <RecordRow
                    id={`share-${record.id}`}
                    avatar={
                      record.type === '自然人'
                        ? titleOf(record, person).slice(0, 1) || '人'
                        : record.type === '企业'
                          ? '企'
                          : '其'
                    }
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
                        {attachmentState(files, record.type !== '其他')}
                      </>
                    }
                    side={{ value: record.ratio, unit: '出资比例 %' }}
                    onClick={() => onEdit(record.id)}
                  />
                  {recordErrors[record.id] && <div className="error">{recordErrors[record.id]}</div>}
                </div>
              );
            })}
          </div>

          <div className="add-center">
            <button type="button" onClick={onAdd}>
              ＋ 添加股东
            </button>
          </div>
        </>
      )}
      <div className="panel-footnote">证件照片可稍后补充，提交前需上传齐全。</div>
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
      <div className="roles">
        {ROLES.map((role) => {
          const done = assigned.includes(role);
          const required = (CONFIG.requiredRoles as readonly string[]).includes(role);
          return (
            <span key={role} className={`role-pill${done ? ' done' : ''}`}>
              {done && '✓ '}
              {role}
              {required && ' *'}
            </span>
          );
        })}
      </div>
      {roleError && <div className="error">{roleError}</div>}

      {data.roles.length === 0 ? (
        <div className="empty">
          <button type="button" className="primary" onClick={onAdd}>
            ＋ 添加人员
          </button>
        </div>
      ) : (
        <>
          <div className="records">
            {data.roles.map((record: RoleRecord) => {
              const person = personOf(data, record);
              const files = person.files;
              return (
                <div key={record.id}>
                  <RecordRow
                    id={`role-${record.id}`}
                    avatar={person.name.slice(0, 1) || '人'}
                    title={person.name || '未填写姓名'}
                    tags={record.roles}
                    subtitle={
                      <>
                        {person.phone || '未填写联系电话'}
                        {' · '}
                        {attachmentState(files)}
                      </>
                    }
                    onClick={() => onEdit(record.id)}
                  />
                  {recordErrors[record.id] && <div className="error">{recordErrors[record.id]}</div>}
                </div>
              );
            })}
          </div>

          <div className="add-center">
            <button type="button" onClick={onAdd}>
              ＋ 添加人员
            </button>
          </div>
        </>
      )}
      <div className="panel-footnote">同一人员可选择多个角色，点击已有记录可调整。</div>
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
    <>
      <Panel title="董事会设置" subtitle="请根据企业的实际组织安排填写。" number="01">
        <div className="grid">
          <ChoiceRow
            id="board"
            label="是否设董事会"
            className="full"
            options={['设董事会', '不设董事会']}
            value={setup.board}
            onChange={(board) => onChange({ board })}
          />
          {setup.board === '设董事会' && (
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
          )}
          {setup.board === '不设董事会' && (
            <ChoiceRow
              id="singleDirector"
              label="董事安排"
              className="full"
              options={['一名董事', '执行董事']}
              value={setup.singleDirector}
              onChange={(singleDirector) => onChange({ singleDirector })}
            />
          )}
        </div>
      </Panel>

      <Panel title="监事会设置" number="02">
        <div className="grid">
          <ChoiceRow
            id="supervisorBoard"
            label="是否设监事会"
            className="full"
            options={['设监事会', '不设监事会']}
            value={setup.supervisorBoard}
            onChange={(supervisorBoard) => onChange({ supervisorBoard })}
          />
          {setup.supervisorBoard === '设监事会' && (
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
          )}
          {setup.supervisorBoard === '不设监事会' && (
            <>
              <ChoiceRow
                id="singleSupervisor"
                label="监事安排"
                className="full"
                options={['一名监事', '不设监事']}
                value={setup.singleSupervisor}
                onChange={(singleSupervisor) => onChange({ singleSupervisor })}
              />
              {setup.singleSupervisor === '不设监事' && (
                <Checkbox
                  id="unanimous"
                  className="full"
                  checked={setup.unanimous}
                  onChange={(unanimous) => onChange({ unanimous })}
                >
                  全体股东一致同意不设监事
                </Checkbox>
              )}
            </>
          )}
        </div>
      </Panel>

      <Panel title="经营安排" number="03">
        <div className="grid">
          <div className="field" id="field-term">
            <label htmlFor="term">
              设立期限
            </label>
            <ChoiceRow
              id="term"
              options={['长期', '固定年限']}
              value={setup.term}
              onChange={(term) => onChange({ term })}
            />
            {setup.term === '固定年限' && (
              <div className={`field term-years${errors.termYears ? ' invalid' : ''}`} id="field-termYears">
                <label htmlFor="termYears">
                  年限<span className="req">*</span>
                </label>
                <div className="unit-input">
                  <input
                    id="termYears"
                    type="number"
                    inputMode="numeric"
                    value={setup.termYears}
                    placeholder="请输入年限"
                    onChange={(event) => onChange({ termYears: event.target.value })}
                  />
                  <span className="unit">年</span>
                </div>
                <div className="error">{errors.termYears}</div>
              </div>
            )}
            {setup.legacyTerm && !setup.term && (
              <div className="hint">原填写期限：{setup.legacyTerm}。请选择新的期限方式。</div>
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

      <div className="note">
        请结合企业组织形式自行确定治理安排。本页暂不作治理结构强制校验，设立期限可选长期或固定年限。
      </div>
    </>
  );
}
