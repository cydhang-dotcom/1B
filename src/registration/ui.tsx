import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { formatSize, isPreviewableImage, slotDetail, slotFile, slotLabel, unassignedFiles } from './files';
import { idPhotosComplete, type Attachment, type PhotoSlot } from './model';

/**
 * 这里的类名全部来自 企业注册服务申请系统-6.html（下称原型），
 * 样式在 design.css 里整段移植。改动前先改原型，再同步本文件与 design.css。
 */

/** 一步里的一个面板，对应原型 panel() */
export function Panel({
  title,
  subtitle,
  number,
  action,
  children,
}: {
  title: ReactNode;
  subtitle?: string;
  number?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action ?? (number ? <span className="mini-number">{number}</span> : null)}
      </div>
      {children}
    </section>
  );
}

/** 带标签的文本 / 数字输入，对应原型 field() */
export function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  type = 'text',
  hint,
  disabled,
  inputMode,
  suffix,
  className,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  type?: string;
  hint?: ReactNode;
  disabled?: boolean;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel';
  suffix?: string;
  className?: string;
}) {
  const input = (
    <input
      id={id}
      type={type}
      value={value}
      inputMode={inputMode}
      disabled={disabled}
      placeholder={placeholder}
      aria-invalid={error ? true : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  );

  return (
    <div className={`field${error ? ' invalid' : ''}${className ? ` ${className}` : ''}`} id={`field-${id}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="req">*</span>}
      </label>
      {suffix ? (
        <div className="unit-input">
          {input}
          <span className="unit">{suffix}</span>
        </div>
      ) : (
        input
      )}
      {hint && <div className="hint">{hint}</div>}
      <div className="error">{error}</div>
    </div>
  );
}

/** 多行文本，对应原型 textArea() */
export function TextArea({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = true,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className={`field full${error ? ' invalid' : ''}`} id={`field-${id}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="req">*</span>}
      </label>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="error">{error}</div>
    </div>
  );
}

/** 单选：一排按钮，语义上是一个 radio group，对应原型 choices() */
export function ChoiceRow({
  id,
  label,
  options,
  value,
  onChange,
  error,
  className,
}: {
  id: string;
  label?: ReactNode;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** 传给外层 .field，例如 'full' 让它独占一行 */
  className?: string;
}) {
  return (
    <div className={`field${className ? ` ${className}` : ''}${error ? ' invalid' : ''}`}>
      {label && (
        <span className="label" id={`label-${id}`}>
          {label}
        </span>
      )}
      <div id={id} role="radiogroup" aria-labelledby={label ? `label-${id}` : undefined} className="choice-row">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={`choice${value === option ? ' selected' : ''}`}
          >
            {option}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

/** 多选：一排开关按钮，切换选中状态，对应原型 optionField()；label 省略时只出选择行 */
export function ChoiceMulti({
  id,
  label,
  options,
  value,
  onChange,
  hint,
  error,
  className,
}: {
  id: string;
  label?: ReactNode;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  hint?: ReactNode;
  error?: string;
  /** 传给外层 .field.option-field，例如 'full' 让它独占一行 */
  className?: string;
}) {
  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);

  const row = (
    <div id={id} role="group" aria-labelledby={label ? `label-${id}` : undefined} className="choice-row">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value.includes(option)}
          onClick={() => toggle(option)}
          className={`choice${value.includes(option) ? ' selected' : ''}`}
        >
          {option}
        </button>
      ))}
    </div>
  );

  // 原型的 roleRow 不带错误位，只有 optionField 才有
  if (!label) {
    return (
      <>
        {row}
        {hint && <div className="hint">{hint}</div>}
        {error !== undefined && <div className="error">{error}</div>}
      </>
    );
  }

  return (
    <div
      className={`field option-field${className ? ` ${className}` : ''}${error ? ' invalid' : ''}`}
      id={`field-${id}`}
    >
      <span className="label" id={`label-${id}`}>
        {label}
      </span>
      {row}
      {hint && <div className="hint">{hint}</div>}
      <div className="error">{error}</div>
    </div>
  );
}

/**
 * 出资形式：带复选框的胶囊，对应原型 contributionField()。
 * 与 ChoiceMulti 的区别是原型特意换了一套交互（真实 checkbox + .method-option 样式）。
 */
export function ContributionField({
  id,
  label,
  options,
  value,
  onChange,
  error,
}: {
  id: string;
  label: ReactNode;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}) {
  // 旧草稿里可能有已经不在选项里的出资形式，原型会把它们补进列表
  const list = [...new Set([...options, ...value])];
  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);

  return (
    <div className="full">
      <div className="field option-field" id={`field-${id}`}>
        <span className="label" id={`label-${id}`}>
          {label}
        </span>
        <div className="choice-row" role="group" aria-labelledby={`label-${id}`}>
          {list.map((option) => (
            <label
              key={option}
              className={`choice method-option${value.includes(option) ? ' selected' : ''}`}
            >
              <input
                type="checkbox"
                name="contributionMethod"
                checked={value.includes(option)}
                onChange={() => toggle(option)}
              />
              <span>{option}</span>
            </label>
          ))}
          <div className="error">{error}</div>
        </div>
      </div>
    </div>
  );
}

/** 勾选项：复选框 + 说明文字 */
export function Checkbox({
  id,
  checked,
  onChange,
  children,
  error,
  className,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  /** 传入即占据一枚报错位（原型 field() 的固定结构），未传则不占位 */
  error?: string;
  className?: string;
}) {
  return (
    <div className={`field${className ? ` ${className}` : ''}${error ? ' invalid' : ''}`} id={`field-${id}`}>
      <label className="check">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{children}</span>
      </label>
      {error !== undefined && <div className="error">{error}</div>}
    </div>
  );
}

/** 通用弹窗：原生 dialog，铺满视口的遮罩由 ::backdrop 提供 */
export function Dialog({
  title,
  error,
  onClose,
  footer,
  blockEscape,
  children,
}: {
  title: string;
  /** 传入即占据一枚报错位（原型 editor/verify 固定有此行），未传则不占位 */
  error?: string;
  onClose: () => void;
  footer: ReactNode;
  /** 附件读取中不允许 Esc 关闭，避免丢掉未保存的记录 */
  blockEscape?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (node && !node.open) node.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        if (blockEscape) event.preventDefault();
      }}
      onClose={onClose}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="close" aria-label="关闭弹框" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="modal-body">
        {error !== undefined && (
          <div className="dialog-error" role="alert">
            {error}
          </div>
        )}
        {children}
      </div>
      <div className="modal-footer">{footer}</div>
    </dialog>
  );
}

/** 记录行里的附件状态文案，对应原型 attachmentState() */
export function attachmentState(files: Attachment[], needed = true): ReactNode {
  const partial =
    files.some((file) => file.slot === 'idFront' || file.slot === 'idBack') && !idPhotosComplete(files);
  if (partial) return <span className="photo-missing">照片待补齐</span>;
  if (files.length) return <span className="muted">资料 {files.length} 份</span>;
  return needed ? <span className="photo-missing">没有照片</span> : <span className="muted">未附资料</span>;
}

/** 证件照线稿：与原型 photoUploadArea 里的内联 SVG 一致 */
const SLOT_ART: Record<PhotoSlot, ReactNode> = {
  idFront: (
    <>
      <rect x="2" y="2" width="86" height="54" rx="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="25" cy="22" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M13 43c1-13 23-13 24 0M47 17h27M47 28h27M47 39h18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  ),
  idBack: (
    <>
      <rect x="2" y="2" width="86" height="54" rx="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="45" cy="17" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M25 33h40M30 42h30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  license: (
    <>
      <rect x="3" y="2" width="56" height="82" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M18 17h26M14 29h34M14 39h34M14 49h21M14 60h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="43" cy="67" r="8" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
};

/** 证件照片占位：固定位置、可替换、可删除，未归位的附件单独列出 */
export function PhotoSlots({
  slots,
  files,
  onUpload,
  onRemove,
  onAssign,
  onPreview,
  onReplace,
}: {
  slots: PhotoSlot[];
  files: Attachment[];
  onUpload: (file: File, slot: PhotoSlot) => void;
  onRemove: (id: string) => void;
  onAssign: (id: string, slot: PhotoSlot) => void;
  onPreview: (file: Attachment) => void;
  onReplace: (file: File, slot: PhotoSlot) => void;
}) {
  const legacy = unassignedFiles(files, slots);
  // 营业执照是竖版单占位，原型用 .document-grid.license 换成单列窄格
  const license = slots.includes('license');

  return (
    <>
      <div className={`document-grid${license ? ' license' : ''}`}>
        {slots.map((slot) => {
          const file = slotFile(files, slot);
          const label = slotLabel(slot);
          return (
            <div key={slot} className="doc-slot" data-slot={slot}>
              {file ? (
                <button type="button" className="doc-face filled" aria-label={`预览${label}`} onClick={() => onPreview(file)}>
                  {isPreviewableImage(file.type) ? (
                    <img src={file.data} alt={label} />
                  ) : (
                    <span className="file-glyph">▧</span>
                  )}
                </button>
              ) : (
                <label className="doc-face upload">
                  <input
                    type="file"
                    aria-label={`上传${label}`}
                    onChange={(event) => {
                      const picked = event.target.files?.[0];
                      if (picked) onUpload(picked, slot);
                      event.target.value = '';
                    }}
                  />
                  <svg viewBox={license ? '0 0 62 86' : '0 0 90 58'} fill="none" aria-hidden="true">
                    {SLOT_ART[slot]}
                  </svg>
                  <strong>＋ 上传{label}</strong>
                  <small>{slotDetail(slot)}</small>
                </label>
              )}

              <div className="doc-caption">
                <span>{label}</span>
                <small>{file ? '已载入' : '待上传'}</small>
              </div>

              {file && (
                <>
                  <div className="doc-details">
                    {file.name} · {formatSize(file.size)}
                  </div>
                  <div className="doc-actions">
                    <label className="doc-replace">
                      更换
                      <input
                        type="file"
                        aria-label={`更换${label}`}
                        onChange={(event) => {
                          const picked = event.target.files?.[0];
                          if (picked) onReplace(picked, slot);
                          event.target.value = '';
                        }}
                      />
                    </label>
                    <button type="button" className="danger" onClick={() => onRemove(file.id)}>
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {legacy.length > 0 && (
        <>
          <div className="legacy-photos">已有附件尚未指定对应位置，请确认后放入占位。</div>
          {legacy.map((file) => (
            <div key={file.id}>
              <div className="doc-details">
                {file.name} · {formatSize(file.size)}
              </div>
              <div className="legacy-actions">
                <button type="button" onClick={() => onPreview(file)}>
                  预览
                </button>
                {slots.map((slot) => (
                  <button key={slot} type="button" onClick={() => onAssign(file.id, slot)}>
                    设为{slotLabel(slot)}
                  </button>
                ))}
                <button type="button" className="text danger" onClick={() => onRemove(file.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
