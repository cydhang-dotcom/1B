/**
 * 第 1 步两个大模型接口的**超时**自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-plan-timeout.ts
 *
 * 覆盖三件事：
 *   1. 请求底座的默认超时是 **5 分钟**（300s）—— 线上大模型偶发跑一两分钟，
 *      原先 60s 会把用户等了半天的这次推演白扔；
 *   2. **第 1 步的两个调用点确实吃这个默认值**（`aiFill` 的 AI 智能填充、`planGenerate` 的生成需求方案
 *      都没在调用时传更短的超时）—— 常量改了但调用点自己写死 30s 的话，等于没改；
 *   3. **别的接口没被顺手一起放宽**：短信验证码 15s、申报资料保存/提交 15s、附件上传 60s、
 *      支付相关请求 15s。放宽超时是「第 1 步大模型」这一件事的例外，不该变成全局行为。
 */
import fs from 'node:fs';
import path from 'node:path';
import { REQUEST_TIMEOUT_MS } from '../src/copreg/apiClient';
import { OPEN_INFO_TIMEOUT_MS } from '../src/copreg/registration/openInfo';
import { FILE_UPLOAD_TIMEOUT_MS } from '../src/utils/fileUpload';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}${extra ? ` —— ${extra}` : ''}`);
  }
}

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/** 数出文件里每个 `postJson(` 调用的**顶层参数个数**（括号配对 + 顶层逗号），用来抓「调用点自己写死超时」 */
function postJsonArgCounts(source: string): number[] {
  const counts: number[] = [];
  const needle = 'postJson(';
  let from = 0;
  for (;;) {
    const start = source.indexOf(needle, from);
    if (start === -1) break;
    let depth = 0;
    let commas = 0;
    let i = start + needle.length - 1;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '(' || ch === '[' || ch === '{') depth += 1;
      else if (ch === ')' || ch === ']' || ch === '}') {
        depth -= 1;
        if (depth === 0) break;
      } else if (ch === ',' && depth === 1) commas += 1;
    }
    counts.push(commas + 1);
    from = i + 1;
  }
  return counts;
}

/* --------------------------------- 1. 默认超时 = 5 分钟 */

ok('请求底座默认超时是 5 分钟（300_000ms）', REQUEST_TIMEOUT_MS === 300_000, String(REQUEST_TIMEOUT_MS));
ok('就是字面意义的 5 分钟（不是 4/6 分钟）', REQUEST_TIMEOUT_MS === 5 * 60_000, String(REQUEST_TIMEOUT_MS));
ok(
  '不再是改造前的 60s',
  REQUEST_TIMEOUT_MS !== 60_000,
  String(REQUEST_TIMEOUT_MS)
);

/* --------------------------------- 2. 第 1 步两个调用点吃默认值 */

const aiFillSource = read('src/copreg/aiFill.ts');
const planGenerateSource = read('src/copreg/planGenerate.ts');

const aiFillCalls = postJsonArgCounts(aiFillSource);
const planCalls = postJsonArgCounts(planGenerateSource);

ok(
  'AI 智能填充只有一个 postJson 调用，且没传第 4 个参数（吃 5 分钟默认值）',
  aiFillCalls.length === 1 && aiFillCalls[0] === 3,
  JSON.stringify(aiFillCalls)
);
ok(
  '生成需求方案只有一个 postJson 调用，且没传第 4 个参数（吃 5 分钟默认值）',
  planCalls.length === 1 && planCalls[0] === 3,
  JSON.stringify(planCalls)
);
ok(
  '两个调用点都没自己写死超时数字（源码里不出现 timeoutMs）',
  !aiFillSource.includes('timeoutMs') && !planGenerateSource.includes('timeoutMs'),
  ''
);

/* --------------------------------- 3. 别的接口没被顺手放宽 */

ok('申报资料保存/提交仍是 15s', OPEN_INFO_TIMEOUT_MS === 15_000, String(OPEN_INFO_TIMEOUT_MS));
ok('附件上传仍是 60s', FILE_UPLOAD_TIMEOUT_MS === 60_000, String(FILE_UPLOAD_TIMEOUT_MS));

const verificationSource = read('src/copreg/verification.ts');
ok(
  '短信验证码接口仍是 15s（第一步里那个接口不该等 5 分钟）',
  /REQUEST_TIMEOUT_MS\s*=\s*15_000/.test(verificationSource),
  ''
);

const paymentClientSource = read('src/payment/client.ts');
ok(
  '支付相关请求仍是 15s',
  /DEFAULT_TIMEOUT_MS\s*=\s*15_000/.test(paymentClientSource),
  ''
);

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
