# copreg 流程与 URL 路由

copreg.html 是一个六步向导，每一步有独立的 URL hash：刷新、收藏、转发都能回到同一步，
浏览器前进/后退也能按步走。步骤映射写在 `src/copreg/stepRoute.ts`。

| # | 内部步骤名 | URL | 渲染组件 | 什么时候解锁 |
|---|---|---|---|---|
| 1 | `survey` | `#survey` | `components/SurveyStep.tsx` | 始终 |
| 2 | `proposal` | `#proposal` | `components/ProposalStep.tsx` | 始终（有问题案可回看） |
| 3 | `payment` | `#payment` | `components/AgreementAndPaymentStep.tsx` | 确认接口返回 SUCCESS 并落本地凭据后 |
| 4 | `group` | `#group` | `components/ServiceGroupStep.tsx` | 支付成功后 |
| 5 | `fill_details` | `#fill-details` | `components/RegistrationDetailsStep.tsx` | 支付成功后（`#paid` 的「申报资料填报」，或服务群页里的入口） |
| 6 | `progress` | `#progress` | `components/ProgressAndReviewStep.tsx` | 填报之后 |

`agreement` 是已废弃的步骤（协议确认并进了支付），没有任何入口，它的 hash 也归到 `#payment`。

第 3 步内部有**两个界面**：待支付与支付成功。它们各自一个 hash：

| 界面 | URL | 判据 |
|---|---|---|
| 待支付（协议 + 立即支付） | `#payment` | `order.status !== 'paid'` |
| 支付成功（委托代办已生效） | `#paid` | `order.status === 'paid'` 且已核实 |

支付成功界面「服务进度状态与办理清单」里第一项（申报资料填报）的主按钮是**「申报资料填报」**，
直接进第 5 步；第 4 步服务群仍然解锁、导航里可直达，但不再是这一页的下一步
（与 copreg 主线一致：付完款该做的是填申报资料）。

已支付界面上「订单编号 / 经办联系电话 / 支付时间」三格的数据来源是**查单响应**
（`orderNo` / `mobile` / `payTime`）；`经办人姓名` 目前没有任何地方采集，空着时显示破折号。

## 刷新落在哪一步：从后往前看进度证据

刷新时先算「**最远做到哪一步**」，判断顺序是**从后往前**（后面的证据优先）——

| 已知证据 | 最远步骤 | 解锁范围 |
|---|---|---|
| 第 5 步申报资料已提交（草稿 `status === 'submitted'`） | 第 6 步 办理进度 | 六步全解锁 |
| 订单已支付（异步查单确认；首帧不知道） | 第 3 步的**支付成功界面**（hash `#paid`） | 到第 4 步（服务群可直达但不默认跳） |
| 有确认凭据 | 第 3 步 协议与支付 | 到第 3 步 |
| 有问卷存档 | 第 2 步 方案与报价 | 到第 2 步 |
| 什么都没有 | 第 1 步 业务信息调研 | 至少到第 2 步（方案页随时可点） |

> 这里的顺序曾经写错：只看「有确认凭据 → 第 3 步」，于是**申报资料都填完了的人一刷新
> 又被送回支付页**。`progressRouteOf()` 现在按上表从后往前判断，`isDetailsSubmitted` 在首帧
> 就读出来参与判断。

> 这个核实走 `orderStatusCheck.ts` 的单飞闸门（同一单据号只请求一次）。**不要**把它简化回
> 「查过就记一个 ref」：dev 的 StrictMode 会「挂载 → 清理 → 再挂载」，第一轮结果被丢弃，
> 闸门若在那时就记账，第二轮不会再查 —— 已支付就永远不生效（真机上踩过）。

**已支付是异步才知道的，所以落点会补一次**：首帧只能按本地证据算（可能先落在第 2 步），
查单回来说已支付时，如果用户**还停在首帧那一步**（没自己走动过），就把落点补到支付成功界面
（`advanceOnPaid`）；他自己走开过就不动他 —— 他可能是特意回来看方案的。

> 首帧落点决策在 DEV 下会打一条 `[copreg] 首屏落点` 日志（hash / 有无问卷存档 / 有无确认凭据 /
> 申报是否已提交 / 解锁范围 / 落点）。本地凭据缺失或过期导致落点偏早时，看这一行就知道卡在哪条证据上。
> 生产构建里这条日志会被折叠掉。

## hash 只是请求，不是命令

地址栏里写 `#payment` 不等于能进支付页。`resolveStep`（纯函数，有自检）按这个顺序收口：

1. 请求的步骤**已解锁** → 用它；
2. 没解锁 / hash 认不出 / 压根没写 → 用上表算出来的**最远步骤**；
3. 并把地址栏**改写成真实步骤**（首帧用 `history.replaceState`，不新增历史条目）——
   地址栏与页面必须说的是同一件事，否则复制出去的链接会把别人带到一份空壳页面。

于是：没有确认凭据时 `#payment` 会停在第 2 步并把地址栏改成 `#proposal`；
`#group` / `#progress` 在没支付时同理回退。

## 解析容错

`#/payment`、`#Payment`、`#fill_details`（内部名下划线写法）都认；认不出的值（`#nonsense`、`#3`）
按「没给 hash」处理，不报错也不停空白页。步骤切换时每步压一条历史，后退即回上一步。

## 「微信扫码咨询」弹窗（三处共用）

第 3 步的按钮、填报页的同一个弹窗、落地页提交成功后的客服码弹窗，走的是**同一份实现**
（`src/utils/customerServiceQr.ts` 判断 + `src/hooks/useCustomerServiceQr.ts` 请求）：

1. **先查询**：弹窗打开时才去问服务端，地址 `{DOC_HOST}/xcx/yqt-co/user/{shareUserUuid}/get`
   （分享人来自 URL 的 `?shareUserUuid=`）；查询期间显示「正在获取专属顾问二维码…」，
   不会先闪一张兜底图再换成专属码。
2. **再判断**：响应里有 `perShareEwmFile` → 用 `{DOC_HOST}/doc/uuid/{file}/get` 上的专属企微码；
   没有 / 不是字符串 / 超时 / 网络不通 / 没分享人 → 一律回落
   `https://www.ibanbu.com/image-yqt/customer-service-qr.png`（通用兜底图，绝对地址，换域名也不 404）。
3. **后显示**：`<img>` 永远拿到一个可用地址，不会出现裂图或空二维码。

自检：`npx tsx scripts/check-customer-service-qr.ts`（20 项，覆盖地址拼接、转义、
以及八种「拿不到」都必须回落兜底图）。

## `#paid` 比别的 hash 更严格

别的 hash 只表达「想去哪一步」，`#paid` 表达的是**事实**（已经付过款）。支付状态是服务端
说了算的，前端没有凭据，所以：

1. 地址栏是 `#paid` 时，首帧拿 `1b_copreg_plan_confirm` 的 `recordId` 调**查单接口**
   （`GET {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/query/pay?busUnionId=…`，
   即 `src/payment/client.ts` 的 `queryOrder` + `src/copreg/paymentStatus.ts`），
   状态判定复用 `mapOpenAccState`；
2. 只有查单返回 `status='1'` 才进「支付成功」界面，并把服务端给的 `orderNo` 显示为订单编号、
   `payTime` 作为支付时间、`mobile` 补上「经办联系电话」，同时解锁第 4 步。
   这三项都只能从查单拿：**手机号按约定不落本地**（第 2 步验证完只在内存里），
   订单号与支付时间也只有服务端知道 —— 少了这一步，重新进入页面时那几格就是空的；
3. 其余一律当没付：`status='0'`、不认识的 status、响应缺 status、超时、网络不通、路径还没配
   → 地址栏收口回 `#payment`，用户停在待支付页照常付款。**认不出的响应绝不当已支付** ——
   宁可让人多点一次「立即支付」，也不能造出一个看着像已支付的界面；
4. 会话内手敲 `#paid` 而本地并没有确认过已支付 → 直接改回 `#payment`（下次刷新时首帧核实
   会再给一次机会）。

## 订单状态核实与「已经付过了」的自愈

本地存的凭据可能被清掉（换浏览器、隐私模式、手删 localStorage），而订单状态只有服务端知道。
所以：

1. **进页面时**：只要有确认单据号、且还不知道已支付，就先查一次订单状态（`queryOrder`）；
   服务端说 `status='1'` 就直接进「支付成功」并把单号 / 支付时间 / 手机号补上 —— 否则用户会被
   留在「待支付」页，一点「立即支付」就会被服务端拒。
2. **下单被拒时**：先补查一次状态。订单其实早已支付 → 直接按已支付处理（自愈）；
   确实没付 → 把服务端给的原因原样告诉用户。
3. **服务端的业务失败**：同一套 `reasons[]` 信封既可能出现在 200（前端解析器识别），
   也可能直接是 **HTTP 400**（HTTP 分支读响应体识别）——两条路都会把这句 `message`
   透出来给用户看，不再笼统报「返回 400 / 返回格式不正确」。

## 收银台（第 3 步的「立即支付」）## 收银台（第 3 步的「立即支付」）

点击「立即支付」→ `POST {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/pay`，body 只有两个字段：
`{ payAmount: 页面上的实付金额（元）, busUnionId: 确认单据号 }`，响应里的 `codeURL` 就是
微信 Native 的 `code_url` 文本，前端自己渲染成二维码（`src/payment/PayQrCode.tsx`，不依赖
后端出图）。之后按 `busUnionId` 轮询查单，`status='1'` 才落「已支付」。

几点是刻意的：

- **没有「演示完成支付」按钮**：不付款就标成已支付是假的终态，接了真实接口就不能再留。
- **一次点击只发一次下单**：服务端没有去重键，重复下单会真的产生两个订单；过期换码走
  「重新出码」（同样是显式点击）。
- **查单网络抖动不卸载二维码**：只提示「查询暂时不通，二维码仍可继续扫」，否则用户正扫着码
  界面就白了。
- 金额是前端传的，**服务端必须按 `busUnionId` 复核价格**（见 `payment/client.ts` 的注释）。

核实期间地址栏先不动（否则会 `#paid` → `#payment` → `#paid` 白闪两下）。

自检：`npx tsx scripts/check-step-route.ts`（映射与收口规则，35 项）、
`npx tsx scripts/check-payment-status.ts`（哪些 tradeState 算已支付、哪些一律查不动，24 项）、
`npm run check:entry`（真实组件树渲染首屏，24 项）。
