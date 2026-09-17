import { PHOTO_SLOTS, uid, type Attachment, type PhotoSlot } from './model';

/** 可在页面内直接预览的图片类型 */
const PREVIEWABLE_IMAGE = /^image\/(png|jpeg|gif|webp|bmp|avif)$/;

export const isPreviewableImage = (type: string): boolean => PREVIEWABLE_IMAGE.test(type);

export const formatSize = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * 把本地文件读成 dataURL。附件只留在浏览器里，不会发送到服务端；
 * 没有格式与大小限制，预览不了的类型提供下载。
 */
export async function readFiles(list: FileList | File[]): Promise<Attachment[]> {
  const files = [...list];
  return Promise.all(
    files.map(
      (file) =>
        new Promise<Attachment>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({ id: uid(), name: file.name, size: file.size, type: file.type, data: String(reader.result) });
          reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

/** 打开附件：图片在新标签页预览，其他格式走下载 */
export function openAttachment(file: Attachment): void {
  if (isPreviewableImage(file.type)) {
    window.open(file.data, '_blank', 'noopener');
    return;
  }
  const anchor = document.createElement('a');
  anchor.href = file.data;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** 某个证件位置上的附件 */
export const slotFile = (files: Attachment[], slot: PhotoSlot): Attachment | undefined =>
  files.find((file) => file.slot === slot);

/** 不是任何证件位置的历史附件，需要用户手动指定归位 */
export const unassignedFiles = (files: Attachment[], slots: PhotoSlot[]): Attachment[] =>
  files.filter((file) => !file.slot || !slots.includes(file.slot));

/** 把一个附件放到指定位置，原占位的附件退回未归位 */
export function assignSlot(files: Attachment[], id: string, slot: PhotoSlot): Attachment[] {
  const chosen = files.find((file) => file.id === id);
  if (!chosen) return files;
  return files.map((file) => {
    if (file.id === id) return { ...file, slot };
    if (file.slot === slot) return { ...file, slot: undefined };
    return file;
  });
}

/** 替换某个位置：同位置的旧附件一并移除，避免占位里堆叠多张 */
export function replaceSlot(files: Attachment[], next: Attachment, slot: PhotoSlot): Attachment[] {
  return [...files.filter((file) => file.slot !== slot), { ...next, slot }];
}

export const slotLabel = (slot: PhotoSlot): string => PHOTO_SLOTS[slot];

export const slotDetail = (slot: PhotoSlot): string =>
  slot === 'idFront' ? '人像面' : slot === 'idBack' ? '国徽面' : '加盖企业公章';
