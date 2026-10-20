/**
 * #fill-details 的 OpenAPI 文件（`docs/openapi/copreg-fill-details.yaml`）自检：
 * 不起服务、不联网、不碰 React。纯源码级契约 —— 盯的是「文档与代码有没有走岔」。
 *
 *   npx tsx scripts/check-openapi-fill-details.ts
 *
 * 为什么要这一道：这份 YAML 是给 Dify 的 Swagger API 工具导入用的，里面写死的路径、字段名、
 * 上传字段、附件位、地址性质……**全部是从代码里抄出来的口径**。改了 `config/api.ts` 的路径、
 * 把 `savaType` 「顺手改对」成 saveType、给上传换字段名、下架某个地址性质 —— 前端自检照样全绿，
 * 但 Dify 那边会静默打错接口/存错字段。所以这里逐条比两边的字面量。
 *
 * 覆盖：
 *   1. **端点**：四个路径与 `config/api.ts` 的默认值逐一对应（含上传的 zuul 前缀、读回的 {scbUuid}）；
 *   2. **保存 / 提交**：请求体恰好 `busUnionId` / `var2` / `savaType` 三个字段，`savaType` 是后端
 *      DTO 的原始拼写，取值 0 / 1；`var2` 是字符串（不是对象）；
 *   3. **上传**：`multipart/form-data` + 字段名 `file` + `format: binary`（Dify 据此生成「文件」
 *      型参数），响应字段 `fileUuid` / `fileName`；
 *   4. **只读两条**：经办人的 `busUnionId` → `handName` / `handIdNumber`、读回的 `openAccApply.var2`；
 *   5. **表单口径**：`var2` 的字段名与地址性质 / 附件位 / 出资形式 / 角色这些固定取值；
 *   6. **Dify 侧的硬要求**：servers[0] 的指向与正文文案一致（会写库，指错了就是打错环境）、
 *      每个操作都有 operationId（ASCII、不重复）与 responses。
 */
import { readFileSync } from 'node:fs';

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

const read = (path: string): string => readFileSync(path, 'utf8');

const YAML_PATH = 'docs/openapi/copreg-fill-details.yaml';
const yaml = read(YAML_PATH);
const apiConfig = read('src/config/api.ts');
const openInfoSrc = read('src/copreg/registration/openInfo.ts');
const fileUploadSrc = read('src/utils/fileUpload.ts');
const jingbanrenSrc = read('src/copreg/registration/jingbanren.ts');
const subscribeQuerySrc = read('src/copreg/registration/subscribeQuery.ts');
const serviceViewSrc = read('src/copreg/serviceView.ts');
const typesSrc = read('src/copreg/registration/types.ts');
const addressHintsSrc = read('src/copreg/registration/addressNatureHints.ts');
const recordModalSrc = read('src/copreg/registration/RecordModal.tsx');
const personnelSrc = read('src/copreg/registration/PersonnelSection.tsx');
const basicInfoSrc = read('src/copreg/registration/BasicInfoSection.tsx');
const attachmentsSrc = read('src/copreg/registration/attachments.ts');

/** `config/api.ts` 里某个端点的默认值：`import.meta.env.VITE_X || '/path'` 的 `/path` */
const pathDefaultOf = (envName: string): string => {
  const matched = new RegExp(`${envName}\\s*\\|\\|\\s*'([^']+)'`).exec(apiConfig);
  return matched ? matched[1] : '';
};

/** 取某个 path 那一整块（到下一个顶层 `  /` 或文件末尾），供逐块断言 */
const blockOf = (path: string): string => {
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => line === `  ${path}:`);
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\//.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
};

/** 请求体里的字段名（YAML 里 properties 下那一层的 key，缩进 16 格） */
const bodyPropsOf = (block: string): string[] =>
  [...block.matchAll(/^ {16}([A-Za-z_][\w]*):$/gm)].map((m) => m[1]);

/** 某个 components.schemas 组件的整块 */
const schemaBlockOf = (name: string): string => {
  const start = yaml.indexOf(`    ${name}:`);
  if (start < 0) return '';
  const rest = yaml.slice(start + 1);
  const end = rest.search(/^ {4}[A-Z]\w*:$/m);
  return end < 0 ? rest : rest.slice(0, end);
};

console.log('\n—— 一、文档头部与端点（对齐 src/config/api.ts）——');

ok('openapi 版本就是 3.1.0', /^openapi: 3\.1\.0$/m.test(yaml));
// 2026-10-14 按实际导入需要把基地址定成了生产：这组接口会写库，所以「servers 的指向」与
// 「正文写的指向」必须同时对上，不然文档会骗人去打错环境。
ok('servers 只有一条，且指向生产 yqt.ibanbu.com', (() => {
  const urls = [...yaml.matchAll(/^ {2}- url: (\S+)$/gm)].map((m) => m[1]);
  return urls.length === 1 && urls[0] === 'https://yqt.ibanbu.com';
})());
ok('正文（info.description）跟着写成生产，不再说「现在指向测试环境」', yaml.includes('现在是**生产**') && !yaml.includes('现在指向测试环境'));
ok('文件头注释也写了「写的就是生产数据」的警告', yaml.includes('写的就是生产数据'));
ok('测试环境地址仍写在正文里（换过去只需改 servers[0]）', yaml.includes('http://testv3001.yowits.net'));

const openInfoPath = pathDefaultOf('VITE_OPEN_INFO_PATH');
const uploadPath = pathDefaultOf('VITE_FILE_UPLOAD_PATH');
const jingbanrenPath = pathDefaultOf('VITE_JINGBANREN_PATH');
const subscribePath = pathDefaultOf('VITE_SUBSCRIBE_QUERY_PATH');

ok(`保存/提交默认路径取到了（${openInfoPath}）`, openInfoPath === '/xcx/yqt-co/subscribe/open-info');
ok(`上传默认路径取到了（${uploadPath}）`, uploadPath === '/zuul/v1/xcx/yqt-co/subscribe/upload/file');
ok(`经办人默认路径取到了（${jingbanrenPath}）`, jingbanrenPath === '/xcx/yqt-co/subscribe/handler');
ok(`读回默认路径取到了（${subscribePath}）`, subscribePath === '/xcx/yqt-co/subscribe/');

ok('open-info 路径 = /v1 + 代码默认值（基地址是去掉 /v1 的站点根）', blockOf(`/v1${openInfoPath}`) !== '');
ok('上传路径照抄代码默认值（自带 zuul/v1 前缀，不再加 /v1）', blockOf(uploadPath) !== '');
ok('handler 路径 = /v1 + 代码默认值', blockOf(`/v1${jingbanrenPath}`) !== '');
ok('读回路径 = /v1 + 代码默认值 + {scbUuid}', blockOf(`/v1${subscribePath}{scbUuid}`) !== '');

console.log('\n—— 二、保存 / 提交（POST open-info）——');

const openInfo = blockOf(`/v1${openInfoPath}`);
const openInfoProps = bodyPropsOf(openInfo);

ok('请求体恰好三个字段', JSON.stringify(openInfoProps) === JSON.stringify(['busUnionId', 'var2', 'savaType']));
ok('三个字段都是必填（required 里三个都在）', ['busUnionId', 'var2', 'savaType'].every((name) => new RegExp(`^ {16}- ${name}$`, 'm').test(openInfo)));
ok('字段名是 savaType —— 后端 DTO 的原始拼写，全文没有 saveType', openInfo.includes('savaType:') && !yaml.includes('saveType'));
ok('savaType 取值 0 / 1（与 OpenInfoSaveType 一致）', openInfo.includes("- '0'") && openInfo.includes("- '1'") && openInfoSrc.includes("export type OpenInfoSaveType = '0' | '1'"));
ok('var2 声明成 string（不是 object —— 服务端 DTO 收字符串）', /^ {16}var2:\n {18}type: string$/m.test(openInfo));
ok('var2 的说明里写了「必须是 JSON 字符串」', openInfo.includes('必须是 JSON 字符串'));
ok('busUnionId 的说明里点了它来自第 1 步的委托单号 recordId', openInfo.includes('recordId'));
ok('响应没被编出 code/status 字段（2xx 即成功）', openInfo.includes('2xx 即成功') || openInfo.includes('HTTP 2xx 即成功'));
ok('有 200 / 400 响应', openInfo.includes("'200':") && openInfo.includes("'400':"));

console.log('\n—— 三、上传图片 / 附件（POST upload/file）——');

const upload = blockOf(uploadPath);
const uploadProps = bodyPropsOf(upload);

ok('只有 file 一个请求体字段', JSON.stringify(uploadProps) === JSON.stringify(['file']));
ok('file 是必填', /^ {16}- file$/m.test(upload));
ok('file 是 string + format: binary（Dify 据此生成「文件」型参数）', /^ {16}file:\n {18}type: string\n {18}format: binary$/m.test(upload));
ok('content-type 就是 multipart/form-data', upload.includes('multipart/form-data:'));
ok('说明里写清字段名固定 file、一次一个文件', upload.includes('固定 `file`') && upload.includes('一次请求只传一个文件'));
ok('说明里提到 Dify 的「文件」型参数只能由用户上传/上游节点给', upload.includes('文件') && upload.includes('LLM 自己造不出文件'));
ok('响应字段是 fileUuid（必需）+ fileName', (() => {
  const uploaded = schemaBlockOf('UploadedFile');
  return uploaded.includes('fileUuid:') && uploaded.includes('fileName:') && /^ {6}required:\n {8}- fileUuid$/m.test(uploaded);
})());
ok('上传字段名与 src/utils/fileUpload.ts 的 append 一致', fileUploadSrc.includes("body.append('file'") && upload.includes('- file'));
ok('响应字段与 fileUpload.ts 读的一致（fileUuid / fileName）', fileUploadSrc.includes('raw.fileUuid') && fileUploadSrc.includes('raw.fileName'));
ok('图片地址口径写了 {DOC_HOST}/doc/uuid/{fileUuid}/get', yaml.includes('/doc/uuid/{fileUuid}/get'));

console.log('\n—— 四、只读两条：经办人 + 读回申报表 ——');

const handler = blockOf(`/v1${jingbanrenPath}`);
ok('经办人：query 参数 busUnionId（与 jingbanren.ts 的 ?busUnionId= 一致）', handler.includes('in: query') && handler.includes('name: busUnionId') && jingbanrenSrc.includes('busUnionId='));
ok('经办人：响应字段 handName / handIdNumber', schemaBlockOf('HandlerInfo').includes('handName') && schemaBlockOf('HandlerInfo').includes('handIdNumber') && jingbanrenSrc.includes('handName') && jingbanrenSrc.includes('handIdNumber'));
ok('经办人：说明里写了「读不到别把已有值抹空」', handler.includes('抹成空'));

const detail = blockOf(`/v1${subscribePath}{scbUuid}`);
ok('读回：路径参数 scbUuid', /name: scbUuid\n {10}in: path/.test(detail));
ok('读回：可选 query 参数 code（一次性查看码）', /name: code\n {10}in: query\n {10}required: false/.test(detail));
ok('读回：申报表取值路径 openAccApply.var2', detail.includes('openAccApply.var2') && serviceViewSrc.includes('openAccApply'));
ok('读回：查询码无效的 400 信封写对了', detail.includes('查询码无效或已过期'));
ok('读回：提醒写回用的是 busUnionId 而不是 scbUuid', detail.includes('不是这里的 `scbUuid`'));
ok('读回：响应里 var2 允许字符串或对象（服务端两种都给过）', detail.includes('oneOf') && serviceViewSrc.includes("typeof rawVar2 === 'string'"));

console.log('\n—— 五、var2 的表单口径（对齐 registration/types.ts 与各选项表）——');

const snapshot = schemaBlockOf('RegistrationFormSnapshot');
ok('快照字段齐（types.ts 的 RegistrationFullForm 那一层）', ['id', 'status', 'savedAt', 'submittedAt', 'submissionPhone', 'completionPercent', 'basic', 'people', 'shareholders', 'roles', 'authorization', 'confirm'].every((name) => snapshot.includes(`${name}:`) && (typesSrc.includes(`${name}`) || name === 'completionPercent')));
ok('completionPercent 是 0~100 整数', /completionPercent:\n {10}type: integer\n {10}minimum: 0\n {10}maximum: 100/.test(snapshot));
ok('附件行结构与 types.ts 的 FileAttachment 一致（id / fileUuid / fileName / size / type / slot）', (() => {
  const file = schemaBlockOf('FileAttachment');
  return ['id', 'fileUuid', 'fileName', 'size', 'type', 'slot'].every((name) => file.includes(`${name}:`) && typesSrc.includes(`${name}`));
})());

// 地址性质：2026-10-08 起只剩这三项（老的下架档不许再出现在文档里）
const ADDRESS_NATURES = ['租赁用房', '自有房产', '无偿使用证明'];
const RETIRED_NATURES = ['集中办公', '园区孵化器', '商业租赁', '自有产权'];
ok('地址性质三项：源码还在、文档都列了', ADDRESS_NATURES.every((name) => addressHintsSrc.includes(`'${name}'`) && yaml.includes(name)));
ok('已下架的地址性质没被文档写回去', RETIRED_NATURES.every((name) => !yaml.includes(name)));

// 附件位：三个选文件的地方各自写死
const SLOTS = ['idFront', 'idBack', 'license', 'regAddressProof', 'workAddressProof'];
ok('附件位五项：源码还在、文档都列了', SLOTS.every((slot) => (recordModalSrc + basicInfoSrc).includes(`'${slot}'`) && yaml.includes(slot)));
ok('说明里点了委托书 / 确认页的附件不带 slot', yaml.includes('委托书与确认页的附件不带 `slot`'));

// 出资形式：RecordModal 的 CONTRIBUTION_METHODS
const METHODS = ['货币', '实物', '知识产权', '土地使用权', '劳务', '其他'];
ok('出资形式六项：源码还在、文档都列了', METHODS.every((name) => recordModalSrc.includes(`'${name}'`) && yaml.includes(name)));

// 主要人员角色：ALL_ROLES + 条件追加的董事 / 监事
const ROLES = ['法定代表人', '财务负责人', '联系人', '总经理', '董事', '监事'];
ok('角色六项：源码还在、文档都列了', ROLES.every((name) => personnelSrc.includes(`'${name}'`) && yaml.includes(name)));

// 组织形式与董事 / 监事设置：界面上的字面量（含「设 1 名董事」中间那个空格）
ok('组织形式四项（含「其他」）', ['有限责任公司', '股份有限公司', '合伙企业', '其他'].every((name) => yaml.includes(name) && (basicInfoSrc.includes(name) || name === '其他')));
ok('董事会 / 董事 / 监事设置的字面量与界面一致', ['设董事会', '不设董事会', '设 1 名董事', '由总经理代行职务（不设董事）', '设 1 名监事', '不设监事'].every((name) => basicInfoSrc.includes(name) && yaml.includes(name)));
ok('注册资本 / 比例 / 金额 / 人数都注明是字符串数字', ['capital', 'ratio', 'amount', 'directors'].every((name) => new RegExp(`^ {8}${name}:\\n {10}type: string\\n {10}description: [^\\n]*字符串`, 'm').test(yaml)));

console.log('\n—— 六、Dify 导入的硬要求 ——');

const operationIds = [...yaml.matchAll(/^ {6}operationId: (.+)$/gm)].map((m) => m[1].trim());
ok('四个操作都有 operationId', operationIds.length === 4);
ok('operationId 不重复', new Set(operationIds).size === operationIds.length);
ok('operationId 全是 ASCII（工具名会进工作流变量引用）', operationIds.every((id) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(id)));
ok('主用两个的 operationId 就叫 saveSubscribeOpenInfo / uploadSubscribeFile', operationIds.includes('saveSubscribeOpenInfo') && operationIds.includes('uploadSubscribeFile'));
ok('每个操作都有 summary（Dify 拿 description 优先、summary 兜底当工具描述）', [...yaml.matchAll(/^ {6}summary: /gm)].length === 4);
ok('每个操作都有 responses（OpenAPI 要求；缺了导入器/校验器都会挑刺）', [...yaml.matchAll(/^ {6}responses:$/gm)].length === 4);
ok('没有 securitySchemes（这一族接口走内网网关，Dify 里认证选「无」）', !yaml.includes('securitySchemes') && !/^security:/m.test(yaml));
ok('附件上传没有引用外部 $ref 到 components.parameters（Dify 只解析内联参数与 schema $ref）', !yaml.includes('components:\n  parameters:'));

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
