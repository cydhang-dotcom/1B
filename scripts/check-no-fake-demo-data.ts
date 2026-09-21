/**
 * 守门断言：源码里不许再出现那套写死的示例数据。
 *   npx tsx scripts/check-no-fake-demo-data.ts
 *
 * 为什么值得专门守一道：第 5 步申报表原先的初始数据是一整套编好的示例（假姓名、假身份证号、
 * 假手机号、假企业描述）。这类「看着像真的」的兜底会散落在很多地方 —— 初始数据、空值渲染、
 * 委托书模板、验证弹窗默认号 —— 只要有一处漏了，用户就会在申报材料里看到别人的信息。
 * 纯逻辑自检只能覆盖被调用的那条路径，所以这里直接扫源码。
 *
 * 允许出现在**注释**里（说明历史），所以按「代码行」判定：去掉行内注释后再比对。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** 出现过就说明有人又把示例数据写回来了 */
const FORBIDDEN = [
  '林楚天', // 示例法定代表人姓名
  '440301199308123418', // 示例身份证号
  '13800138000', // 示例手机号
  '跨境独立站全渠道运营', // 示例企业描述
  '海外仓配履约', // 示例主营业务
  'BB-8029', // 示例顾问工号
  '李经理', // 示例顾问称呼
];

const ROOT = 'src';
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-www', 'dist-biz', '.git']);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return SKIP_DIRS.has(entry) ? [] : walk(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });

/** 去掉行内注释：只比对真正的代码文本，历史说明留在注释里是允许的 */
const codeOf = (line: string): string => line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');

let problems = 0;
let scanned = 0;

for (const file of walk(ROOT)) {
  scanned += 1;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const code = codeOf(line);
    for (const literal of FORBIDDEN) {
      if (code.includes(literal)) {
        problems += 1;
        console.error(`✗ ${file}:${index + 1} 代码里出现写死的示例数据「${literal}」`);
      }
    }
  });
}

console.log(`\n扫描 ${scanned} 个源文件，${problems === 0 ? '未发现' : `发现 ${problems} 处`}写死的示例数据`);
if (problems > 0) process.exit(1);
