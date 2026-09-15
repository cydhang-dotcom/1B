import { flatten, writeFlat } from './flat';
import {
  CONFIG,
  PHOTO_SLOTS,
  ROLES,
  SHARE_TYPES,
  clone,
  listOf,
  type ApplicationData,
  type Attachment,
} from './model';

/** 草稿存储标识，同时作为导出文件里的 format 字段 */
export const DRAFT_KEY = '1b_company_registration';

const STORE = 'draft';
const RECORD = 'current';

/**
 * 附件是 dataURL，体积远超 localStorage 的 5 MB 上限，因此首选 IndexedDB，
 * 不可用时（隐私模式、部分内置浏览器）退回 localStorage。
 * ponytail: 不做分片与配额管理，附件总量受浏览器限制；正式上线改为上传后只存文件标识。
 */
let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DRAFT_KEY, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('无法打开本地数据库'));
    });
  }
  return dbPromise;
};

/** 写入草稿；两条路都失败时抛出可读的错误，由调用方提示用户导出备份 */
export async function storeDraft(snapshot: ApplicationData): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(snapshot, RECORD);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
    } catch {
      throw new Error('浏览器无法保存完整草稿，请在帮助中导出草稿备份。');
    }
  }
  // 暂存成功即刷新扁平快照，供同源的协议页同步读取
  writeFlat(snapshot);
}

/**
 * 旧草稿迁移：出资形式历史上是可以直接点选的字符串，设立期限历史上写作「20 年」。
 * 迁移只改结构不改内容，保证老草稿能继续打开。
 */
export function migrateDraft(draft: ApplicationData): ApplicationData {
  const next = clone(draft);
  next.shareholders = (next.shareholders ?? []).map((record) => ({
    ...record,
    method: listOf(record.method),
  }));
  // 含非自然人股东时免申报承诺不成立
  if (!next.shareholders.length || next.shareholders.some((record) => record.type !== '自然人')) {
    next.confirm!.exemption = false;
  }
  const setup = next.setup;
  if (setup) {
    setup.termYears ??= '';
    setup.legacyTerm ??= '';
    if (setup.term && setup.term !== '长期' && setup.term !== '固定年限') {
      const years = setup.term.match(/^\s*(\d+)\s*年\s*$/);
      if (years) {
        setup.term = '固定年限';
        setup.termYears = years[1];
      } else {
        setup.legacyTerm = setup.term;
        setup.term = '';
      }
    }
  }
  return next;
}

const isApplication = (value: unknown): value is ApplicationData => {
  const draft = value as ApplicationData | null;
  return Boolean(draft?.basic && draft.people && draft.confirm && Array.isArray(draft.shareholders));
};

/** 载入草稿；IndexedDB 与 localStorage 都有时取 savedAt 较新的那份 */
export async function loadDraft(): Promise<ApplicationData | null> {
  let found: ApplicationData | null = null;

  try {
    const db = await getDB();
    found = await new Promise<ApplicationData | null>((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(RECORD);
      request.onsuccess = () => resolve((request.result as ApplicationData) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    // IndexedDB 不可用是正常情况，继续看 localStorage
  }

  try {
    const fallback = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as ApplicationData | null;
    const newer =
      fallback &&
      (!found || new Date(fallback.savedAt ?? 0).getTime() > new Date(found.savedAt ?? 0).getTime());
    if (newer) found = fallback;
  } catch {
    // 本地存的内容损坏时忽略，用 IndexedDB 里的那份
  }

  if (!isApplication(found)) return null;
  const draft = migrateDraft(found);
  // 每次载入顺手重算一次，避免换设备导入草稿后快照仍是旧申请的数据
  writeFlat(draft);
  return draft;
}

export const nowStamp = (): string => new Date().toLocaleString('zh-CN', { hour12: false });

/** 导出文件同时带原始结构与扁平值：前者供本系统再导入，后者供协议模板与外部程序直接取用 */
export function exportDraft(data: ApplicationData): void {
  const payload = {
    format: DRAFT_KEY,
    version: CONFIG.version,
    flat: flatten(data),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `企业注册申请_${data.basic.names.find((name) => name.trim()) || '草稿'}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * 导入的草稿来自本地文件，可能是任意内容，因此逐字段校验后才接受：
 * 附件必须是 dataURL，id 只允许字母数字与连字符（它会进 DOM 的 id 与事件参数）。
 */
export function parseImported(value: unknown): ApplicationData {
  const fail = (): never => {
    throw new Error('草稿数据结构或附件格式不正确');
  };
  if (!value || typeof value !== 'object') fail();
  const draft = value as ApplicationData;

  const strings = (target: Record<string, unknown> | undefined, keys: string[]) => {
    if (!target) fail();
    keys.forEach((key) => {
      if (typeof target[key] !== 'string') fail();
    });
  };
  const identifier = (id: unknown) => {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(id)) fail();
  };
  const files = (list: Attachment[] | undefined) => {
    if (!Array.isArray(list)) fail();
    list.forEach((file) => {
      identifier(file.id);
      strings(file as unknown as Record<string, unknown>, ['name', 'type', 'data']);
      if (file.slot !== undefined && !Object.hasOwn(PHOTO_SLOTS, file.slot)) fail();
      if (!Number.isFinite(file.size) || file.size < 0) fail();
      if (!/^data:[a-zA-Z0-9.+/=-]*;base64,[a-zA-Z0-9+/=\r\n]*$/.test(file.data)) fail();
    });
  };

  strings(draft.basic as unknown as Record<string, unknown>, ['org', 'orgOther', 'intro', 'service', 'scope', 'capital', 'regAddress', 'workAddress']);
  if (
    !Array.isArray(draft.basic.names) ||
    draft.basic.names.length < CONFIG.nameInitial ||
    draft.basic.names.length > CONFIG.nameMaximum ||
    draft.basic.names.some((name) => typeof name !== 'string')
  ) {
    fail();
  }
  ['expert', 'regRecommend', 'workRecommend'].forEach((key) => {
    if (typeof draft.basic[key as 'expert'] !== 'boolean') fail();
  });

  strings(draft.setup as unknown as Record<string, unknown>, ['board', 'directors', 'singleDirector', 'supervisorBoard', 'supervisors', 'singleSupervisor', 'term', 'employees']);
  migrateDraft(draft);
  strings(draft.setup as unknown as Record<string, unknown>, ['termYears', 'legacyTerm']);
  if (typeof draft.setup.unanimous !== 'boolean') fail();

  if (!draft.people || Array.isArray(draft.people)) fail();
  Object.entries(draft.people).forEach(([id, person]) => {
    identifier(id);
    strings(person as unknown as Record<string, unknown>, ['name', 'phone', 'email', 'education', 'address']);
    files(person.files);
  });

  if (!Array.isArray(draft.shareholders) || !Array.isArray(draft.roles)) fail();
  draft.shareholders.forEach((record) => {
    identifier(record.id);
    strings(record as unknown as Record<string, unknown>, ['type', 'name', 'code', 'ratio', 'amount']);
    if (!Array.isArray(record.method) || record.method.some((item) => typeof item !== 'string')) fail();
    if (!SHARE_TYPES.includes(record.type)) fail();
    files(record.files);
    if (record.type === '自然人' && !Object.hasOwn(draft.people, record.personId ?? '')) fail();
  });
  draft.roles.forEach((record) => {
    identifier(record.id);
    if (!Object.hasOwn(draft.people, record.personId ?? '')) fail();
    if (!Array.isArray(record.roles) || record.roles.some((role) => !ROLES.includes(role))) fail();
  });

  ['accurate', 'exemption'].forEach((key) => {
    if (typeof draft.confirm[key as 'accurate'] !== 'boolean') fail();
  });
  identifier(draft.id);
  if (!['draft', 'submitted'].includes(draft.status)) fail();

  return draft;
}

/** 导入文件 → 校验通过的数据；文件本身不合法时抛出可读错误 */
export async function importDraftFile(file: File): Promise<ApplicationData> {
  let parsed: { format?: string; data?: unknown };
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('请选择由本申请系统导出的草稿文件');
  }
  if (parsed.format !== DRAFT_KEY || !parsed.data) {
    throw new Error('请选择由本申请系统导出的草稿文件');
  }
  return parseImported(parsed.data);
}
