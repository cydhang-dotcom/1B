import { Upload, X } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { formatSize, isPreviewableImage, slotDetail, slotFile, slotLabel, unassignedFiles } from './files';
import type { Attachment, PhotoSlot } from './model';

export const FIELD_INPUT =
  'h-11 w-full rounded-xl border border-stone-300/70 bg-white px-3.5 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-400 hover:border-stone-400 focus:border-[#66cdb5] focus:ring-4 focus:ring-[#66cdb5]/10';

export const CHOICE_BASE =
  'rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20';
export const CHOICE_ON = 'border-[#66cdb5] bg-[#66cdb5] text-white';
export const CHOICE_OFF = 'border-stone-300/70 bg-white text-stone-600 hover:border-[#66cdb5]/60';

/** 弹窗内分节标题：对齐原型 .modal-subtitle 的上分隔线与留白 */
export const MODAL_SUBTITLE =
  'mt-[25px] mb-[13px] border-t border-stone-100 pt-[19px] text-sm font-bold text-stone-700';

export const TEXT_BUTTON =
  'rounded-full px-3 py-1.5 text-xs font-semibold text-[#3f9d87] transition-colors hover:bg-[#e8f7f3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20';

export const PRIMARY_BUTTON =
  'inline-flex items-center gap-2 rounded-full border border-[#66cdb5] bg-[#66cdb5] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#57bea6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20 disabled:cursor-not-allowed disabled:opacity-50';

export const SECONDARY_BUTTON =
  'inline-flex items-center gap-2 rounded-full border border-stone-300/70 bg-white px-5 py-2.5 text-sm font-semibold text-stone-600 transition-colors hover:border-stone-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20 disabled:cursor-not-allowed disabled:opacity-50';

/** 一步里的一个面板 */
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
    <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm shadow-stone-100 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[19px] font-bold text-stone-800">{title}</h2>
          {subtitle && <p className="mt-1 text-xs leading-5 text-stone-500">{subtitle}</p>}
        </div>
        {action ?? (
          number && (
            <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-400">
              {number}
            </span>
          )
        )}
      </div>
      {children}
    </section>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-500">
      {message}
    </p>
  );
}

/** 带标签的文本 / 数字输入 */
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
  maxLength,
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
  maxLength?: number;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-stone-700">
        {label}
        {required && <span className="ml-0.5 text-[#42a98f]">*</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type={type}
          value={value}
          maxLength={maxLength}
          inputMode={inputMode}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD_INPUT} ${error ? 'border-red-400' : ''} ${disabled ? 'cursor-not-allowed bg-stone-50 text-stone-500' : ''}`}
        />
        {suffix && <span className="shrink-0 text-xs text-stone-500">{suffix}</span>}
      </div>
      {hint && <p className="mt-1.5 text-xs leading-5 text-stone-400">{hint}</p>}
      <FieldError id={id} message={error} />
    </div>
  );
}

export function TextArea({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = true,
  error,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  rows?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-stone-700">
        {label}
        {required && <span className="ml-0.5 text-[#42a98f]">*</span>}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full resize-y rounded-xl border border-stone-300/70 bg-white px-3.5 py-3 text-sm leading-6 text-stone-800 outline-none transition-colors placeholder:text-stone-400 hover:border-stone-400 focus:border-[#66cdb5] focus:ring-4 focus:ring-[#66cdb5]/10 ${error ? 'border-red-400' : ''}`}
      />
      <FieldError id={id} message={error} />
    </div>
  );
}

/** 单选：一排按钮，语义上是一个 radio group */
export function ChoiceRow({
  id,
  label,
  options,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <span id={`${id}-label`} className="mb-2 block text-sm font-semibold text-stone-700">
        {label}
      </span>
      <div id={id} role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={`${CHOICE_BASE} ${value === option ? CHOICE_ON : CHOICE_OFF}`}
          >
            {option}
          </button>
        ))}
      </div>
      <FieldError id={id} message={error} />
    </div>
  );
}

/** 多选：一排开关按钮，切换选中状态 */
export function ChoiceMulti({
  id,
  label,
  options,
  value,
  onChange,
  hint,
  error,
}: {
  id: string;
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  hint?: string;
  error?: string;
}) {
  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);

  return (
    <div>
      <span id={`${id}-label`} className="mb-2 block text-sm font-semibold text-stone-700">
        {label}
      </span>
      <div id={id} role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value.includes(option)}
            onClick={() => toggle(option)}
            className={`${CHOICE_BASE} ${value.includes(option) ? CHOICE_ON : CHOICE_OFF}`}
          >
            {option}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-xs leading-5 text-stone-400">{hint}</p>}
      <FieldError id={id} message={error} />
    </div>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  children,
  error,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-stone-300/70 bg-stone-50/35 px-4 py-3 text-sm leading-6 text-stone-700 transition-colors hover:border-stone-400"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#66cdb5]"
        />
        <span>{children}</span>
      </label>
      <FieldError id={id} message={error} />
    </div>
  );
}

/** 通用弹窗：标题栏、可滚动正文、底部操作区；Esc 关闭 */
export function Dialog({
  title,
  error,
  onClose,
  footer,
  children,
}: {
  title: string;
  error?: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4">
          <h2 className="text-lg font-bold text-stone-800">{title}</h2>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-medium leading-5 text-red-600">
              {error}
            </p>
          )}
          {children}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-stone-100 px-5 py-4">
          {footer}
        </div>
      </div>
    </div>
  );
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
  readOnly,
  onUpload,
  onRemove,
  onAssign,
  onPreview,
  onReplace,
}: {
  slots: PhotoSlot[];
  files: Attachment[];
  /** 关联人员时基础信息只读，但照片仍可改 */
  readOnly?: boolean;
  onUpload: (file: File, slot: PhotoSlot) => void;
  onRemove: (id: string) => void;
  onAssign: (id: string, slot: PhotoSlot) => void;
  onPreview: (file: Attachment) => void;
  onReplace: (file: File, slot: PhotoSlot) => void;
}) {
  const unassigned = unassignedFiles(files, slots);
  // 营业执照是竖版单占位，原型用 .document-grid.license 换成单列窄格
  const license = slots.includes('license');

  const face = `relative flex w-full flex-col items-center justify-center gap-[9px] overflow-hidden rounded-[9px] border border-dashed border-[#66cdb5]/65 bg-[#F0FDFA] p-[15px] text-center text-[#0F766E] focus-within:[outline:3px_solid_#77c9bf] focus-within:[outline-offset:2px] ${
    license ? 'aspect-[210/297] rounded-[5px]' : 'aspect-[85.6/54]'
  }`;
  const artSize = license ? 'h-[82px] w-[65px]' : 'h-[46px] w-[72px]';
  const hiddenInput = 'absolute inset-0 h-full w-full cursor-pointer opacity-0';

  return (
    <div>
      <div
        className={`mt-[17px] grid grid-cols-1 gap-[19px] sm:gap-[18px] ${
          license ? 'sm:grid-cols-[minmax(0,236px)] sm:justify-start' : 'sm:grid-cols-2'
        }`}
      >
        {slots.map((slot) => {
          const file = slotFile(files, slot);
          const label = slotLabel(slot);
          return (
            <div key={slot} className="min-w-0">
              {file ? (
                <button
                  type="button"
                  onClick={() => onPreview(file)}
                  aria-label={`预览${label}`}
                  className={`${face} border-solid border-stone-200 bg-stone-50 p-[7px]`}
                >
                  {isPreviewableImage(file.type) ? (
                    <img
                      src={file.data}
                      alt={label}
                      className="absolute inset-[7px] h-[calc(100%-14px)] w-[calc(100%-14px)] object-contain"
                    />
                  ) : (
                    <span className="text-[30px]" aria-hidden="true">
                      ▧
                    </span>
                  )}
                </button>
              ) : (
                <label className={`${face} ${readOnly ? '' : 'cursor-pointer hover:border-[#52BA9F] hover:bg-[#E6FAF3]'}`}>
                  {!readOnly && (
                    <input
                      type="file"
                      className={hiddenInput}
                      aria-label={`上传${label}`}
                      onChange={(event) => {
                        const picked = event.target.files?.[0];
                        if (picked) onUpload(picked, slot);
                        event.target.value = '';
                      }}
                    />
                  )}
                  <svg
                    viewBox={license ? '0 0 62 86' : '0 0 90 58'}
                    fill="none"
                    aria-hidden="true"
                    className={`${artSize} shrink-0 text-[#52BA9F]`}
                  >
                    {SLOT_ART[slot]}
                  </svg>
                  <strong className="text-xs font-semibold text-[#0F766E]">
                    {readOnly ? '尚未上传' : `＋ 上传${label}`}
                  </strong>
                  <small className="text-[10px] text-[#64748B]">{slotDetail(slot)}</small>
                </label>
              )}

              <div className="mt-[9px] flex items-center justify-between gap-2 text-xs font-semibold text-[#475569]">
                <span>{label}</span>
                <small className="text-[10px] font-normal text-[#64748B]">{file ? '已载入' : '待上传'}</small>
              </div>

              {file && (
                <>
                  <div className="mt-[5px] text-[10px] text-[#64748B] [overflow-wrap:anywhere]">
                    {file.name} · {formatSize(file.size)}
                  </div>
                  {!readOnly && (
                    <div className="mt-1.5 flex items-center gap-3">
                      <label className="relative cursor-pointer overflow-hidden text-[11px] text-[#0F766E]">
                        更换
                        <input
                          type="file"
                          className={hiddenInput}
                          aria-label={`更换${label}`}
                          onChange={(event) => {
                            const picked = event.target.files?.[0];
                            if (picked) onReplace(picked, slot);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => onRemove(file.id)}
                        className="text-[11px] text-[#be4941]"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <>
          <p className="mt-[17px] text-[11px] text-[#8a7960]">
            以下附件尚未指定对应位置，请确认后放入占位。
          </p>
          {unassigned.map((file) => (
            <div key={file.id}>
              <div className="mt-[5px] text-[10px] text-[#64748B] [overflow-wrap:anywhere]">
                {file.name} · {formatSize(file.size)}
              </div>
              <div className="my-2.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onPreview(file)}
                  className="rounded-full border border-stone-300/70 bg-white px-2 py-1 text-[11px] text-stone-600 hover:border-[#66cdb5]/60"
                >
                  预览
                </button>
                {!readOnly &&
                  slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onAssign(file.id, slot)}
                      className="rounded-full border border-stone-300/70 bg-white px-2 py-1 text-[11px] text-stone-600 hover:border-[#66cdb5]/60"
                    >
                      设为{slotLabel(slot)}
                    </button>
                  ))}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onRemove(file.id)}
                    className="rounded-full px-2 py-1 text-[11px] text-[#be4941] hover:bg-red-50"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
