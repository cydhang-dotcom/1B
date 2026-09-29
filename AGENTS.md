# AGENTS.md

给 AI 协作者的项目说明。**先读这一页**（根目录 `README.md` 是 AI Studio 生成的模板，内容已过期，别照着它跑）。

---

## 0. 这个项目是什么

`copreg`（企业注册向导）的**上线实现**：问卷 → AI 架构诊断方案 → 支付 → 服务群 → 申报资料填报 → 办理进度，六个步骤同页流转。

- 源码在 `src/`，业务主体在 `src/copreg/**`，构建产物 `dist-www/`（主站，base `/OneBiz/`）与 `dist-biz/`（biz 站，base `/`）
- 页面入口：`copreg.html`（主流程）、`presales.html`（售前咨询）

## 1. 设计稿（参考实现）在本机哪里

**设计稿 = GitHub 上的 `cydhang-dotcom/copreg`，已 clone 到本机：**

| | |
|---|---|
| 路径 | **`/Users/yjj/github-repo/copreg`**（含 `.git`，可直接 pull） |
| 远端 | `git@github.com:cydhang-dotcom/copreg.git`（SSH） |
| 当前基线 | `b1e10ef`（2026-09-24，“refactor: improve registration module UI and validation”） |
| 技术栈 | React + Vite + Bun（`bun.lock`），`npm run dev` 起在 3000 端口 |

**更新设计稿：**

```bash
git -C /Users/yjj/github-repo/copreg pull --ff-only
```

- ⚠️ 这台机器上 **HTTPS 拉 GitHub 会超时**（`git clone https://github.com/...` / `git ls-remote https://...` 都会 “Operation too slow”），**只有 SSH 通**：`git@github.com:...`。要新 clone 别的仓库也用 SSH。
- ⚠️ 设计稿仓库**只读**：不要往它提交、推送或改文件，除非用户明确要求。
- ⚠️ 沙箱权限：**读** `/Users/yjj/github-repo/**`（`read` / `grep` / `git log`）不受影响；但 **`git pull` 要写 `.git/FETCH_HEAD`**，还有 `git clone`、任何落盘操作都需要 **`danger-full-access`**（在文件沙箱下会报 `Operation not permitted`）。

**它的定位**：版式、文案、交互流程、价目表的**基准**。用户说「按设计稿改」「对齐设计稿」时，先到那个目录里翻对应文件，再落到本项目。

### 1.1 文件对照（设计稿 → 本项目）

| 设计稿（`/Users/yjj/github-repo/copreg`） | 本项目 |
|---|---|
| `src/App.tsx`（六步状态机、全流程串起来） | `src/copreg/App.tsx` |
| `src/components/SurveyStep.tsx`（第 1 步 + 短信弹框 + AI 推演弹框都在里面） | `src/copreg/components/SurveyStep.tsx` + `PhoneVerifyModal.tsx` + `PlanGeneratingModal.tsx`（本项目拆成了三个文件） |
| `src/data/mockData.ts`（**价目表**：三档套餐明细、自选增值服务、行业模板） | 报价 → `src/copreg/components/proposalQuote.ts`；方案拼装 → `src/copreg/plan.ts`；行业模板 → `plan.ts` |
| `src/components/ProposalStep.tsx`（方案页、套餐卡片） | `src/copreg/components/ProposalStep.tsx` |
| `src/components/AgreementAndPaymentStep.tsx` | `src/copreg/components/AgreementAndPaymentStep.tsx` |
| `src/components/ServiceGroupStep.tsx` | `src/copreg/components/ServiceGroupStep.tsx` |
| `src/components/ProgressAndReviewStep.tsx` | `src/copreg/components/ProgressAndReviewStep.tsx` |
| `src/components/TopNavbar.tsx` | `src/copreg/components/TopNavbar.tsx` |
| `src/components/RegistrationDetailsStep.tsx` | `src/copreg/components/RegistrationDetailsStep.tsx` |
| `src/components/registration/*`（基本信息 / 股东 / 人员 / 委托书 / 确认 / 弹框） | `src/copreg/registration/*`（同名文件基本一一对应，另有 `addressNatureHints.ts`、`conflicts.ts`、`openInfo.ts`、`attachments.ts` 等本项目新增） |
| `src/utils/exportPdf.ts` | `src/copreg/exportProposalPdf.ts` + `proposalPdfPages.ts` + `proposalReportDoc.ts` |
| `src/types.ts` | `src/copreg/types.ts` |
| `PROMPT_REPORT_SCHEMA.md`（后端诊断报告的 JSON 提示词规范） | 解析在 `src/copreg/planReport.ts`，展示在 `components/PlanReportView.tsx` |

### 1.2 本项目**有意**偏离设计稿的地方（别当成 bug「改回去」）

- **多主体申请**：`src/copreg/applications.ts` 的 `MULTI_APPLICATION_ENABLED`（当前 `false`，顶栏切换被屏蔽，模型与代码保留，改回 `true` 即恢复）—— 设计稿没有。
- **第 1 步大模型超时 5 分钟**：`src/copreg/apiClient.ts` 的 `REQUEST_TIMEOUT_MS = 5 * 60_000`；设计稿的 fetch 没有超时。
- **架构诊断报告**：走后端**新版报告结构**（`reportTitle` / `diagnosticBar` / `coreDecisions`…），设计稿只有旧的平铺字段。
- **短信验证**：真实腾讯行为验证码 + 服务端比对验证码（`verification.ts` + `PhoneVerifyModal.tsx`）；设计稿是 demo 的固定测试码。
- **申报资料接口**：保存草稿 / 提交走真实接口（`registration/openInfo.ts`）；设计稿只在本地。
- **打印/导出**：委托书与报告走隐藏 iframe（`src/utils/printDocument.ts`），不是全局 `@media print`。
- **校验脚本**：`scripts/check-*.ts`、`.mcp-work/verify-*.mjs` 全是本项目独有（设计稿没有测试）。
- 价目表已按设计稿对齐（2026-09-29，见 `git-change.md`）。

## 2. 常用命令

```bash
npm run dev            # 本机预览：http://127.0.0.1:5173/1B/copreg.html
npm run lint           # tsc --noEmit（没开 strict，见 §3）
npm run build          # 构建 dist-www/（base /OneBiz/）
npm run build:biz      # 构建 dist-biz/（base /）
npm run check:entry    # 用 vite SSR 把真实 App 树渲染一遍，验证首屏落点 / 渲染结果（当前 48 项）
npx tsx scripts/check-xxx.ts   # 单个纯逻辑自检（无需构建）
node .mcp-work/verify-xxx.mjs  # 单个真机验证（无头 Chrome，需要 dev server 在跑）
npm run deploy         # 构建并上传（生产发布请让用户确认）
./deploy.sh <test|pre|prod>    # 部署脚本，需要 VPN：先 source vpn.sh
```

## 3. 工程约定

- **每个功能都带自检**，三层：
  1. 纯逻辑抽到不依赖 DOM / `import.meta.env` 的模块（否则 `npx tsx scripts/…` 会崩），配 `scripts/check-*.ts`（当前 20 个）；
  2. 涉及真实组件渲染/落点的，加 `scripts/check-copreg-entry.tsx` 的断言（`npm run check:entry`）；
  3. 涉及真实浏览器行为（点击、渲染像素、localStorage 串场）的，写 `.mcp-work/verify-*.mjs`（无头 Chrome + 独立 browser context；当前 28 个，**目录被 gitignore**）。
- **改文案/价目/超时这类"口径"必须同步改断言**：如 `check-price-table.ts`、`check-plan-timeout.ts`、`check-address-nature-hints.ts`、`.mcp-work/verify-price-table.mjs`。
- **提交前跑全套**：`npm run lint` → `npm run build` → `npm run check:entry` → 所有 `npx tsx scripts/check-*.ts` → 受影响的 `.mcp-work/verify-*.mjs`（全跑一遍也就几分钟）。
- **`git-change.md` 是追加式变更记录**（`## [开发中]` 下最新一条在最上面），每次改动补一条：改了什么、为什么、断言数变化、文档更新。
- **`docs/` 是实现说明**：`copreg-steps.md`（六步与 hash）、`copreg-plan-api.md`（诊断/确认接口 + 方案存档 + 表价）、`copreg-registration-fields.md`（第 5 步字段与校验）、`copreg-multi-app.md`（多主体）。改了行为就同步。
- **tsconfig 没开 `strict` / `strictNullChecks`**：字面量布尔判别必须写 `x.ok === false`，写 `!x.ok` 不会收窄类型。
- 中文 UI 文案、中文注释；注释写"为什么"，不写"做了什么"。
- 截图存证脚本放在 `.mcp-work/shot-*.mjs`（如 `shot-tier-cards.mjs` → `.mcp-work/tier-cards.png`），改版式后直接看图核对。

## 4. 用户偏好

- 大范围迁移/改动前**先确认范围**（对齐设计稿的改动尤其如此）。
- 视觉/文案以设计稿为准；**产品逻辑**以本项目的产品决策为准（见 §1.2）。
- 交付物 = 本项目代码 + 校验脚本 + 文档 + `git-change.md`；设计稿仓库不动。
