# 变更记录

> 下次发布后清空此文件

## [开发中]

### 企业方案页
- 新增 第 5 步「企业注册申报资料填报与初审」，办理流程由五步变为六步，办理进度顺延为第 6 步
- 调整 原独立注册页的内容按 Section 重写并并入本页，不再有 registration.html 单页入口
- 新增 确认凭据：确认接口返回的单据号与状态，外加确认时那套档位与自选项，仅在服务端返回成功状态后写入
- 新增 首屏落点按凭据决定：凭据有效直落第 3 步协议确认与支付，凭据缺失或过期退回第 2 步，什么都没存则回第 1 步
- 新增 凭据过期判定：档位或自选项与当前方案不符即作废；只比较凭据里记过的字段，手写与老版本凭据不会被误判
- 调整 自选项比较按集合看，勾选先后与报价明细顺序不同不算改过
- 调整 档位与自选项取自实际发出的请求体而非页面状态，存下的凭据不会与请求张冠李戴
- 调整 问卷重置时凭据随问卷与方案存档一并作废
- 新增 RegistrationDetailsStep 与 copreg/registration 下的各 Section 组件
- 修复 开发期 StrictMode 下「已支付」永远不生效：核实 effect 的「查过就记」闸门在第一轮（被清理丢弃的那轮）就写上了，第二轮直接不再查 —— 服务端说已支付、界面却一直停在待支付。改为 orderStatusCheck.ts 的单飞闸门：同一单据号复用同一个请求，结果落地后才记账
- 新增 scripts/check-order-status-check.ts（13 项）覆盖单飞语义与 StrictMode 时序；真机用 MCP 验证支付成功界面与三个回填字段
- 修复 异步查回「订单已支付」后只解锁服务群、不推进落点，导致首帧落在第 2 步的人一直停在第 2 步：新增 advanceOnPaid，用户没自己走动过就补到支付成功界面
- 调整 已支付的落点由「第 4 步服务群」改为第 3 步的支付成功界面（hash `#paid`），服务群仍然解锁可直达
- 新增 DEV 下的首屏落点日志（hash / 三条证据 / 解锁范围 / 落点），生产构建不含
- 修复 刷新落点只看前面的步骤：申报资料已提交的人刷新会被送回支付页。落点改为从后往前判断进度证据（申报已提交 > 订单已支付 > 确认过方案 > 填过问卷），已提交时六步全解锁
- 修复 第 5 步读草稿只检查 basic/people 存在，残缺或旧版本草稿会在校验里 .trim() 崩掉整页；改为「空骨架 + 存档覆盖」合并，缺字段回落默认值
- 新增 progressRouteOf 纯函数与 20 项落点断言，并在 npm run check:entry 里补三个刷新落点回归场景（含「申报已提交 + 有凭据 → 第 6 步」）
- 修复 已支付订单在本地凭据丢失后又被下单、被服务端以「当前订单已完成支付，或请联系客服」拒绝的问题：进页面拿到确认单据号就先核实一次订单状态（已支付直接进「支付成功」），下单被拒时也补查一次状态自愈
- 修复 服务端用 reasons[] 信封表达业务失败（该场景实际是 **HTTP 400**）时前端只报「服务返回 400」：HTTP 失败分支与解析器都会把服务端那句话透给用户，且 400 失败同样走「补查状态→已支付则自愈」
- 新增 paidSnapshotOf / serverMessageOf 两个纯函数，并补 20 余项断言覆盖错误信封、自愈判断与非 2xx 原因透出
- 调整 第 5 步「企业注册申报资料填报」的初始数据改为**从前两步真实转换**（新增 registrationSeed.ts）：企业描述/主营/经营范围/注册资本/名称建议/组织形式/股东行数/推荐地址开关/经办手机号来自问卷与方案；姓名、证件号、股比、附件、人员、各类勾选一律留空
- 删除 写死的示例表单工厂（假企业描述、假姓名、假身份证号、假委托书 PDF、假股东人员）与其引用；帮助弹窗的「载入合规示例数据」改为「按方案重新填充」
- 修复 第 5 步空值渲染回落到示例数据：委托书模板不再用示例姓名/证件号兜底（改下划线占位）、复核摘要与验证弹窗不再预置示例手机号、基本信息展示区空值改为「尚未填写」
- 新增 scripts/check-registration-seed.ts（50 项）覆盖转换规则与「没有来源必须留空」；新增 scripts/check-no-fake-demo-data.ts 扫源码禁止示例数据回流
- 新增 npm run check:entry 里第 5 步的内容断言：渲染出问卷里的企业描述与经营范围，且不含旧示例数据
- 调整 客服码弹窗与顾问卡片去掉写死的顾问姓名与工号（李经理 / 资深设立顾问 / 工号 BB-8029）：顾问可能是不同的人，前端无从确定，统一改为中性称呼
- 新增 「微信扫码咨询」弹窗改为先查询再判断后显示：`{DOC_HOST}/xcx/yqt-co/user/{shareUserUuid}/get` 取分享人专属企微码，取不到回落 www 通用兜底图；查询期间显示加载态
- 新增 该逻辑抽成 utils/customerServiceQr.ts（纯判断）+ hooks/useCustomerServiceQr.ts（请求），第 3 步、填报页与落地页提交成功弹窗三处共用一份实现
- 新增 scripts/check-customer-service-qr.ts 自检脚本（20 项）：地址拼接与转义、八种拿不到的情况都必须回落兜底图
- 调整 两处 copreg 弹窗里原来的假二维码占位（lucide 图标）换成真实企微码图片
- 修复 重新进入页面时已支付界面的「经办联系电话」是空的：手机号按约定不落本地，改由查单响应带回的 mobile 回填（订单号 / 支付时间同源）
- 调整 已支付界面的空字段统一显示破折号，与信息确认页的空值口径一致
- 修复 第 3 步漏传确认单据号（busUnionId 传给了已废弃、无入口的 agreement 渲染点），导致点「立即支付」报「缺少确认单据号」
- 调整 缺少确认单据号时在支付方式区上方常显提示，而不是只在点击后弹一句 toast；并在 npm run check:entry 里加断言守住这个渲染点
- 新增 第 3 步收银台接真实开户支付：POST {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/pay（{ payAmount, busUnionId }）→ 用返回的 codeURL 现渲染二维码 → 按 busUnionId 轮询查单，status='1' 才落「已支付」
- 新增 查单接口 GET {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/query/pay?busUnionId=…，收银台轮询与 #paid 直达判断共用；返回值 orderNo / payTime 直接用于支付成功界面
- 删除 收银台里「演示用·确认支付」按钮：不付款也能标成已支付是假的终态
- 调整 支付模块契约由原先假设的微信 Native（bizType/bizId + tradeState）换成真实开户支付（payAmount/busUnionId + status '1'/'0'），下单只承诺 codeURL（订单号以查单返回的 orderNo 为准）
- 调整 查单失败不再抛异常：路径未配 / 超时 / 网络不通 / 缺 status 一律回 unknown，只读预判不拦人；未知 status 只 warn 且仍当未支付
- 调整 金额由前端传（= 页面实付金额），服务端必须按 busUnionId 复核价格，已在代码注释里写明这条资损风险

### 售前咨询页
- 修复 客服二维码兜底图由根相对路径改为绝对地址，页面被部署到子路径或别的域名下打开时不再失效
- 新增 兜底图来源注释，说明接口取不到专属企微码时会回落到该图，不会把二维码留成空白

### 文档
- 更新 docs/copreg-plan-api.md 与 docs/copreg-registration-fields.md，反映并入后的流程与字段

- 新增 stepRoute.ts：六个步骤各有一个 URL hash（#survey / #proposal / #payment / #group / #fill-details / #progress），刷新、收藏、转发与浏览器前进后退都能回到同一步
- 新增 hash 只是请求：没解锁的步骤（没确认就想进支付页、没支付就想进服务群）收口回实际能到的那一步，并把地址栏改写成真实步骤
- 新增 hash 解析容错：#/payment、#Payment、#fill_details 都认，认不出的按「没给 hash」处理
- 新增 docs/copreg-steps.md 记录步骤、hash 与首屏落点规则
- 新增 scripts/check-step-route.ts 自检脚本（28 项），并在 npm run check:entry 里补 10 项 hash 落点断言
- 新增 已支付界面自己的 hash `#paid`：支付成功时地址栏跟着变，刷新/换人打开时先拿确认单据号向服务端核实，确认已支付才进该界面
- 新增 paymentStatus.ts：`#paid` 的直达判断复用支付模块的查单接口（queryOrder + mapOpenAccState），凭确认单据号（busUnionId）查，三态（已支付 / 未支付 / 查不动）；查不动、缺 status、或路径未配一律收口回 #payment，认不出的响应绝不当已支付
- 新增 scripts/check-payment-status.ts 自检脚本（22 项）：哪些响应算已支付、哪些算未支付、哪些一律 unknown，以及失败不抛异常、未知状态只 warn
- 新增 docs/copreg-steps.md 记录 #paid 的核实规则，check-step-route 与 check:entry 各补若干断言
### 校验脚本
- 新增 npm run check:entry，用 vite SSR 把真实的 App 组件树在 Node 里渲染一次，只替换本地存档来验证首屏落点
- 新增 scripts/check-copreg-entry.tsx，11 项断言覆盖凭据有效、凭据过期、凭据与存档不配套、老存档等落点
- 调整 scripts/check-service-confirm.ts 断言数由 80 增至 121
- 调整 scripts/check-wechat-pay.ts 断言数由 131 增至 160，覆盖真实开户支付的下单、查单、自愈与错误信封
- 删除 scripts/check-registration-schema.ts，随注册页一并并入

### 配置
- 调整 vite.config.ts 移除 registration 入口
- 新增 package.json 的 check:entry 脚本
- 更新 .gitignore 忽略 .mcp-work/
- 删除 src/assets/customer-service-qr.png，该文件从未被任何代码引用
