/**
 * 非 2xx 响应体 → 错误文案的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-server-error.ts
 *
 * 覆盖：
 *   1. 用户实测的 JSON 信封只出「短信验证码错误」，`timestamp` / `path` / `recordId` 这些机器字段一个都不许透出；
 *   2. **信封里再套一层 JSON**（网关把上游 504 原样塞进 message）要递归拆开，翻成「{接口名}超时，请稍后重试」，
 *      `requestId` / `AI_TIMEOUT` / `Gateway Timeout` 同样不许透出；
 *   3. JSON 里只有 `error: "Bad Request"` 这类 HTTP 短语时用兜底文案，而不是把 JSON 或英文短语甩给用户；
 *   4. 支付那套 `reasons[]` 信封、再套一层的 `data`、`msg_id` 都能取到人话；
 *   5. 纯文本后端文案原样用；网关 HTML / 空体 / 说不清是 JSON 又解析不了 → 兜底。
 */
import { serverErrorTextOf, serverMessageOf } from '../src/utils/serverError';

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

/** 用户实测的那份 400 响应体，逐字保留 */
const REAL_ERROR = JSON.stringify({
  timestamp: '2026-09-23T09:22:28.759Z',
  path: '/api/company-plan/diagnose-architecture',
  status: 400,
  error: 'Bad Request',
  message: '短信验证码错误',
  code: 'error.0098',
  recordId: 'error.0098',
  submittedToCustomerService: false,
  retryable: false,
});

/** 用户实测的第二份：502，`message` 里再套一层上游 504 JSON */
const NESTED_ERROR = JSON.stringify({
  timestamp: '2026-09-24T06:12:02.328Z',
  path: '/api/company-plan/ai-fill',
  status: 502,
  error: 'Bad Gateway',
  message: JSON.stringify({
    timestamp: '2026-09-24T06:12:02.309855268Z',
    path: '/ai/chat',
    status: 504,
    error: 'Gateway Timeout',
    code: 'AI_TIMEOUT',
    message: 'AI request timed out',
    requestId: '78dea60c-423',
  }),
  code: null,
  recordId: null,
  submittedToCustomerService: false,
  retryable: false,
});

function main() {
  const LABEL = '生成需求方案';

  // 1. 用户实测的信封
  const real = serverErrorTextOf(REAL_ERROR, 400, LABEL);
  ok('实测信封只取 message', real === '短信验证码错误');
  ok('不带 timestamp', !real.includes('timestamp') && !real.includes('2026-09-23'));
  ok('不带 path', !real.includes('/api/company-plan'));
  ok('不带 code / recordId 机器字段', !real.includes('error.0098'));
  ok('不带英文 error 短语', !real.includes('Bad Request'));

  // 2. 信封里再套一层 JSON（网关把上游 504 塞进 message）
  const nested = serverErrorTextOf(NESTED_ERROR, 502, 'AI 智能填充');
  ok('嵌套信封翻成超时文案', nested === 'AI 智能填充超时，请稍后重试');
  ok('嵌套层不带 requestId', !nested.includes('78dea60c') && !nested.includes('requestId'));
  ok('嵌套层不带 AI_TIMEOUT / Gateway Timeout', !nested.includes('AI_TIMEOUT') && !nested.includes('Gateway Timeout'));
  ok('嵌套层不带内层 timestamp / path', !nested.includes('2026-09-24') && !nested.includes('/ai/chat'));
  ok('serverMessageOf 能拆到最里层那句话', serverMessageOf(JSON.parse(NESTED_ERROR)) === 'AI request timed out');
  ok(
    '嵌套层是中文文案时原样用（不被超时覆盖）',
    serverErrorTextOf(
      JSON.stringify({ status: 502, message: JSON.stringify({ status: 504, message: '上游服务超时' }) }),
      502,
      'AI 智能填充',
    ) === '上游服务超时',
  );
  ok(
    '嵌套层只有 504 没有文案时也翻成超时',
    serverErrorTextOf(
      JSON.stringify({ status: 502, message: JSON.stringify({ status: 504, error: 'Gateway Timeout' }) }),
      502,
      'AI 智能填充',
    ) === 'AI 智能填充超时，请稍后重试',
  );
  ok(
    '嵌套太深不再递归、也不透出 JSON',
    (() => {
      let inner = JSON.stringify({ message: '最里层文案' });
      for (let i = 0; i < 8; i += 1) inner = JSON.stringify({ message: inner });
      const text = serverErrorTextOf(inner, 502, 'AI 智能填充');
      return text === 'AI 智能填充失败（502）' && !text.includes('{');
    })(),
  );

  // 3. JSON 但取不到人话
  ok(
    '只有 error: Bad Request → 兜底文案',
    serverErrorTextOf(JSON.stringify({ status: 400, error: 'Bad Request' }), 400, LABEL) === `${LABEL}失败（400）`,
  );
  ok(
    '只有 message: Bad Request → 也算 HTTP 短语，兜底',
    serverErrorTextOf(JSON.stringify({ message: 'Bad Request' }), 400, LABEL) === `${LABEL}失败（400）`,
  );
  ok('空 JSON 对象 → 兜底', serverErrorTextOf('{}', 500, LABEL) === `${LABEL}失败（500）`);
  ok('JSON 数组 → 兜底', serverErrorTextOf('["a","b"]', 500, LABEL) === `${LABEL}失败（500）`);
  ok('看着像 JSON 又解析不了 → 兜底', serverErrorTextOf('{oops', 400, LABEL) === `${LABEL}失败（400）`);

  // 4. 其它信封
  ok(
    'reasons[] 信封取 message',
    serverErrorTextOf(
      JSON.stringify({ reasons: [{ msg_id: '当前订单已完成支付，或请联系客服。', field: '' }] }),
      400,
      '支付',
    ) === '当前订单已完成支付，或请联系客服。',
  );
  ok(
    'reasons[] 里优先 message 再 msg_id',
    serverMessageOf({ reasons: [{ msg_id: 'msg_id 文案', message: 'message 文案' }] }) === 'message 文案',
  );
  ok(
    '外层 data 再套一层也能取到',
    serverErrorTextOf(JSON.stringify({ data: { message: '资料不完整' } }), 400, LABEL) === '资料不完整',
  );
  ok(
    '平铺 msg 也能取到',
    serverErrorTextOf(JSON.stringify({ code: '1', msg: '验证码已过期' }), 400, LABEL) === '验证码已过期',
  );

  // 5. 纯文本 / HTML / 空体
  ok(
    '纯文本后端文案原样用（回归既有行为）',
    serverErrorTextOf('文件太大，请压缩后重试', 413, '附件上传') === '文件太大，请压缩后重试',
  );
  ok(
    '网关 HTML 用兜底',
    serverErrorTextOf('<html>502 Bad Gateway</html>', 502, '附件上传') === '附件上传失败（502）',
  );
  ok('空体用兜底', serverErrorTextOf('   ', 500, LABEL) === `${LABEL}失败（500）`);
  ok('serverMessageOf 对非对象返回 null', serverMessageOf('nope') === null && serverMessageOf(null) === null);
}

main();

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
