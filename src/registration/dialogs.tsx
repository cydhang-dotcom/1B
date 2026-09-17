import { useState } from 'react';

import { assignSlot, formatSize, openAttachment, readFiles, replaceSlot } from './files';
import {
  CONTRIBUTION_METHODS,
  EDUCATION_OPTIONS,
  ROLES,
  activePeople,
  clone,
  has,
  type ApplicationData,
  type Attachment,
  type Person,
  type PhotoSlot,
  type RoleRecord,
  type Shareholder,
} from './model';
import { roleDraftErrors, shareholderDraftErrors } from './schema';
import { ChoiceMulti, ContributionField, Dialog, Field, PhotoSlots } from './ui';

/**
 * 类名与 DOM 结构对齐 企业注册服务申请系统-6.html；
 * 样式在 design.css，改动前先改原型。
 */

/** 打开弹窗时要编辑的记录；linked 表示基础信息来自已有人员，只读 */
export type EditTarget = {
  kind: 'share' | 'role';
  record: Shareholder | RoleRecord;
  person: Person;
  linked: boolean;
  isNew: boolean;
};

type SavePayload = {
  record: Shareholder | RoleRecord;
  person: Person;
  linked: boolean;
  isNew: boolean;
  /** 关联人员时照片是否改过，改过才回写到 people */
  attachmentsDirty: boolean;
};

/* -------------------------------------------------------------- 复用已有人员 */

function ReuseRow({
  people,
  activeId,
  onPick,
}: {
  people: Array<{ id: string; name: string; phone: string }>;
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  if (!people.length) return null;
  return (
    <div className="reuse">
      <div className="reuse-title">复用已有人员</div>
      <div className="choice-row">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            aria-pressed={person.id === activeId}
            onClick={() => onPick(person.id)}
            className={`choice${person.id === activeId ? ' selected' : ''}`}
          >
            {person.name || '未命名'} <span className="muted">{person.phone && person.phone.slice(-4)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 弹窗内容 */

function usePersonDraft(target: EditTarget, kind: 'share' | 'role') {
  const [record, setRecord] = useState(() => clone(target.record));
  const [person, setPerson] = useState(() => clone(target.person));
  const [linked, setLinked] = useState(target.linked);
  const [sourceId, setSourceId] = useState(target.record.personId);
  const [attachmentsDirty, setAttachmentsDirty] = useState(false);
  const [busy, setBusy] = useState(0);

  const natural = kind === 'role' || (record as Shareholder).type === '自然人';
  const files = natural ? person.files : (record as Shareholder).files;

  return {
    record,
    setRecord,
    person,
    setPerson,
    linked,
    setLinked,
    sourceId,
    setSourceId,
    attachmentsDirty,
    setAttachmentsDirty,
    busy,
    setBusy,
    natural,
    files,
  };
}

export function RecordDialog({
  target,
  data,
  initialError = '',
  onClose,
  onSaved,
  onDelete,
}: {
  target: EditTarget;
  data: ApplicationData;
  /** 从错误摘要跳进来时的报错文案 */
  initialError?: string;
  onClose: () => void;
  onSaved: (payload: SavePayload) => void;
  onDelete: () => void;
}) {
  const { kind } = target;
  const draft = usePersonDraft(target, kind);
  const [error, setError] = useState(initialError);
  const record = draft.record;
  const share = kind === 'share' ? (record as Shareholder) : null;
  const role = kind === 'role' ? (record as RoleRecord) : null;
  const natural = draft.natural;

  // 已有人员里排除掉被其他记录占用的人；股东沿用参考实现的宽松处理
  const people = activePeople(data).filter((value) =>
    kind === 'role' ? !data.roles.some((item) => item.id !== record.id && item.personId === value.id) : true,
  );

  const pickPerson = (id: string) => {
    draft.setPerson(clone(data.people[id]));
    draft.setRecord({ ...record, personId: id } as typeof record);
    draft.setSourceId(id);
    draft.setLinked(true);
    draft.setAttachmentsDirty(false);
  };

  const detach = () => {
    draft.setRecord({ ...record, personId: null } as typeof record);
    draft.setLinked(false);
  };

  const withFiles = (next: Attachment[]) => {
    if (natural) {
      draft.setPerson({ ...draft.person, files: next });
      if (draft.linked) draft.setAttachmentsDirty(true);
    } else {
      draft.setRecord({ ...record, files: next } as typeof record);
    }
  };

  const read = async (file: File, slot: PhotoSlot | null, replace = false) => {
    draft.setBusy((count) => count + 1);
    try {
      const [attachment] = await readFiles([file]);
      const current = draft.files;
      const next =
        slot === null
          ? [...current, attachment]
          : replace
            ? replaceSlot(current, attachment, slot)
            : [...current, { ...attachment, slot }];
      withFiles(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法读取文件');
    } finally {
      draft.setBusy((count) => count - 1);
    }
  };

  const save = () => {
    const record0 = clone(record);
    const person0 = clone(draft.person);
    const messages =
      kind === 'share'
        ? shareholderDraftErrors(record0 as Shareholder, person0)
        : roleDraftErrors(
            record0 as RoleRecord,
            person0,
            Boolean(
              draft.sourceId &&
                data.roles.some((item) => item.id !== record0.id && item.personId === draft.sourceId),
            ),
          );
    if (messages.length) {
      setError(messages.join('；'));
      return;
    }
    onSaved({
      record: record0,
      person: person0,
      linked: draft.linked,
      isNew: target.isNew,
      attachmentsDirty: draft.attachmentsDirty,
    });
  };

  const title = `${target.isNew ? '添加' : '编辑'}${kind === 'share' ? `${share!.type}股东` : '企业主要人员'}`;

  return (
    <Dialog
      title={title}
      error={error}
      blockEscape={draft.busy > 0}
      onClose={onClose}
      footer={
        <>
          <div>
            {!target.isNew && (
              <button type="button" className="text danger" onClick={onDelete}>
                删除记录
              </button>
            )}
          </div>
          <div>
            <button type="button" onClick={onClose}>
              取消
            </button>
            <button type="button" className="primary" disabled={draft.busy > 0} onClick={save}>
              保存记录
            </button>
          </div>
        </>
      }
    >
      {natural && (
        <>
          <ReuseRow people={people} activeId={draft.linked ? record.personId : null} onPick={pickPerson} />
          {draft.linked && (
            <div className="read-only-note">
              <span>已关联人员，基础信息只读；照片可修改，保存后同步到关联记录。</span>
              <button type="button" className="text" onClick={detach}>
                改为手动填写
              </button>
            </div>
          )}
        </>
      )}

      {natural ? (
        <div className="grid">
          <Field
            id="p-name"
            label="姓名"
            required
            value={draft.person.name}
            disabled={draft.linked}
            placeholder="请输入姓名"
            onChange={(name) => draft.setPerson({ ...draft.person, name })}
          />
          <Field
            id="p-phone"
            label="联系电话"
            required
            inputMode="tel"
            value={draft.person.phone}
            disabled={draft.linked}
            placeholder="请输入联系电话"
            onChange={(phone) => draft.setPerson({ ...draft.person, phone })}
          />
          <Field
            id="p-email"
            label={
              <>
                电子邮箱 <span className="optional">选填</span>
              </>
            }
            inputMode="text"
            value={draft.person.email}
            disabled={draft.linked}
            placeholder="例如 name@example.com"
            onChange={(email) => draft.setPerson({ ...draft.person, email })}
          />
          <ChoiceMulti
            id="p-education"
            className="full"
            label={
              <>
                学历 <span className="optional">选填</span>
              </>
            }
            options={EDUCATION_OPTIONS}
            value={has(draft.person.education) ? [draft.person.education] : []}
            onChange={(values) => draft.setPerson({ ...draft.person, education: values.at(-1) ?? '' })}
          />
          <div className="full">
            <Field
              id="p-address"
              label="居住地址"
              required
              value={draft.person.address}
              disabled={draft.linked}
              placeholder="请输入完整居住地址"
              onChange={(address) => draft.setPerson({ ...draft.person, address })}
            />
          </div>
        </div>
      ) : share!.type === '企业' ? (
        <div className="grid">
          <div className="full">
            <Field
              id="r-name"
              label="企业名称"
              required
              value={share!.name}
              placeholder="请输入企业全称"
              onChange={(name) => draft.setRecord({ ...share!, name })}
            />
          </div>
          <div className="full">
            <Field
              id="r-code"
              label="统一社会信用代码（证件号码）"
              required
              value={share!.code}
              placeholder="请输入企业证件号码"
              onChange={(code) => draft.setRecord({ ...share!, code })}
            />
          </div>
        </div>
      ) : (
        // 原型这里用手写的 .field，既不占整行也没有报错位
        <div className="field">
          <label htmlFor="r-name">
            股东说明<span className="req">*</span>
          </label>
          <textarea
            id="r-name"
            value={share!.name}
            placeholder="请输入股东名称、类型或相关说明"
            onChange={(event) => draft.setRecord({ ...share!, name: event.target.value })}
          />
        </div>
      )}

      {kind === 'share' ? (
        <>
          <h3 className="modal-subtitle">出资信息</h3>
          <div className="grid">
            <Field
              id="r-ratio"
              label="出资比例（%）"
              required
              type="number"
              value={share!.ratio}
              placeholder="请输入出资比例"
              onChange={(ratio) => draft.setRecord({ ...share!, ratio })}
            />
            <Field
              id="r-amount"
              label={
                <>
                  出资金额（万元）<span className="optional">选填</span>
                </>
              }
              type="number"
              value={share!.amount}
              placeholder="请输入金额"
              onChange={(amount) => draft.setRecord({ ...share!, amount })}
            />
            <ContributionField
              id="r-method"
              label={
                <>
                  出资形式 <span className="optional">选填，可多选</span>
                </>
              }
              options={CONTRIBUTION_METHODS}
              value={share!.method}
              onChange={(method) => draft.setRecord({ ...share!, method })}
            />
          </div>
        </>
      ) : (
        <>
          <h3 className="modal-subtitle">
            人员角色<span className="req">*</span>
          </h3>
          <ChoiceMulti
            id="r-roles"
            options={ROLES}
            value={role!.roles}
            hint="可多选；兼任限制待确认。"
            onChange={(roles) => draft.setRecord({ ...role!, roles: roles as RoleRecord['roles'] })}
          />
        </>
      )}

      <h3 className="modal-subtitle">
        {natural ? '身份证照片' : share!.type === '企业' ? '加盖企业公章的营业执照' : '股东资料'}
        {(natural || share!.type === '企业') && <span className="req">*</span>}
      </h3>
      <div className="hint">
        {natural
          ? '请分别上传身份证正面（人像面）和反面（国徽面）。'
          : share!.type === '企业'
            ? '请上传加盖企业公章的营业执照。'
            : '可按需上传资料。'}
        {natural || share!.type === '企业' ? '可先保存记录，提交前需补齐。' : ''}
      </div>

      {natural || share!.type === '企业' ? (
        <>
          <PhotoSlots
            slots={natural ? (['idFront', 'idBack'] as PhotoSlot[]) : (['license'] as PhotoSlot[])}
            files={draft.files}
            onUpload={(file, slot) => void read(file, slot)}
            onReplace={(file, slot) => void read(file, slot, true)}
            onRemove={(id) => withFiles(draft.files.filter((item) => item.id !== id))}
            onAssign={(id, slot) => withFiles(assignSlot(draft.files, id, slot))}
            onPreview={openAttachment}
          />
          {!draft.files.length && <div className="photo-missing" style={{ marginTop: 10 }}>没有照片</div>}
        </>
      ) : (
        <>
          <input
            style={{ marginTop: 12 }}
            type="file"
            multiple
            aria-label="上传附件"
            onChange={(event) => {
              const picked = [...(event.target.files ?? [])];
              event.target.value = '';
              picked.forEach((file) => void read(file, null));
            }}
          />
          {/* 原型 fileList() 即使没有附件也留着这个容器 */}
          <div className="file-list">
            {draft.files.map((file) => (
              <div key={file.id} className="file">
                <span className="file-info">
                  {file.name}
                  <small>
                    {formatSize(file.size)} · <span className="uploaded">已载入，保存记录后生效</span>
                  </small>
                </span>
                <button type="button" onClick={() => openAttachment(file)}>
                  预览
                </button>
                <button
                  type="button"
                  className="text danger"
                  onClick={() => withFiles(draft.files.filter((item) => item.id !== file.id))}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}
