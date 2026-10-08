# 服务人员查看客户申报资料（`copreg-view.html`）

客户在第 5 步 `#fill-details` 填的申报资料，服务人员要能看到。这一页就是那个入口：
**带开户单编号（`scbUuid`）打开，只读地把客户提交的那几个对象渲染出来**。

```
https://www.ibanbu.com/OneBiz/copreg-view.html?scbUuid=<开户单编号>&code=<查看码>
```

它是**独立的一页**，不是 `copreg.html` 的一个模式：客户主流程整页有本地存档、有六步状态机、
有支付与查单，服务人员的浏览器里这些东西一份都没有 —— 混在一起只会多出一堆「没有存档时怎么办」
的分支，还容易把客户的申请写进服务人员的浏览器。所以 `vite.config.ts` 里多了一个入口
（`copregView: 'copreg-view.html'`），产物是独立 chunk（≈10 KB，不含客户向导）。

---

## 一、数据从哪来

| 环节 | 接口 / 位置 |
|---|---|
| 客户提交 | `POST {DOC_HOST}/xcx/yqt-co/subscribe/open-info`，body `{ busUnionId, var2, savaType }`（`savaType` 是后端 DTO 的原始拼写），`var2` 就是本地存档那份 JSON 的字符串；key 是**委托单号** `busUnionId`（第 1 步诊断接口给的 `recordId`）。见 `src/copreg/registration/openInfo.ts` |
| 服务端存 | 挂在开户单的 **`openAccApply.var2`** 上（真机响应实测；同一张单上还有 `var1` 与 `qyfwwtd` / `qyzcfwwtd` / `lsbfwwts` 几个兄弟字段，分别是别的委托单） |
| 服务人员查看 | `GET {DOC_HOST}/xcx/yqt-co/subscribe/{scbUuid}[?code={查看码}]` —— 按**开户单 uuid** 读回整份开户单详情，从 `openAccApply.var2` 取申报表 |

**为什么读的键是 `scbUuid` 而不是 `busUnionId`**：服务人员手上只有开户单编号（ISP 开户详情页、
后台列表里都是它）；`busUnionId`（一企通执行方案号）在响应里也给，所以页面上把它一并显示出来，
方便和后台对单。客户侧的 `scbUuid` 只在**查单响应**里露过一次（用来判断「记录被后台删了」），
前端不落盘，所以这条读链路只能由服务人员这一侧发起。

**地址与凭据口径照 www 站的 `static/js/page-display.js`**（`www.ibanbu.com_V3/static/js/page-display.js`，
那批「code 版」静态页共用它）：

- host 就是它的 `API_HOST` —— 也就是本项目的 `DOC_HOST`（开发 `http://testv3001.yowits.net/v1`、
  生产 `https://yqt.ibanbu.com/v1`，都自带 `/v1`）；
- 路径前缀就是各页面传给 `fetchSubscribeData` 的 basePath，默认 `/xcx/yqt-co/subscribe/`
  （可用 `VITE_SUBSCRIBE_QUERY_PATH` 覆盖，见 `src/config/api.ts`）；
- 带 `code` 时服务端校验查询码，**不通过是 HTTP 400 + `{"reasons":[{"message":"查询码无效或已过期"}]}`**
  （真机实测），所以这条链路必须走 `utils/serverError.ts` 把服务端那句人话透出来；
- **不带 `code` 服务端也可能放行**（测试环境实测 200），所以前端不自己编「没码就不给看」的规则。
  真正的看门人是服务端。**入口那一侧一律带 `code`**（见第七节：ISP 的按钮现调
  `generate-code`），所以正常链路总是带查询码；被拒时页面会额外提示回开户详情页重新点一次。

参数名两个都认：`scbUuid`（本项目与接口文档的叫法）与 `uuid`（page-display 那批页面的写法），
指向同一个值。带 `code` 时链接被拒，页面会额外提示「查看码一次有效，请回开户详情页重新点一次
『查看申报资料』」（查询码是一次性的，见下一节）。

---

## 二、查询码是一次性的 —— 一次打开只查一次，刷新靠会话内快照

`generate-code` 给出的**查询码用掉即失效**。这一页因此有两道保险：

**① 单次闸门**（`src/copreg/registration/onceGate.ts`，与 `orderStatusCheck.ts` 的单飞闸门
同一套路，另给一个 `reset` 供「重新读取」用）：dev 的 React StrictMode 会「挂载 → 清理 → 再挂载」，
effect 跑两遍 —— 没闸门时第二遍会真再打一次接口，服务端回「查询码无效或已过期」。
闸门是模块级的，key = `开户单编号 + 查看码`，同 key 在途 / 已出结果都复用同一个 promise。

**② 会话内快照**（`src/copreg/registration/snapshotStore.ts`）：刷新会让整页重新加载、
闸门也是新的 —— 同一条链接的第二次打开只能靠本地那份快照兜住。读成功时把**接口原样响应**
按同一个 key 存进 `sessionStorage`（`1b_copreg_service_view`，最多留最近 5 条）；刷新时先查它，
**命中就直接渲染、一个请求都不发**，并在概览上写明「本页是 ⋯ 读取的**会话内快照**：
刷新不会重新读取」。

- 快照的 key 含查看码：**换了一条新链接（新码）不会命中旧快照**，照常去读最新内容；
- 只写 `sessionStorage`（随标签页关闭消失），`localStorage` 一个键都不写 —— 客户数据不该落在
  服务人员浏览器的长期存储里；
- 命中快照时页面上会说清这一趟没有重新读，并提示「要看最新内容，请回开户详情页重新点一次
  『查看申报资料』」；
- **真机脚本盯死这两条**：每个场景都断言读接口**恰好打了一次**（不是「至少一次」）；
  `refresh` 场景真按一次浏览器刷新，断言累计调用数仍是 1、内容照旧、且 localStorage 仍为 0。

> 「重新读取」按钮只在**读取失败**时出现（失败时没有快照）：网络压根没打到服务端时，
> 同一枚码还能用；服务端已经说码失效时，重试也没用 —— 那就回开户详情页再拿一条新链接。

> 想让这一页能**转发给别人**（换浏览器也能看），仍然得让服务端把查看码放宽
> （例如有效期内可重复查看）—— 前端这边不用改。

---

## 三、页面行为（六条边界）

1. **只读**：没有保存 / 提交 / 修改按钮，附件只能预览与在新窗口打开；两个确认勾选
   （免申报承诺 / 信息真实性）置灰不可改。
2. **不碰 localStorage**：不读主体列表、不写草稿、不落步骤 —— 真机脚本专门断言
   「localStorage 一个键都没写」（`★` 那条）。**唯一的例外是 `sessionStorage` 里那份快照**
   （见上一节）：随标签页关闭消失，只为「刷新还能看」存在。
3. **不参与客户流程的步骤路由**：没有 hash、不查单、不解锁步骤，地址栏参数只用来发一次读请求，
   地址栏也不会被改写。
4. **草稿也显示，但标出来**：`var2.status !== 'submitted'` 时概览上是「**草稿（客户尚未确认提交）**」，
   已提交才是「已确认提交」。客户点过「保存草稿」服务端就有 `var2`，服务人员分得清这两件事。
5. **失败都有人话**：查询码失效 / 超时 / 网络不通 / 空体 / 非 JSON / 记录里还没有 `var2` /
   `var2` 不是申报表 —— 各有各的文案与「重新读取」按钮（见 `scripts/check-service-view.ts` 的 66 项）。
6. **一次打开只查一次、刷新不再请求**：见上一节（查询码一次性 + 单次闸门 + 会话内快照）。

---

## 四、渲染什么

正文直接复用客户第 5 步「**05 确认提交**」那一章的 `ReviewSection`（加 `readOnly`）：

| 区块 | 内容 |
|---|---|
| 1. 企业基本信息 | 名称（按优选顺序）/ 组织形式 / 注册资本 / 主营与简介 / 经营范围 / 注册地址 / 实际经营地址 / 董事监事设置 |
| 2. 股东及出资结构 | 每位股东：类型、姓名或企业名、股比、出资额、出资形式、附件 |
| 3. 企业主要管理人员 | 角色标签、电话 / 邮箱 / 居住地址、附件 |
| 4. 法定代表人委托书签署 | 受托人姓名 / 身份证号、委托书附件 |
| 免申报受益所有人承诺 | 勾选态（只读） |
| 信息真实性确认 | 勾选态（只读） |
| **5. 地址性质与场地证明**（本项目新增） | 注册 / 实际经营地址的**性质**与场地证明附件 —— 「05 确认提交」那一章没有这两项，但它们在 `var2` 里，办工商申报要看，所以补一块 |

`readOnly` 时**整条客户报喜横幅不渲染**（「初审通过 · 资料已移交政务交付团队」是给客户的进展话术，
没有数据支撑，服务人员不该把它当状态读）；概览卡上的「已确认提交 / 草稿」才是这一页的事实。

页头与概览给四个定位信息：开户单编号（`scbUuid`）、一企通方案号（`busUnionId`）、提交时间、
经办手机号（后两个来自 `var2` 的 `submittedAt` / `submissionPhone`）。

**`var2` 里有、但没有展开的两项**：`setup`（设立信息：成立方式 / 期限 / 人数）与
`confirm.beneficiary`（受益所有人信息）。它们在客户页面（`#fill-details` 五个章节）从来
没有渲染位，是结构默认值 / 历史字段；查看页照「客户填了什么就显示什么」的口径，不凭空展开。
要展示时在这里加一块就行，数据已经在表单对象上。

---

## 五、代码位置

| 文件 | 干什么 |
|---|---|
| `copreg-view.html` | 独立入口页（title「客户申报资料 · 服务人员查看」） |
| `src/copregView.tsx` | 入口：只渲染 `ServiceRecordView`，读 `window.location.search` |
| `src/copreg/components/ServiceRecordView.tsx` | 页面本体：请求 → 概览 + 只读正文；`ServiceRecordContent` 是纯展示部分（SSR 自检直接渲染它） |
| `src/copreg/serviceView.ts` | 纯逻辑：`serviceViewQueryOf`（参数）、`serviceFormOf`（从响应里取申报表） |
| `src/copreg/registration/subscribeQuery.ts` | 读接口：URL 组装 + 超时 + 错误文案收口 |
| `src/copreg/registration/onceGate.ts` | 单次闸门：同一枚一次性查询码只打一次接口（`reset` 供「重新读取」） |
| `src/copreg/registration/snapshotStore.ts` | 会话内快照（sessionStorage）：刷新直接渲染快照、不再请求（key 含查看码，最多留 5 条） |
| `src/copreg/registration/formSnapshot.ts` | 申报表快照收口（空骨架打底 + 缺字段补默认值 + 附件过滤），**填报页读草稿与查看页读 `var2` 共用同一份** |
| `src/copreg/registration/ReviewSection.tsx` | 加 `readOnly`（隐「修改」与报喜横幅、勾选置灰） |
| `src/config/api.ts` | `SUBSCRIBE_QUERY_PATH`（默认 `/xcx/yqt-co/subscribe/`） |

---

## 六、自检

| 层 | 脚本 | 覆盖 |
|---|---|---|
| 纯逻辑 | `npx tsx scripts/check-service-view.ts`（**66 项**） | 参数解析（`scbUuid` / `uuid` / 空值 / 畸形串）、URL 组装（编码、尾斜杠、空 code）、`serviceFormOf` 取值（字符串 / 对象 / 缺 var2 / 坏 JSON / 不是申报表 / 缺字段补默认值 / 无 `fileUuid` 的旧附件丢掉）、七种失败文案 + 「路径没配 / 没编号不发请求」、**单次闸门**（同 key 只跑一次 / 换 key 重跑 / reset 重跑 / 在途并发复用 / 失败也记住 / key 不串号）、**会话内快照**（坏 JSON 当空表 / 形状不对丢掉 / 换码不命中 / 同 key 覆盖 / 只留最近 5 条） |
| 渲染 | `npm run check:entry`（**75 项**，新增 13 条） | 客户页 `copreg.html` **不认** `?scbUuid=`；查看页带参数落只读视图（「正在读取」）、没参数提示「链接不完整」；正文四块 + 真实性确认 + 客户填的值 + 地址卡 + 读取时间；只读时无「修改」、勾选不可改；草稿标注；命中快照时出「会话内快照 · 刷新不会重新读取」提示（正常读取时**不**出现）；非只读的 `ReviewSection` 仍是原来那套（回归） |
| 真机 | `node .mcp-work/verify-service-view.mjs`（**6 个场景 62 项**） | `ok` / `draft` / `badcode`（400 + reasons）/ `norecord`（没有 var2）/ `nolink`（不带 scbUuid）/ **`refresh`**（真按一次浏览器刷新）。断言**读接口恰好只打一次**（查询码一次性，StrictMode 下也是；刷新后仍只有 1 次）、请求地址与查询码、快照写进 sessionStorage、页面内容、**localStorage 一个键都没写**、地址栏 hash 不动、没有混进客户向导。`SHOT=1` 顺带存 `.mcp-work/service-view.png` |

```bash
npx tsx scripts/check-service-view.ts
npm run check:entry
node .mcp-work/verify-service-view.mjs                      # 需要 dev server 在 5173
SCENARIO=badcode node .mcp-work/verify-service-view.mjs
SCENARIO=refresh node .mcp-work/verify-service-view.mjs     # 刷新：累计仍只打一次接口
SHOT=1 node .mcp-work/verify-service-view.mjs               # 出截图核对版式
```

---

## 七、服务人员从哪进（ISP 已接入）

入口放在 **ISP 开户详情页的「班步一企通」模块**里，与「查看执行方案」并排：

- 模板：`isp.ibanbu.com_V3/src/page/thirdparty/openAccount/detail.vue`，
  `busUnionType == 1`（从官网一企通流程进来）那个 `<el-form>` 里新增一项
  **「客户申报资料 / 查看申报资料」**（`@click="viewCopreg"`）；
- 方法：`viewCopreg()` —— 凭据与旁边那几颗「编辑和分享」（`viewAndShare`）**同一套**：

```js
viewCopreg () {
  axios.post(`/xcx/yqt-co/subscribe/generate-code`)      // 现生成查询码
    .then((data) => {
      this.$windowOpen(`${this.$env.WWW_HOST}/OneBiz/copreg-view.html?scbUuid=${this.detail.uuid}&code=${data.code}`)
    })
    .catch((err) => this.$showErrorMessage(err))
}
```

**一律带 `code`**（不做「有没有 code」的区分）：`generate-code` 每次给一个新查询码，页面照它校验。
`WWW_HOST` 生产是 `https://www.ibanbu.com`（测试/预发按该仓库惯例指本地 www），
所以实际打开的是 `https://www.ibanbu.com/OneBiz/copreg-view.html?scbUuid=<开户单 uuid>&code=<查询码>`。

参考的同款先例是同文件里的「查看执行方案」：`window.open(WWW_HOST + '/CAA/result.html?uuid=' + busUnionId)`。
