import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatSize, slotLabel } from './files';
import {
  companyCategory,
  filesOf,
  has,
  isPureNatural,
  personOf,
  titleOf,
  type ApplicationData,
  type Attachment,
  type Person,
} from './model';
import { Checkbox, Panel, TEXT_BUTTON } from './ui';
import type { ErrorMap } from './steps';

/** 一条「标签 + 值」的核对行，空值显示为破折号 */
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-stone-100 py-2.5 last:border-0">
      <dt className="w-28 shrink-0 text-xs text-stone-400">{label}</dt>
      <dd className="min-w-0 flex-1 whitespace-pre-line break-words text-sm text-stone-700">
        {value === null || value === undefined || value === '' ? <span className="text-stone-300">—</span> : value}
      </dd>
    </div>
  );
}

function AttachmentList({ files }: { files: Attachment[] }) {
  if (!files.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {files.map((file) => (
        <li
          key={file.id}
          className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] text-stone-500"
        >
          {file.slot ? `${slotLabel(file.slot)} · ` : ''}
          {file.name} · {formatSize(file.size)}
        </li>
      ))}
    </ul>
  );
}

function PersonBlock({ person, files }: { person: Person; files: Attachment[] }) {
  return (
    <>
      <dl>
        <Row label="联系电话" value={person.phone} />
        <Row label="电子邮箱" value={person.email} />
        <Row label="学历" value={person.education} />
        <Row label="居住地址" value={person.address} />
      </dl>
      <AttachmentList files={files} />
    </>
  );
}

export function ReviewStep({
  data,
  errors,
  onEditSection,
  onConfirm,
  onExport,
}: {
  data: ApplicationData;
  errors: ErrorMap;
  onEditSection: (section: number) => void;
  onConfirm: (patch: Partial<ApplicationData['confirm']>) => void;
  onExport: () => void;
}) {
  const { basic, setup, confirm } = data;
  const natural = isPureNatural(data);
  const submitted = data.status === 'submitted';

  const edit = (section: number) => (
    <button type="button" className={`${TEXT_BUTTON} inline-flex items-center gap-1`} onClick={() => onEditSection(section)}>
      修改
      <ArrowUpRight size={13} aria-hidden="true" />
    </button>
  );

  return (
    <div className="grid gap-5">
      {submitted && (
        <div className="rounded-2xl border border-[#66cdb5]/40 bg-[#e8f7f3] px-5 py-4">
          <h2 className="text-sm font-bold text-[#3f7d6d]">✓ 演示提交已完成</h2>
          <p className="mt-1.5 text-xs leading-6 text-[#3f7d6d]/80">
            此申请仅保存在当前浏览器，尚未发送给服务人员。
            <br />
            提交时间：{data.submittedAt} · 验证手机：{data.submissionPhone}
          </p>
          <button type="button" className={`${TEXT_BUTTON} mt-1.5`} onClick={onExport}>
            导出完整申请资料 ↓
          </button>
        </div>
      )}

      <Panel title="企业基本信息" number="01" action={edit(0)}>
        <dl>
          <Row label="组织形式" value={basic.org === '其他' ? basic.orgOther : basic.org} />
          <Row label="企业简介" value={basic.intro} />
          <Row label="主营服务简介" value={basic.service} />
          <Row label="经营范围" value={basic.scope} />
          <Row
            label="注册资本"
            value={basic.expert ? '专家推荐' : basic.capital ? `${basic.capital} 万元 · 人民币` : ''}
          />
          <Row
            label="拟注册名称"
            value={basic.names.map((name, index) => (has(name) ? `${index + 1}. ${name}` : '')).filter(Boolean).join('\n')}
          />
          <Row label="注册地址" value={basic.regRecommend ? '由服务商推荐' : basic.regAddress} />
          <Row label="实际经营地址" value={basic.workRecommend ? '由服务商推荐' : basic.workAddress} />
        </dl>
      </Panel>

      <Panel title="股东及出资" subtitle={`${data.shareholders.length} 位股东`} number="02" action={edit(1)}>
        {data.shareholders.length === 0 ? (
          <p className="text-sm text-stone-400">尚未添加股东</p>
        ) : (
          <div className="grid gap-3">
            {data.shareholders.map((record) => {
              const person = personOf(data, record);
              const files = filesOf(record, person);
              return (
                <div key={record.id} className="rounded-xl border border-stone-200/80 bg-stone-50/40 p-4">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-stone-800">
                    {titleOf(record, person) || '未填写'}
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-stone-500">
                      {record.type}
                    </span>
                  </h3>
                  {record.type === '自然人' ? (
                    <PersonBlock person={person} files={files} />
                  ) : (
                    <>
                      <dl>
                        {record.type === '企业' ? (
                          <Row label="统一社会信用代码" value={record.code} />
                        ) : (
                          <Row label="股东说明" value={record.name} />
                        )}
                      </dl>
                      <AttachmentList files={files} />
                    </>
                  )}
                  <dl>
                    <Row label="出资比例" value={has(record.ratio) ? `${record.ratio} %` : ''} />
                    <Row label="出资金额" value={has(record.amount) ? `${record.amount} 万元` : ''} />
                    <Row label="出资形式" value={record.method.join('、')} />
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="企业主要人员" number="03" action={edit(2)}>
        {data.roles.length === 0 ? (
          <p className="text-sm text-stone-400">尚未添加人员</p>
        ) : (
          <div className="grid gap-3">
            {data.roles.map((record) => {
              const person = personOf(data, record);
              return (
                <div key={record.id} className="rounded-xl border border-stone-200/80 bg-stone-50/40 p-4">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-stone-800">
                    {person.name || '未填写'}
                    {record.roles.map((role) => (
                      <span key={role} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-stone-500">
                        {role}
                      </span>
                    ))}
                  </h3>
                  <PersonBlock person={person} files={person.files} />
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="企业设立信息" number="04" action={edit(3)}>
        <dl>
          <Row label="董事会" value={setup.board} />
          {setup.board === '设董事会' ? (
            <Row label="董事人数" value={setup.directors} />
          ) : setup.board === '不设董事会' ? (
            <Row label="董事安排" value={setup.singleDirector} />
          ) : null}
          <Row label="监事会" value={setup.supervisorBoard} />
          {setup.supervisorBoard === '设监事会' ? (
            <Row label="监事人数" value={setup.supervisors} />
          ) : setup.supervisorBoard === '不设监事会' ? (
            <Row label="监事安排" value={setup.singleSupervisor} />
          ) : null}
          {setup.supervisorBoard === '不设监事会' && setup.singleSupervisor === '不设监事' ? (
            <Row label="股东一致同意" value={setup.unanimous ? '已确认' : '未确认'} />
          ) : null}
          <Row
            label="设立期限"
            value={
              setup.term === '固定年限'
                ? setup.termYears
                  ? `${setup.termYears} 年`
                  : '固定年限（未填写年限）'
                : setup.term || setup.legacyTerm
            }
          />
          <Row label="员工人数" value={setup.employees} />
        </dl>
      </Panel>

      <Panel title="免申报受益所有人信息承诺" subtitle="选填；不作承诺也可继续提交。" number="05">
        {natural ? (
          <div className="grid gap-3">
            <Checkbox
              id="exemption"
              checked={confirm.exemption}
              onChange={(exemption) => onConfirm({ exemption })}
            >
              我确认本企业股东均为自然人，申请免申报受益所有人信息，并同意由服务人员核验适用条件。
            </Checkbox>
            {confirm.exemption && (
              <p className="rounded-xl bg-[#e8f7f3] px-4 py-2.5 text-xs font-semibold text-[#3f7d6d]">
                已作出承诺 · 适用条件待核验
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs leading-6 text-stone-400">
            {data.shareholders.length
              ? '本申请含企业或其他类型股东，不作免申报承诺。'
              : '填写股东信息后，可按实际情况选择是否作出承诺。'}
          </p>
        )}
        <p className="mt-3 text-xs leading-5 text-stone-400">不满足条件或不作承诺时，无需填写受益所有人信息。</p>
        <details className="mt-3 rounded-xl bg-stone-50 px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold text-stone-600">查看承诺条件</summary>
          <div className="mt-3 grid gap-2 text-xs text-stone-500">
            <div className="flex flex-wrap justify-between gap-2">
              <span>股东构成：{companyCategory(data)}</span>
              <span className={natural ? 'font-semibold text-[#3f9d87]' : ''}>
                {natural ? '全部为自然人' : data.shareholders.length ? '不满足股东类型条件' : '待填写'}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span>
                注册资本：
                {basic.expert ? '专家推荐，金额待定' : basic.capital ? `${basic.capital} 万元` : '未填写'}
              </span>
              <span>门槛待确认</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span>出资比例、控制权及其他条件</span>
              <span>待核验</span>
            </div>
            <p className="text-[11px] leading-5 text-stone-400">
              本页按项目业务规则记录承诺，不自动认定免申报资格。
            </p>
          </div>
        </details>
      </Panel>

      <Panel title="信息确认" number="06">
        <Checkbox id="accurate" checked={confirm.accurate} onChange={(accurate) => onConfirm({ accurate })} error={errors.accurate}>
          我已核对本次申请信息，确认所填内容及提供的资料真实、完整，并同意服务人员就申请事项与我联系。
        </Checkbox>
      </Panel>
    </div>
  );
}
