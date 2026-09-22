/**
 * 附件上传与附件地址的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-file-upload.ts
 *
 * 覆盖三件事：
 *   1. **地址拼法** `docUuidUrl`：空 id / 空 host 返回空串（不拼出 `.../doc/uuid//get`），
 *      文件 id 转义，host 尾斜杠不拼出双斜杠；
 *   2. **上传请求** `uploadFileTo`：端点是 multipart、字段名 file、**不手写 Content-Type**
 *      （boundary 要由浏览器生成）、路径没配时一个请求都不发，以及各种失败都被翻译成
 *      能直接展示的中文提示；
 *   3. **附件收口**：上传结果怎么收成一行附件，存档里读回来的怎么收 —— 尤其是旧版本
 *      存的 dataURL 附件（没有 fileUuid）必须丢掉，不能拿去提交。
 */
import { docUuidUrl } from '../src/utils/docUuidUrl';
import {
  FILE_UPLOAD_TIMEOUT_MS,
  FileUploadNotConfiguredError,
  uploadFileTo,
} from '../src/utils/fileUpload';
import {
  attachmentFromUpload,
  sanitizeAttachment,
  sanitizeAttachments,
  sanitizeFormAttachments,
} from '../src/copreg/registration/attachments';
import type { RegistrationFullForm } from '../src/copreg/registration/types';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

const DOC_HOST = 'https://yqt.ibanbu.com/v1';
const ENDPOINT = { host: 'https://v3001.ibanbu.com', path: '/xcx/yqt-co/subscribe/upload-file' };

const png = (name = '身份证人像面.png') => new File(['fake-bytes'], name, { type: 'image/png' });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const textResponse = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });

/** 记下这次请求，返回一个假的 fetch */
const capturingFetch = (response: Response) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return response;
  }) as unknown as typeof fetch;
  return { calls, impl };
};

const failureOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '(没有抛错)';
};

/* ------------------------------------------------------------ 地址拼法 */

{
  ok('host + 文件 id 拼成 doc 服务地址', docUuidUrl(DOC_HOST, 'abc123') === `${DOC_HOST}/doc/uuid/abc123/get`);
  ok('host 尾斜杠不会拼出双斜杠', docUuidUrl('https://a.com/v1/', 'f1') === 'https://a.com/v1/doc/uuid/f1/get');
  ok(
    '文件 id 里的特殊字符被转义',
    docUuidUrl(DOC_HOST, 'a b/c') === `${DOC_HOST}/doc/uuid/a%20b%2Fc/get`
  );
  ok('id 前后空白被去掉', docUuidUrl(DOC_HOST, ' f1 ') === `${DOC_HOST}/doc/uuid/f1/get`);
  ok('空 id（空串 / undefined / null / 数字）→ 空串', [ '', undefined, null, 42 ].every((v) => docUuidUrl(DOC_HOST, v as string) === ''));
  ok('只有空白字符的 id → 空串', docUuidUrl(DOC_HOST, '   ') === '');
  ok('host 为空 → 空串（不拼出半截地址）', docUuidUrl('', 'f1') === '' && docUuidUrl('  ', 'f1') === '');
}

/* -------------------------------------------------------------- 上传请求 */

{
  const { calls, impl } = capturingFetch(jsonResponse({ fileUuid: 'FILE-1', fileName: '对方存的名字.png' }));
  const uploaded = await uploadFileTo(ENDPOINT, png(), { fetchImpl: impl });

  ok('地址由 host + path 拼成', calls[0].url === 'https://v3001.ibanbu.com/xcx/yqt-co/subscribe/upload-file');
  ok('方法是 POST', calls[0].init?.method === 'POST');
  ok('body 是 FormData（multipart）', calls[0].init?.body instanceof FormData);
  ok(
    '文件放在 file 字段里，且带着文件名',
    (() => {
      const file = (calls[0].init?.body as FormData).get('file') as File;
      return file instanceof File && file.name === '身份证人像面.png' && file.type === 'image/png';
    })()
  );
  ok(
    '不手写 Content-Type（boundary 必须由浏览器生成）',
    calls[0].init?.headers === undefined
  );
  ok('返回 fileUuid 与 fileName', uploaded.fileUuid === 'FILE-1' && uploaded.fileName === '对方存的名字.png');
  ok('上传超时给到 60s', FILE_UPLOAD_TIMEOUT_MS === 60_000);
}

{
  const { impl } = capturingFetch(jsonResponse({ fileUuid: ' F1 ' }));
  const uploaded = await uploadFileTo(ENDPOINT, png(), { fetchImpl: impl });
  ok('服务端没给 fileName 时留空（不是失败，展示回落到本地文件名）', uploaded.fileName === '');
  ok('fileUuid 前后空白被去掉', uploaded.fileUuid === 'F1');
}

{
  const { calls, impl } = capturingFetch(jsonResponse({ fileUuid: 'F1' }));
  const message = await failureOf(() => uploadFileTo({ ...ENDPOINT, path: '' }, png(), { fetchImpl: impl }));
  ok('路径没配 → 提示「尚未接入」', message.includes('附件上传接口尚未接入'));
  ok('路径没配时一个请求都不发', calls.length === 0);
  ok(
    '抛的是专门的错误类型（调用方可以据此区分「没接通」与「网络异常」）',
    (await failureOf(() => uploadFileTo({ ...ENDPOINT, path: '' }, png(), { fetchImpl: impl }))) ===
      new FileUploadNotConfiguredError().message
  );
}

{
  const { impl } = capturingFetch(textResponse('文件太大，请压缩后重试', 413));
  const message = await failureOf(() => uploadFileTo(ENDPOINT, png(), { fetchImpl: impl }));
  ok('非 2xx 用后端文案', message === '文件太大，请压缩后重试');

  const html = capturingFetch(textResponse('<html>502 Bad Gateway</html>', 502));
  ok('网关 HTML 用兜底文案', (await failureOf(() => uploadFileTo(ENDPOINT, png(), { fetchImpl: html.impl }))) === '附件上传失败（502）');
}

{
  const { impl } = capturingFetch(jsonResponse({ fileName: '没有编号.png' }));
  ok('响应里没有 fileUuid → 按失败处理', (await failureOf(() => uploadFileTo(ENDPOINT, png(), { fetchImpl: impl }))).includes('未返回文件编号'));

  const blank = capturingFetch(jsonResponse({ fileUuid: '   ' }));
  ok('fileUuid 只有空白 → 同样算失败', (await failureOf(() => uploadFileTo(ENDPOINT, png(), { fetchImpl: blank.impl }))).includes('未返回文件编号'));

  const notJson = capturingFetch(textResponse('OK', 200));
  ok('响应不是 JSON → 格式异常', (await failureOf(() => uploadFileTo(ENDPOINT, png(), { fetchImpl: notJson.impl }))).includes('返回格式异常'));
}

{
  const network = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  ok('网络不通 → 中文提示', (await failureOf(() => uploadFileTo(ENDPOINT, png(), { fetchImpl: network }))) === '网络异常，请检查网络后重试');
}

{
  // 永不 resolve 的请求 + 1ms 超时：应当超时中断并给中文提示
  const hanging = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;
  ok('超时 → 中文提示', (await failureOf(() => uploadFileTo(ENDPOINT, png(), { fetchImpl: hanging, timeoutMs: 5 }))) === '附件上传超时，请稍后重试');
}

/* -------------------------------------------------------------- 附件收口 */

{
  const attachment = attachmentFromUpload({ fileUuid: 'F1', fileName: '服务端名.png' }, { name: '本地名.png', size: 1234, type: 'image/png' }, 'row-1', 'idFront');
  ok('上传结果收成一行附件', attachment.fileUuid === 'F1' && attachment.fileName === '服务端名.png');
  ok('保留本地的大小与类型（服务端不回）', attachment.size === 1234 && attachment.type === 'image/png');
  ok('行 key 用本地 id，槽位原样带上', attachment.id === 'row-1' && attachment.slot === 'idFront');

  const fallback = attachmentFromUpload({ fileUuid: 'F2', fileName: '' }, { name: '本地名.pdf', size: 10, type: '' }, 'row-2');
  ok('服务端没给名字 → 回落本地文件名', fallback.fileName === '本地名.pdf');
  ok('类型缺失 → application/octet-stream', fallback.type === 'application/octet-stream');
  ok('没传槽位就不带 slot 字段', !('slot' in fallback) && !('data' in fallback));
}

{
  ok('正常附件原样收下', sanitizeAttachment({ id: 'r1', fileUuid: 'F1', fileName: 'a.png', size: 5, type: 'image/png', slot: 'idFront' })?.fileUuid === 'F1');
  ok('缺 id 时补一个稳定的行 key', sanitizeAttachment({ fileUuid: 'F1' })?.id === 'file-F1');
  ok('size 不是数字时归零', sanitizeAttachment({ fileUuid: 'F1', size: 'big' })?.size === 0);
  ok('type 缺失时给个兜底', sanitizeAttachment({ fileUuid: 'F1' })?.type === 'application/octet-stream');

  // 旧版本存档：只有 dataURL、没有 fileUuid —— 服务端不知道这个文件，留着只会渲染裂图
  ok(
    '旧存档的 dataURL 附件被丢掉',
    sanitizeAttachment({ id: 'r1', name: 'a.png', size: 5, type: 'image/png', data: 'data:image/png;base64,AA==' }) === null
  );
  ok('没有 fileUuid 的都丢掉', [null, undefined, 'F1', 42, {}, [], { fileUuid: '  ' }].every((v) => sanitizeAttachment(v as unknown) === null));
  ok('不是数组时收成空数组', [null, undefined, 'F1', {}].every((v) => sanitizeAttachments(v as unknown).length === 0));
  ok(
    '一组附件里坏的丢掉、好的留下',
    sanitizeAttachments([{ fileUuid: 'F1' }, { name: '旧附件' }, null]).length === 1
  );
}

{
  const base = {
    id: 'form-1',
    status: 'draft',
    savedAt: null,
    submittedAt: null,
    submissionPhone: '',
    basic: { regFiles: [{ fileUuid: 'F1' }, { name: '旧场地证明', data: 'data:application/pdf;base64,AA==' }], workFiles: [] },
    people: { p1: { id: 'p1', name: '', phone: '', email: '', education: '', address: '', files: [{ name: '旧证件照', data: 'data:image/png;base64,AA==' }] } },
    shareholders: [{ id: 's1', type: '企业', personId: null, name: '', code: '', ratio: '', amount: '', method: ['货币'], files: [{ fileUuid: 'F2' }, { name: '旧执照' }] }],
    roles: [],
    authorization: { trusteeName: '', trusteeIdNumber: '', entrustDate: '2026-01-01', files: [{ name: '旧委托书' }] },
    confirm: { exemption: false, beneficiary: '', accurate: false, files: [{ fileUuid: 'F3' }] },
  } as unknown as RegistrationFullForm;

  const cleaned = sanitizeFormAttachments(base);
  ok('场地证明：新附件留住、旧 dataURL 丢掉', cleaned.basic.regFiles?.length === 1 && cleaned.basic.regFiles[0].fileUuid === 'F1');
  ok('人员证件照：旧 dataURL 丢掉', cleaned.people.p1.files.length === 0);
  ok('股东附件：只留带 fileUuid 的那份', cleaned.shareholders[0].files.length === 1 && cleaned.shareholders[0].files[0].fileUuid === 'F2');
  ok('委托书：旧附件丢掉', cleaned.authorization.files.length === 0);
  ok('确认页附件保留', cleaned.confirm.files.length === 1 && cleaned.confirm.files[0].fileUuid === 'F3');
  ok('除附件外的字段原样带出', cleaned.id === 'form-1' && cleaned.shareholders[0].method[0] === '货币');
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
