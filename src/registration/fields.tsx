import React from 'react';
import { useController, useFormContext, type FieldPath } from 'react-hook-form';
import { ImagePlus, UserRoundCheck } from 'lucide-react';
import { MAX_CERTIFICATE_IMAGES, type CertificateImage, type FormValues } from './schema';
import { formatPersonLabel, type NaturalPersonOption } from './person-options';

export const LABEL_STYLE = 'mb-1.5 block text-sm font-semibold text-stone-700';
const INPUT_STYLE =
  'h-12 w-full rounded-xl border border-stone-300/70 bg-stone-50/35 px-4 text-stone-800 outline-none transition-all placeholder-stone-400 hover:border-stone-400 focus:border-[#66cdb5] focus:bg-white focus:ring-4 focus:ring-[#66cdb5]/10';
const INPUT_INVALID_STYLE = 'border-red-400 bg-red-50/30';
const INPUT_READONLY_STYLE = 'cursor-not-allowed bg-stone-100 text-stone-500 hover:border-stone-300/70';
const HINT_STYLE = 'mt-1.5 text-xs leading-5 text-stone-500';
const ERROR_STYLE = 'mt-1.5 text-xs text-red-500';
const UPLOAD_DROPZONE_STYLE =
  'flex h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50/35 text-sm text-stone-500 transition-colors hover:border-[#66cdb5] hover:bg-[#f7fdfb] hover:text-[#3f9d87]';
const UPLOAD_ACTION_STYLE =
  'shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700';

export type FieldName = FieldPath<FormValues>;

/** 统一的字段元信息：id / 错误 / 无障碍属性，避免每个输入框重复取错误 */
function useFieldMeta(name: FieldName) {
  const { formState, getFieldState } = useFormContext<FormValues>();
  const { error } = getFieldState(name, formState);
  const id = `reg-${name.replace(/\./g, '-')}`;
  return { id, message: error?.message as string | undefined };
}

type FieldShellProps = {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
  id: string;
  message?: string;
};

/**
 * 字段外壳：标签在上，输入框紧随其后，提示与错误都放到输入框下方。
 * 提示若放在输入框上方，同一行里只有部分字段带提示时会把输入框顶下去，整排高度对不齐。
 */
const FieldShell = ({ label, required, hint, className, children, id, message }: FieldShellProps) => (
  <div className={className}>
    <label htmlFor={id} className={LABEL_STYLE}>
      {label}
      {required && <span className="ml-1 text-[#42a98f]">*</span>}
    </label>
    {children}
    {hint && (
      <p id={`${id}-hint`} className={HINT_STYLE}>
        {hint}
      </p>
    )}
    {message && (
      <p id={`${id}-error`} className={ERROR_STYLE}>
        {message}
      </p>
    )}
  </div>
);

/** 提示与错误都要被读屏念出来，顺序与视觉一致 */
const describedBy = (id: string, hint?: string, message?: string) =>
  [hint ? `${id}-hint` : null, message ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

type CommonProps = {
  name: FieldName;
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
};

type TextFieldProps = CommonProps & {
  placeholder?: string;
  type?: 'text' | 'date' | 'tel' | 'email';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  readOnly?: boolean;
  autoComplete?: string;
};

export function TextField({
  name,
  label,
  required,
  hint,
  className,
  placeholder,
  type = 'text',
  inputMode,
  maxLength,
  readOnly,
  autoComplete,
}: TextFieldProps) {
  const { register } = useFormContext<FormValues>();
  const { id, message } = useFieldMeta(name);

  return (
    <FieldShell label={label} required={required} hint={hint} className={className} id={id} message={message}>
      <input
        id={id}
        type={type}
        readOnly={readOnly}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy(id, hint, message)}
        className={`${INPUT_STYLE} ${message ? INPUT_INVALID_STYLE : ''} ${readOnly ? INPUT_READONLY_STYLE : ''}`}
        {...register(name)}
      />
    </FieldShell>
  );
}

/**
 * 数字输入统一存为 null，交给 zod 报「请输入 X」。
 * 注意 RHF 会把 setValueAs 也套用到 defaultValues 上，因此 null/undefined 必须原样返回——
 * 否则 Number(null) === 0，空值会被当成填了 0。
 */
const toNullableNumber = (value: unknown) =>
  value === '' || value === null || value === undefined ? null : Number(value);

/** 数字输入：空串存为 null，交给 zod 报「请输入 X」 */
export function NumberField({
  name,
  label,
  required,
  hint,
  className,
  placeholder,
  step = '0.01',
}: CommonProps & { placeholder?: string; step?: string }) {
  const { register } = useFormContext<FormValues>();
  const { id, message } = useFieldMeta(name);

  return (
    <FieldShell label={label} required={required} hint={hint} className={className} id={id} message={message}>
      <input
        id={id}
        type="number"
        step={step}
        inputMode="decimal"
        placeholder={placeholder}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy(id, hint, message)}
        className={`${INPUT_STYLE} ${message ? INPUT_INVALID_STYLE : ''}`}
        {...register(name, { setValueAs: toNullableNumber })}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  required,
  hint,
  className,
  options,
  placeholder = '请选择',
}: CommonProps & { options: readonly string[]; placeholder?: string }) {
  const { register } = useFormContext<FormValues>();
  const { id, message } = useFieldMeta(name);

  return (
    <FieldShell label={label} required={required} hint={hint} className={className} id={id} message={message}>
      <select
        id={id}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy(id, hint, message)}
        className={`${INPUT_STYLE} appearance-none bg-[length:14px] bg-[right_1rem_center] bg-no-repeat pr-10 ${message ? INPUT_INVALID_STYLE : ''}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...register(name)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });

/**
 * 证件图片上传（环节 7 平台标注为必填），可传多张——身份证正反面、执照多页都要分开传。
 * ponytail: 接口未接入，图片以 dataUrl 暂存在表单状态里；接入后改为上传并只保留文件标识。
 */
export function CertificateUploadsField({
  name,
  label,
  hint,
  className,
}: {
  name: FieldName;
  label: string;
  hint?: string;
  className?: string;
}) {
  const { control, setValue } = useFormContext<FormValues>();
  const { field, fieldState } = useController({ control, name });
  const id = `reg-${name.replace(/\./g, '-')}`;
  const message = fieldState.error?.message as string | undefined;
  const images = (field.value ?? []) as CertificateImage[];
  const canAdd = images.length < MAX_CERTIFICATE_IMAGES;

  const commit = (next: CertificateImage[]) => {
    // shouldValidate：否则上传成功后「请上传证件图片」要等到下次校验才消失
    setValue(name, next, { shouldValidate: true, shouldDirty: true });
  };

  /** index 省略表示追加，否则替换该位置的图片 */
  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const file = event.target.files?.[0];
    // 清空 input，否则同一个文件改完再选不会触发 change
    event.target.value = '';
    if (!file) return;
    // 达上限时添加框已隐藏，但 sr-only 的 input 仍可被键盘 Tab 聚焦，这里兜住
    if (index === undefined && images.length >= MAX_CERTIFICATE_IMAGES) return;
    const image: CertificateImage = {
      name: file.name,
      size: file.size,
      type: file.type,
      dataUrl: await readAsDataUrl(file),
    };
    commit(index === undefined ? [...images, image] : images.map((item, i) => (i === index ? image : item)));
  };

  return (
    <FieldShell label={label} required hint={hint} className={className} id={id} message={message}>
      <div className="grid gap-3">
        {images.map((image, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-xl border border-stone-300/70 bg-white p-3"
          >
            <img
              src={image.dataUrl}
              alt={`证件图片 ${index + 1} 预览`}
              className="h-16 w-24 shrink-0 rounded-lg border border-stone-200 object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-700">{image.name}</p>
              <p className="mt-0.5 text-xs text-stone-400">{Math.ceil(image.size / 1024)} KB</p>
            </div>
            <label htmlFor={`${id}-${index}`} className={UPLOAD_ACTION_STYLE}>
              更换
            </label>
            <button
              type="button"
              onClick={() => commit(images.filter((_, i) => i !== index))}
              aria-label={`删除第 ${index + 1} 张图片`}
              className={UPLOAD_ACTION_STYLE}
            >
              删除
            </button>
            <input
              id={`${id}-${index}`}
              type="file"
              accept="image/jpeg,image/png"
              aria-label={`更换第 ${index + 1} 张图片`}
              className="sr-only"
              onChange={(event) => handleSelect(event, index)}
            />
          </div>
        ))}

        {canAdd ? (
          <label htmlFor={id} className={UPLOAD_DROPZONE_STYLE}>
            <ImagePlus size={18} aria-hidden="true" />
            {images.length ? '添加图片' : '选择图片'}
          </label>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-200 px-4 py-3 text-xs text-stone-400">
            最多上传 {MAX_CERTIFICATE_IMAGES} 张，如需替换请点击对应图片的「更换」。
          </p>
        )}
      </div>
      <input
        id={id}
        ref={field.ref}
        type="file"
        accept="image/jpeg,image/png"
        disabled={!canAdd}
        className="sr-only"
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy(id, hint, message)}
        onChange={(event) => handleSelect(event)}
      />
    </FieldShell>
  );
}

export function TextareaField({
  name,
  label,
  required,
  hint,
  className,
  placeholder,
  rows = 4,
}: CommonProps & { placeholder?: string; rows?: number }) {
  const { register } = useFormContext<FormValues>();
  const { id, message } = useFieldMeta(name);

  return (
    <FieldShell label={label} required={required} hint={hint} className={className} id={id} message={message}>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy(id, hint, message)}
        className={`${INPUT_STYLE} h-auto py-3 leading-6 ${message ? INPUT_INVALID_STYLE : ''}`}
        {...register(name)}
      />
    </FieldShell>
  );
}

const CHECKBOX_STYLE = 'h-4 w-4 shrink-0 cursor-pointer accent-[#66cdb5]';
const CHECKBOX_LABEL_STYLE =
  'flex cursor-pointer items-center gap-2.5 rounded-xl border border-stone-300/70 bg-stone-50/35 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:border-stone-400';

/**
 * 多选项用独立的布尔字段，与《企业服务委托单》一致；互斥的单选项请用 SelectField，不要用两个布尔互相清空。
 */
export function CheckboxField({
  name,
  label,
  hint,
  className,
  disabled,
}: CommonProps & { disabled?: boolean }) {
  const { register } = useFormContext<FormValues>();
  const { id, message } = useFieldMeta(name);

  return (
    <div className={className}>
      <label htmlFor={id} className={`${CHECKBOX_LABEL_STYLE} ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}>
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy(id, hint, message)}
          className={CHECKBOX_STYLE}
          {...register(name)}
        />
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className={HINT_STYLE}>
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className={ERROR_STYLE}>
          {message}
        </p>
      )}
    </div>
  );
}

const REUSE_CHIP_STYLE =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#66cdb5]/60 bg-white px-3 py-1.5 text-xs font-semibold text-[#3f9d87] transition-colors hover:bg-[#f2fbf8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/15';

/**
 * 「复用已填人员」标签行：点一下就把他处已填的姓名 / 证件号 / 手机号搬到当前块。
 * 同一个人在前面的股东、其它人员角色里填过之后，后面不必再录一遍。
 * 填入后仍可手动改——不做锁定，避免步骤切走后锁状态丢失造成前后不一致。
 */
export function PersonReusePicker({
  target,
  fields,
  options,
  excludeId,
}: {
  /** 目标对象路径，如 legalPerson / beneficiaries.0 */
  target: string;
  /** 需要填入的子字段，如 ['name', 'idNumber', 'mobile'] */
  fields: Array<'name' | 'idNumber' | 'mobile'>;
  options: NaturalPersonOption[];
  /** 排除自身来源，避免在自己这一块里列出自己 */
  excludeId?: string;
}) {
  const { setValue } = useFormContext<FormValues>();
  const available = options.filter((option) => option.id !== excludeId);
  if (!available.length) return null;

  const pick = (person: NaturalPersonOption) => {
    const setOptions = { shouldValidate: true, shouldDirty: true } as const;
    fields.forEach((key) => {
      setValue(`${target}.${key}` as FieldPath<FormValues>, person[key], setOptions);
    });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500">
        <UserRoundCheck size={14} className="text-[#4fb69e]" aria-hidden="true" />
        复用已填人员
      </span>
      {available.map((option) => (
        <button key={option.id} type="button" onClick={() => pick(option)} className={REUSE_CHIP_STYLE}>
          {formatPersonLabel(option)}
        </button>
      ))}
      <span className="text-xs text-stone-400">点击自动填入，仍需自行核对</span>
    </div>
  );
}
