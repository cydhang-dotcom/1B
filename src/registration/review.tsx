import type { ReactNode } from 'react';

import { formatSize, openAttachment } from './files';
import {
  authorizationUploaded,
  companyCategory,
  filesOf,
  has,
  isPureNatural,
  personOf,
  titleOf,
  trusteeOf,
  type ApplicationData,
  type Attachment,
  type Person,
} from './model';
import { Checkbox, Panel, attachmentState } from './ui';
import type { ErrorMap } from './steps';

/**
 * 类名与 DOM 结构对齐 企业注册服务申请系统-6.html；
 * 样式在 design.css，改动前先改原型。
 */

/** 一条「标签 + 值」的核对行，空值显示为未填写，对应原型 row() */
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="review-line">
      <dt>{label}</dt>
      <dd>{value === null || value === undefined || value === '' ? <span className="muted">未填写</span> : value}</dd>
    </div>
  );
}

/** 已上传附件：点开预览或下载，对应原型 reviewFiles() */
function AttachmentList({ files }: { files: Attachment[] }) {
  if (!files.length) return null;
  return (
    <div className="review-files">
      {files.map((file) => (
        <button key={file.id} type="button" onClick={() => openAttachment(file)}>
          ▧ {file.name} · {formatSize(file.size)}
        </button>
      ))}
    </div>
  );
}

/** 自然人的联系信息与附件，对应原型 personSummary() */
function PersonBlock({ person, files }: { person: Person; files: Attachment[] }) {
  return (
    <>
      <dl className="review-block">
        <Row label="联系电话" value={person.phone} />
        <Row label="电子邮箱" value={person.email} />
        <Row label="学历" value={person.education} />
        <Row label="居住地址" value={person.address} />
      </dl>
      {attachmentState(files)}
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
    <button type="button" className="text" onClick={() => onEditSection(section)}>
      修改 ↗
    </button>
  );

  return (
    <>
      {submitted && (
        <div className="success-box">
          <h2>✓ 演示提交已完成</h2>
          <p>此申请仅保存在当前浏览器，尚未发送给服务人员。</p>
          <p>
            提交时间：{data.submittedAt} · 验证手机：{data.submissionPhone}
          </p>
          <button type="button" className="text" onClick={onExport}>
            导出完整申请资料 ↓
          </button>
        </div>
      )}

      <Panel title="企业基本信息" action={edit(0)}>
        <dl className="review-block">
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

      <Panel title="股东及出资" subtitle={`${data.shareholders.length} 位股东`} action={edit(1)}>
        {data.shareholders.length === 0 ? (
          <span className="muted">尚未添加股东</span>
        ) : (
          data.shareholders.map((record) => {
            const person = personOf(data, record);
            const files = filesOf(record, person);
            return (
              <div key={record.id} className="review-person">
                <h3>
                  {titleOf(record, person) || '未填写'} <span className="tag">{record.type}</span>
                </h3>
                {record.type === '自然人' ? (
                  <PersonBlock person={person} files={files} />
                ) : (
                  <>
                    <dl className="review-block">
                      {record.type === '企业' ? (
                        <Row label="统一社会信用代码" value={record.code} />
                      ) : (
                        <Row label="股东说明" value={record.name} />
                      )}
                    </dl>
                    <AttachmentList files={files} />
                  </>
                )}
                <dl className="review-block">
                  <Row label="出资比例" value={has(record.ratio) ? `${record.ratio} %` : ''} />
                  <Row label="出资金额" value={has(record.amount) ? `${record.amount} 万元` : ''} />
                  <Row label="出资形式" value={record.method.join('、')} />
                </dl>
              </div>
            );
          })
        )}
      </Panel>

      <Panel title="企业主要人员" action={edit(2)}>
        {data.roles.length === 0 ? (
          <span className="muted">尚未添加人员</span>
        ) : (
          data.roles.map((record) => {
            const person = personOf(data, record);
            return (
              <div key={record.id} className="review-person">
                <h3>
                  {person.name}{' '}
                  {record.roles.map((role) => (
                    <span key={role} className="tag">
                      {role}
                    </span>
                  ))}
                </h3>
                <PersonBlock person={person} files={person.files} />
              </div>
            );
          })
        )}
      </Panel>

      <Panel title="企业设立信息" action={edit(3)}>
        <dl className="review-block">
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

      <Panel
        title="委托书办理"
        subtitle={
          authorizationUploaded(data)
            ? `已上传 ${data.authorization.files.length} 份委托书`
            : '尚未上传已签署委托书'
        }
        action={edit(4)}
      >
        <dl className="review-block">
          <Row label="受托人姓名" value={trusteeOf(data).name} />
          <Row label="受托人身份证号" value={data.authorization.trusteeIdNumber} />
        </dl>
        {authorizationUploaded(data) ? (
          <AttachmentList files={data.authorization.files} />
        ) : (
          <span className="muted">尚未上传已签署的委托书</span>
        )}
      </Panel>

      <Panel title="免申报受益所有人信息承诺" subtitle="选填；不作承诺也可继续提交。" number="06">
        {natural ? (
          <div className="exemption-option">
            <Checkbox id="exemption" checked={confirm.exemption} onChange={(exemption) => onConfirm({ exemption })}>
              我确认本企业股东均为自然人，申请免申报受益所有人信息，并同意由服务人员核验适用条件。
            </Checkbox>
            {confirm.exemption && <div className="exemption-status">已作出承诺 · 适用条件待核验</div>}
          </div>
        ) : (
          <p className="exemption-unavailable">
            {data.shareholders.length
              ? '本申请含企业或其他类型股东，不作免申报承诺。'
              : '填写股东信息后，可按实际情况选择是否作出承诺。'}
          </p>
        )}
        <div className="exemption-help">不满足条件或不作承诺时，无需填写受益所有人信息。</div>
        <details className="exemption-details">
          <summary>查看承诺条件</summary>
          <div className="condition">
            <span>股东构成：{companyCategory(data)}</span>
            <span className={natural ? 'yes' : ''}>
              {natural ? '全部为自然人' : data.shareholders.length ? '不满足股东类型条件' : '待填写'}
            </span>
          </div>
          <div className="condition">
            <span>
              注册资本：
              {basic.expert ? '专家推荐，金额待定' : basic.capital ? `${basic.capital} 万元` : '未填写'}
            </span>
            <span>门槛待确认</span>
          </div>
          <div className="condition">
            <span>出资比例、控制权及其他条件</span>
            <span>待核验</span>
          </div>
          <div className="hint">本页按项目业务规则记录承诺，不自动认定免申报资格。</div>
        </details>
      </Panel>

      <Panel title="信息确认" number="07">
        <Checkbox
          id="accurate"
          checked={confirm.accurate}
          onChange={(accurate) => onConfirm({ accurate })}
          error={errors.accurate ?? ''}
        >
          我已核对本次申请信息，确认所填内容及提供的资料真实、完整，并同意服务人员就申请事项与我联系。
        </Checkbox>
      </Panel>
    </>
  );
}
