import { flatten, writeFlat } from './flat';
import { CONFIG, clone, emptyAuthorization, listOf, type ApplicationData } from './model';

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
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DRAFT_KEY, 1);
      // 开库被别的标签页挡住时可能既不成功也不失败，超时后交给 localStorage 兜底，
      // 否则 loadDraft 永远不返回，页面会一直停在「正在载入本地草稿…」
      const timer = setTimeout(() => reject(new Error('本地数据库打开超时')), 3000);
      const done = () => clearTimeout(timer);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => {
        done();
        resolve(request.result);
      };
      request.onerror = () => {
        done();
        reject(request.error ?? new Error('无法打开本地数据库'));
      };
      request.onblocked = () => {
        done();
        reject(new Error('本地数据库被其他标签页占用'));
      };
    }).catch((cause) => {
      // 失败不缓存，下次暂存还能重试开库
      dbPromise = null;
      throw cause;
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
 * 旧草稿迁移：出资形式历史上是可以直接点选的字符串，设立期限历史上写作「20 年」，
 * 委托书是后加的章节。迁移只改结构不改内容，保证老草稿能继续打开。
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
  // 委托书章节是后加的：老草稿补一份空结构。历史上允许多份，本版只留一份，多余的丢掉
  const auth = (next.authorization ?? {}) as Partial<ApplicationData['authorization']>;
  const blank = emptyAuthorization();
  next.authorization = {
    trusteeName: typeof auth.trusteeName === 'string' ? auth.trusteeName : blank.trusteeName,
    trusteeIdNumber: typeof auth.trusteeIdNumber === 'string' ? auth.trusteeIdNumber : blank.trusteeIdNumber,
    files: Array.isArray(auth.files) ? auth.files.slice(0, 1) : blank.files,
  };
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

/** 导出文件同时带原始结构与扁平值：前者是完整申请数据，后者供协议模板与外部程序直接取用 */
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

