# 变更记录

> 下次发布后清空此文件

## [开发中]

### 第 5 步 · 地址性质下架「集中办公/众创空间」与「园区孵化器」两档
- 调整 用户要求：两个地址的性质里删掉 `集中办公/众创空间` 与 `园区孵化器`，只剩
  **租赁用房 / 自有房产 / 无偿使用证明** 三项（两个地址仍是同一套，共用 `ADDRESS_NATURES`）
- 调整 `addressNatureHints.ts`：选项表、`FILL_RULE` / `MATERIALS` / `MISSING` 三类文案表、
  `REG_HINTS` / `WORK_HINTS` 全部只留三档；`normalizeWorkAddressNature` 改名
  **`normalizeAddressNature`**（两个地址同一套收口，旧的函数名保留为别名），
  老值只同义平移两条（商业租赁 → 租赁用房、自有产权 → 自有房产），
  **已下架的档（联合办公·众创工位 / 集中办公·众创空间 / 园区孵化器 / 居家办公申报）一律清空让用户重选**
- 调整 `formSnapshot`：以前只收口实际经营那一边，现在**注册地址也一起收口**（老存档选中已下架档同样清空）
- 更新 `scripts/check-address-nature-hints.ts`（69 → **59 项**）：选项表 3 项、条数与关键词表去掉两档、
  「已下架档回落通用文案且材料清单为空」、老值平移只剩两条 + 四个已下架档清空、复制恒等只剩 3 档
- 更新 `scripts/check-copreg-entry.tsx`（**78 项**）：渲染断言改成「只剩 3 项」，并修掉两条因为
  两个地址共用同一句占位、以及 SSR 会插 `<!-- -->` 而失效的写法（改用各档专属的**材料条目**当证据）
- 更新脚本：`.mcp-work/verify-address-nature-hints.mjs`（用例表 3 项、复制哨兵换成「自有房产」）、
  `.mcp-work/shot-address-hints.mjs`（第二张图改成「自有房产 + 租赁用房」）；已重新出图核对
  （两栏都只剩三个按钮、材料清单跟着换）
- 修复 **我自己造成的一次文档事故**：上一轮改经办人接口时，脚本里一句多余的
  `open('docs/copreg-registration-fields.md','w')`（只有 open、没有 write）把这份 306 行的文档**截成了 0 字节**。
  已从 `git show HEAD:...` 恢复，并把本次会话在这份文档里的改动**逐条重新落了一遍**
  （§1.1 卡片高亮条口径、capital / expert 两行、§1.1.1 三档表 + 红字重点 + 只留一行 + 三样一起复制 +
  老值收口、§1.4 经办人接口 `subscribe/handler`、05 确认提交的注册资本显示、冲突表里去掉的两条
  名称↔组织形式规则与受托书两行、联动表与代码位置表）；现在 349 行，已逐处核对一遍
- 更新 `docs/copreg-registration-fields.md`：性质表 / 字段表 / §1.1.1 / 冲突表 / 代码位置表同步到三档口径
- 回归：`npm run lint`、`npx tsx scripts/check-address-nature-hints.ts`（59 项）、
  `npx tsx scripts/check-conflicts.ts`（53 项）、`npm run check:entry`（78 项）、
  `.mcp-work/shot-address-hints.mjs`（两张截图已看）

### 顶栏主体下拉：列表滚动条改成常显（Safari 上原来只在滚动时出现）
- 修复 用户报的：「id="applications-dropdown" 在 Safari 需要一直显示垂直滚动条，Chrome 上没问题」——
  macOS 的 overlay 滚动条默认「滚动时才出现」，Safari 尤其明显：列表明明能滚（`max-h-72`），
  用户却看不到滚动条、以为就这么多；Chrome 一直显示，所以只在 Safari 上暴露
- 调整 `src/copreg/index.css`：给列表加 `.applications-scroll` 规则 ——
  **`overflow-y: scroll`**（槽位一直占着，内容多少都不跳）+ 显式画出 `::-webkit-scrollbar`
  （8px 宽、圆角灰滑块；Safari 只要画了 `::-webkit-scrollbar` 就退化成**常显**的经典滚动条）+
  Firefox 口径 `scrollbar-width: thin` / `scrollbar-color`
- 调整 `TopNavbar`：列表容器加 `id="applications-list"` 与 `applications-scroll` 类，
  注释指向 index.css 里的说明（下拉 `#applications-dropdown` 本身不滚，滚的是里面这段列表，
  表头与「新增企业注册」那颗按钮不跟着滚走）
- 新增 `.mcp-work/shot-applications-scrollbar.mjs`（**5 项**，真机 + 截图）：量出来
  `overflow-y: scroll`、`offsetWidth - clientWidth = 11px`（滚动条真占着宽度）、列表确实溢出
  （461 > 288）并截图 `.mcp-work/applications-scrollbar.png`（看图确认右侧滑块常显）
- 说明 无头环境是 Chrome，**Safari 本身没法在这儿自动化**；这里验的是「滚动条被显式绘制 + 槽位常驻」
  这条跨浏览器口径，Safari 上请再确认一眼
- 回归：`npm run lint`、`.mcp-work/shot-applications-scrollbar.mjs`（5 项 + 截图已看）

### 第 2 步 · 「注册资本与出资规划」那一档的结论字号与其它三张对齐
- 修复 用户报的：「#proposal 注册资本与出资规划 字体大小和其他的不一致」——
  `PlanReportView` 的四张「核心决策」卡片里，**amber 那一档（注册资本）的结论行原来单独写了 `text-base`**，
  另外三张是 `text-sm`，于是只有它大一号（量出来：16px vs 14px）
- 调整 `PlanReportView`：结论行统一 `text-sm`（`font-bold text-sm mb-2` + amber / slate 只差颜色）；
  **颜色差异保留** —— 那是这一档的配色口径，不是字号问题。这一档的标题（12px）、标签（11px）、
  要点内容（12px）本来就与其它三张一致，没动
- 新增 `.mcp-work/shot-proposal-decisions.mjs`：按 per-app 铺「有诊断结果」的存档直接落第 2 步，
  把四张卡片里**所有文字元素**的 computed font-size 量出来并断言「标题 / 标签 / 结论 / 内容四类两两一致」
  （不一致就退出码 1），同时存一张 `.mcp-work/proposal-decisions.png` 供看图核对。
  改回 `text-base` 跑一遍会红（已实测）
- 回归：`npm run lint`、`.mcp-work/shot-proposal-decisions.mjs`（自检 + 截图，已看）

### 第 5 步 · 经办人接口改口径：`subscribe/handler?busUnionId=…` → `handName / handIdNumber`
- 调整 服务端给了新地址与字段（用户 2026-10-08）：
  - 旧：`GET /xcx/yqt-co/subscribe/jingbanren?recordId={委托单号}` → `{ jingbanrenName, jingbanrenIdNumber }`
  - 新：`GET /xcx/yqt-co/subscribe/handler?busUnionId={委托单号}` → `{ handName, handIdNumber }`
  语义没变（还是「一窗通」那位经办人，仍然打开填报页读一次、只覆盖非空、失败给「重新获取」），
  所以只动了三个地方：`registration/jingbanren.ts` 的地址参数与解析字段、`config/api.ts` 的
  `JINGBANREN_PATH` 默认值（`VITE_JINGBANREN_PATH` 仍可覆盖）、解析仍然是「平铺认，
  套一层 `data`/`result`/`obj`（含 JSON 字符串）也认」
- 更新 `scripts/check-jingbanren.ts`（**28 项**全过）：地址断言（路径 + `busUnionId` + encode）、
  五种响应形态的解析（字段名换成 `handName / handIdNumber`）、只覆盖非空与 `changed` 判定
- 更新真机脚本的桩与断言：`.mcp-work/verify-jingbanren.mjs`、`verify-trustee.mjs`
  （URL 断言从 `recordId=` 改成 `busUnionId=`）、`verify-authorization-print.mjs`、
  `shot-address-hints.mjs`、`shot-fill-cards.mjs` 的返回体字段
- 更新 `docs/copreg-registration-fields.md` 的接口小节、`config/api.ts` 与组件里的注释
- 回归：`npm run lint`、`npx tsx scripts/check-jingbanren.ts`（28 项）、
  `.mcp-work/verify-trustee.mjs`（12 项，真机跑了一遍确认新地址/字段能带走）

### 第 5 步 · 卡片高亮条与 #survey 同一口径：校验过了才亮，没通过的不许是绿的
- 调整 用户要求：「#fill-details 需要输入的卡片增加高亮条，和 #survey 一样的样式」，
  随后明确「没验证通过的卡片不能是绿色，和第一步保持一致」——
  把问卷那套卡片装饰抽成共用组件 `src/copreg/components/SectionDecor.tsx`
  （`sectionCardClass(done)` + `<SectionDecor />`，带 `data-section-decor` 钩子），`SurveyStep` 改成引它，
  两个页面 DOM / 类名同一份
- 调整 第 5 步的卡片（`BasicInfoSection` 7 个面板 + 股东出资 / 主要人员 / 委托书办理三章）**只在
  「这一块没有待完善项」时**才加竖条 + 青绿描边浅底色；**没通过校验的卡片保持普通白底**，
  与 `#survey` 完全一致。判据：面板看它那组校验 id 有没有错（`PANEL_ERROR_IDS`），章节看这一章的
  `errors` 是否为空（`AuthorizationSection` 因此新增 `errors` prop，由 `RegistrationDetailsStep` 传章节错误表）。
  每张卡片带 `data-fill-panel` / `data-card-done` 便于自检；**确认提交（05）那一章没加**（复核页，不是输入卡片）
- 更新 `scripts/check-copreg-entry.tsx`（75 → **78 项**）：三条渲染断言 ——
  ① **高亮条数 = `data-card-done="true"` 的卡片数**（口径的硬约束）；② 页面里既有已完成卡片、
  也有 `data-card-done="false"` 的待完善卡片，且后者没有竖条；③ 问卷页同样带同款竖条（确认抽组件没走形）。
  顺带修好上一轮改性质表时漏改的三条旧断言（当时还在断言「居家办公申报 / 联合办公·众创工位 / 商业租赁」）
- 新增 `.mcp-work/shot-fill-cards.mjs`（截图存证）：第 01 章基本信息（存档里故意留空「地址与场地」
  → 那一张白底无竖条，其余 4 张亮）、第 02 章股东出资（有错 → 白底）、`#survey` 对照
  （`.mcp-work/fill-cards-1.png` / `-2.png` / `-survey.png`），已看图核对
- 更新 `docs/copreg-registration-fields.md`：§1.1 开头写明这条口径（只在校验通过时亮）与共用组件，
  代码位置表补一行
- 回归：`npm run lint`、`npm run check:entry`（78 项）、截图已核对

### 第 5 步 · 去掉「名称 ↔ 组织形式」那套冲突校验（只填字号之后必然误伤）
- 修复 用户报的：「拟注册企业名称 不需要这种报错了『组织形式选了股份有限公司，但填写的名称里都没有「股份」字样，请核对』，因为是填的字号了」——
  名称那一格现在只填**字号（关键词）**，行政区划与组织形式后缀由系统按所选组织形式补全，
  字号里本来就不该出现「股份 / 合伙」这类字样，所以这套「名称里有没有该字样 ↔ 组织形式」的跨表对照没有依据了
- 调整 `conflicts.ts`：第 0 章那一整块**四条规则**全部去掉（两条「含 X 但组织形式不符」+ 两条「选了 X 但名称里没有 X 字样」），
  连 `NAME_WORDS` 常量一起删掉，原地留一段说明（真要按完整名称校验，得等系统拼出全名之后再按全名对账）
- 更新 `scripts/check-conflicts.ts`（58 → **53 项**）：原来那 6 条断言换成 3 条 `expectClean`（选股份有限公司但字号没「股份」→ 不报、
  字号带「股份」但组织形式是有限公司 → 也不报、合伙企业同理），综合场景不再靠名称造冲突、条数下限与 name-0 断言同步
- 更新 `.mcp-work/verify-conflicts.mjs`：场景 B 从「名称 / 委托书冲突」改成「委托书冲突」（断言第 1 章**没有**冲突横幅、
  第 4 章的委托书冲突照旧列出）
- 更新 `docs/copreg-registration-fields.md`：关联冲突表里那两行标成已去掉并写明原因；自检条数 58 → 53
- 回归：`npm run lint`、`npx tsx scripts/check-conflicts.ts`（53 项）；真机脚本改好但本轮未跑

### 第 5 步 · 「无偿使用证明」的空值提示去掉尾巴与 ⚠️ 前缀
- 调整 用户要求：删掉这一档空值提示里的「且需与无偿提供方的房产证地址一致（或勾选由服务商提供）」，
  随后又要求**把前面的 ⚠️ 也去掉** —— 现在报错逐字是
  `必须填写与《无偿使用证明》完全一致的房产地址（包含门牌号及房号）`
  （两个地址共用这一句；重点只靠**红色**表示，**这一档也不给「或勾选由服务商提供」的退路**）
- 更新 `scripts/check-address-nature-hints.ts`：逐字断言跟着改（并断言不以 ⚠️ 开头）；
  「每句报错都给退路」那条改成「除『无偿使用证明』外都给退路」并额外断言这一档确实**没有**退路（69 项全过）
- 更新 `.mcp-work/verify-address-nature-hints.mjs`（改成整句相等断言）、
  `docs/copreg-registration-fields.md`（五档表那一行 + 备注）；重新出图看图核对
  （`.mcp-work/address-hints-1.png`：报错只剩「必须填写与《无偿使用证明》完全一致的房产地址（包含门牌号及房号）」）
- 回归：`npm run lint`、`npx tsx scripts/check-address-nature-hints.ts`（69 项）、截图已核对

### 第 5 步 · 两个地址共用同一套地址性质；「同法定注册地址」连材料（uuid）一起同步
- 调整 用户要求：「把 2 个地址性质改为相同的，以法定注册地址为准。同步地址时一起同步图片 uuid」
  - `addressNatureHints.ts`：新增共用的 `ADDRESS_NATURES`（租赁用房 / 自有房产 / 集中办公·众创空间 /
    园区孵化器 / 无偿使用证明），`REG_ADDRESS_NATURES` 与 `WORK_ADDRESS_NATURES` 都指向它；
    `DEFAULT_WORK_ADDRESS_NATURE` 跟着变成「租赁用房」；`WORK_HINTS` 的键与注册那边一一对应
    （同一档填写口径逐字相同，只有缺填报错各说「法定注册详细地址 / 经营办公地址」）；
    `workNatureForCopiedRegNature()` 从「一一对应映射表」改成**恒等**（认不出仍返回 null）
  - 新增 `normalizeWorkAddressNature()`：老存档的实际经营性质平移（商业租赁→租赁用房、自有产权→自有房产、
    联合办公·众创工位→集中办公·众创空间）；**「居家办公申报」没有对应档 → 清空让用户重选**
    （性质决定要传哪些场地材料，不替他猜）。在 `formSnapshot.normalizeRegistrationForm` 里统一跑，
    填报页与服务人员查看页共用；`defaultData` 的空白骨架也跟着改成「租赁用房」
  - `BasicInfoSection`：「同法定注册地址」现在**三样一起搬** —— 地址、地址性质、**场地证明材料**；
    材料**保留原 `fileUuid`**（服务端已收过，不必重传）、只换本地行 id（两份清单不共用 id）；
    注册那份材料为空时只搬前两样，提示语相应分两句
- 更新 `scripts/check-address-nature-hints.ts`（70 → **69 项**，其中「复制映射」那 8 条换成 5 条恒等断言）：
  两表完全相同（含同一引用）、默认项统一、旧值平移与「居家办公申报清空」、同一档占位逐字相同而报错
  各说自己的场景、5 档材料清单两侧逐条相同、两边性质键完全一致；`check-conflicts.ts` 的夹具性质值跟着换
- 更新 `.mcp-work/verify-address-nature-hints.mjs`：两侧用例换成同一套 5 档；复制段改成
  「先选另一档当哨兵 → 复制后必须变成注册那一档」，并**新增两条真机断言**：复制过来的材料
  `fileUuid` 与原来一致（保存草稿后读存档）、本地行 id 换过；提示语按新的两句判定
- 更新 `.mcp-work/shot-address-hints.mjs` + 重新出图（`.mcp-work/address-hints-1.png` / `-2.png`，
  已看图核对：两栏的性质按钮完全一样、材料清单同一份）
- 更新 `docs/copreg-registration-fields.md`：字段表 `workAddressNature` 一行、§1.1.1 的五档表
  （改成两个地址共用一套）、老值平移与「复制三样一起搬」的说明
- 回归：`npm run lint`、`npx tsx scripts/check-address-nature-hints.ts`（69 项）、
  `npx tsx scripts/check-conflicts.ts`（58 项）、截图已核对；真机脚本按新口径改好但本轮未跑

### 第 5 步 · 地址输入框下面只留一行文字（去掉与红字报错重复的小字说明）
- 修复 用户报的：「地址输入框下方的小字提示和错误消息冲突了不好看」—— 上一版在输入框下面又加了一行
  小字「地址怎么填」，而这一格是必填、空着时**红字报错同时出现**，两行说的是同一件事
- 调整 `BasicInfoSection`（两个地址各一处）：**删掉那行小字**，输入框下面只留报错那一行（没报错就什么都不显示，
  「地址怎么填」看占位提示 —— 换性质时占位会跟着换，信息没丢）
- 调整 `addressNatureHints.ts`：第 5 档「无偿使用证明」的**占位改成短句**
  「请输入与《无偿使用证明》完全一致的房产地址（含门牌号及房号）」，用户给的那句整话
  （含门牌号房号 + 需与无偿提供方房产证一致）落进**红色报错**并带 ⚠️ —— 否则空着时红占位与红报错
  还是同一句长文案（截图看出来的）。两个地址共用这句报错（原话本来就不分注册 / 经营）
- 调整 该档的红字重点仍保留：占位标红（`AddressHint.emphasis`）＋ 报错带 ⚠️；不再额外加小字
- 更新 `scripts/check-address-nature-hints.ts`（68 → **70 项**）：第 5 档那条改成断言**报错**逐字用用户原话、
  占位是短句且与报错不是同一句、两个地址该档报错一致
- 更新 `.mcp-work/verify-address-nature-hints.mjs`（同口径；新增「占位与报错不重复」一条）；
  `.mcp-work/shot-address-hints.mjs` 重新出图（已看图核对：① 无偿使用证明 一红占位 + 一红报错、② 园区孵化器同）
- 更新 `docs/copreg-registration-fields.md` §1.1.1：写明「输入框下面只留一行」
- 回归：`npm run lint`、`npx tsx scripts/check-address-nature-hints.ts`（70 项）、截图已核对；
  真机脚本按新口径改好但本轮未跑

### 第 5 步 · 两个地址的提示词改成「五档口径」（地址怎么填 + 需上传材料）
- 调整 用户给了五档口径（类型 1 租赁用房 / 2 自有房产 / 3 集中办公·众创空间 / 4 园区孵化器 / 5 无偿使用证明），
  每档包含**地址怎么填**与**需上传材料**两张清单 —— 落到 `src/copreg/registration/addressNatureHints.ts`：
  - 占位提示 = 用户给的「地址填写」原话（如「按房产证或租赁合同上的地址填写。」）；
  - 新增 `AddressHint.materials`（需上传材料逐条）与 `emphasis`（只有第 5 档为 true → 红字重点）；
    两个地址**共用同一套材料清单**，缺填报错仍按各自场景说「法定注册详细地址 / 经营办公地址」；
  - **居家办公申报**用户这次没给口径 → 保留原来的提示、材料清单留空（界面就不显示材料块，不编要求）；
    实际经营那边选不到「园区孵化器 / 无偿使用证明」，但老存档里可能留着 → 照样按同一套口径提示
- 调整 `BasicInfoSection`（两个地址面板各一处）：
  1. 输入框下面补一行「地址怎么填」说明 —— **无偿使用证明那一档标红**（⚠️ + 红字，地址填上后转灰），
     同时给该档的输入框加 `placeholder:text-rose-400/90`（「红字报错重点」）；
  2. 证明材料上传框上面新增**「需上传材料（<所选性质>）」**清单块（按性质换内容）；
  3. 材料清单非空时，上传标签里那句泛化举例（「如租赁合同、房产证复印件或场地使用证明」）不再重复显示
- 更新 `scripts/check-address-nature-hints.ts`（52 → **68 项**）：五档「地址填写」逐句对上用户原话、
  五档材料清单条数与关键条目逐条对上、两个地址材料口径一致、只有第 5 档 emphasis、
  居家办公申报材料清单为空、认不出的性质材料是空数组、材料清单返回的是副本（改不动模块里的表）；
  顺带把「自有房产」的关键词从「不动产权证」改成用户口径里的「房产证」，并把「同名性质占位相同」
  这条改对（现在两个地址共用同一句填写口径，**必须不同的是缺填报错**）
- 更新 `.mcp-work/verify-address-nature-hints.mjs`：关键词同步（不动产权证 → 房产证），PROBE 增加
  「读『需上传材料（<性质>）』那一块的条目」，并新增三条断言（注册 5 档都有清单且关键条目对、
  实际经营有清单而居家办公申报**没有**那一块、无偿使用证明那句填写口径逐字对）
- 新增 `.mcp-work/shot-address-hints.mjs`（截图存证）：① 无偿使用证明（红字那档）+ 商业租赁 →
  `.mcp-work/address-hints-1.png`；② 园区孵化器 + 居家办公申报（无材料口径那档）→ `-2.png`，已看图核对
- 更新 `docs/copreg-registration-fields.md` §1.1.1：改成五档表格（地址怎么填 / 需上传材料）+ 红字口径说明
- 回归：`npm run lint`、`npx tsx scripts/check-address-nature-hints.ts`（68 项）、
  `.mcp-work/shot-address-hints.mjs`（两张截图已看）；`verify-address-nature-hints.mjs` 已改脚本但本轮未跑

### 第 5 步 · 填报页不显示顶部 header，也去掉两颗「返回办理清单」
- 调整 用户要求：「#fill-details 不显示顶部 header 和 2 个返回办理清单的按钮」
  - `App.tsx`：`currentStep === 'fill_details'` 时**不渲染 `TopNavbar`**（这一页是独立模块，顶上不该再压一条向导导航；主体切换在这里也会把用户从填报页拽走）
  - `RegistrationDetailsStep`：删掉页头那颗「返回办理清单」，底部操作条第 1 章那颗也去掉（第 2 章起仍是「上一项」，章节内导航没动）
  - 连带把只有这两处用到的 `onBackToPaid` prop 一起删了（接口 / App 调用点 / `check-copreg-entry.tsx` 的三处传参），不留死 prop
- 说明 [!] **同标签页兜底那条路的代价**：正常情况下填报页是支付成功页**新开标签页**打开的，回办理清单 = 关掉这一页；但弹窗被拦时走的是**同页跳转**，那种情况下这一页现在没有「回清单」入口了 —— 可以「保存草稿」继续填、或提交后自动回 `#paid`、或刷新（第 5 步不落盘，刷新回支付页）。要在这条兜底路上补一个入口的话说一声（按 `?open=fill-details` 意图有无来区分即可）
- 调整 受影响的真机脚本（按 AGENTS §3「改了界面元素要顺手改脚本」）：`verify-paid-cta.mjs` 断言反过来 —— **没有**顶栏、**没有**「返回办理清单」（原来点它回支付页那两步删掉）；`verify-address-bar-readonly.mjs` 第 ④ 步改成钉「独立模块」这三点（无顶栏 / 无返回按钮 / `history.length` 没变），第 ⑤ 步 `history.back()` 仍是浏览器真后退；`verify-open-info.mjs` 里「提交后状态」的兜底标记不再用「返回办理清单」，改成 `location.hash === '#paid'`
- 更新 `docs/copreg-registration-fields.md` 的联动表（那一行改成「不显示全局顶栏、没有回清单入口」并写明回去的方式）
- 回归：`npm run lint`（真机脚本这一轮没跑，留到发版前整套回归）

### 第 3 步 · #paid 头部「经办人姓名 / 经办联系电话」改取申报资料里的联系人
- 修复 用户要求：「#paid 头部卡片中的经办人姓名和经办联系电话，取值如果后面填写了联系人信息就取联系人的姓名和电话」。原来那两格读的是订单上的 `contactName` / `contactPhone` —— 而 `contactName` **从来没有任何地方采集过**（一直是空），所以「经办人姓名」永远是破折号；电话也只是查单带回来的经办手机号
- 新增 `src/copreg/registration/contactInfo.ts`（纯逻辑）：`contactOfForm`（按角色找「联系人」→ 那个人的姓名 / 电话；同一个人可兼多角色，所以按角色找、不按顺序猜；**没填联系人也不拿法定代表人顶替**）、`contactOfDraftJson`（草稿 JSON → 联系人，坏 JSON / 旧版本缺 `roles`·`people` 一律当没填，走 `normalizeRegistrationForm` 收口）、`agentCardOf`（**两项分开判断**：联系人填了就取联系人的，没填的那项才退回订单上的值，都没有显示破折号）
- 新增 `src/copreg/registration/useRegistrationContact.ts`（hook）：读**当前主体**那份 `banbu-registration-{appId}` 草稿；填报页是**新标签页**打开的，本页一直挂着不会重挂载，所以监听 `storage` 事件（那边一保存草稿这里就更新）＋ `focus` / `visibilitychange` 兜底，另把「已提交」状态当刷新信号传进来；两项都没变时返回原对象，避免每次 focus 白渲染
- 调整 `AgreementAndPaymentStep`：头部那两格换成 `agentCard.name` / `agentCard.phone`
- 新增 `scripts/check-contact-info.ts`（**19 项**，纯逻辑）：取角色为联系人的那位（不取法定代表人 / 兼多角色也能取到 / 空格 trim / 角色指着不存在的人 / 只填一项）、草稿 JSON 四种坏形状、卡片两格的四种组合（联系人优先、只填一项、退回订单、两边都没有给破折号）
- 更新 `docs/copreg-steps.md`：已支付界面那几格的数据来源改成「联系人优先、其次查单，附 storage 事件那条链」
- 说明 [!] **没动的一处**：协议弹窗里的「委托方（甲方）」目前仍只写手机号（注释里写着 `contactName` 没人采集所以一直是「＿＿＿＿」）。现在联系人姓名有了，要不要把甲方改成「姓名（手机号）」属于合同口径，等产品定
- 回归：`npm run lint`、`npx tsx scripts/check-contact-info.ts`（19 项）

### 第 3 步 · 协议卡片右侧的「点击查看协议全文」去掉
- 调整 支付页协议确认卡片右侧那颗「点击查看协议全文」按钮删掉（`AgreementAndPaymentStep.tsx`）；左侧「我已阅读并同意《委托代理服务协议》」那颗按钮还在（协议正文照旧从那里弹），所以没有丢入口
- 回归：`npm run lint`（只删了一颗按钮，没跑真机脚本）

### 第 1 步 · 删掉标题下面那条黄色提示条
- 调整 按用户要求删掉 `#survey` 标题下面那条「用于评估组织形式与税务开票方案。带 **必填** 项建议完整提供，经营范围可使用 AI 智能生成。」的提示条（`SurveyStep.tsx` 的 Flat Tips Bar）；顺带去掉随之不再使用的 `Info` 图标 import（没有别的检查脚本断言这条文案，删掉不影响任何自检）
- 回归：`npm run lint`（未跑真机脚本 —— 这次只删了一段静态文案，见 AGENTS §3 的按需口径）

### 第 5 步 · 委托书「受托人」两项改成接口带入（去掉输入框，字段保留）
- 调整 用户要求：「去除经办人输入框，保留字段；调用接口获取这 2 个字段然后赋值，每次打开 #fill-details 时调用接口」——
  `AuthorizationSection` 里那两颗输入框（受托人姓名 / 受托人身份证号码）**删掉**，改成一块只读的「受托经办人：李四 · 44030119930812341X」+ 一句「由服务人员按『一窗通』公章经办人信息自动带入，无需填写」；
  **`authorization.trusteeName` / `trusteeIdNumber` 两个字段原样保留**：05 确认提交那一章、委托书正文、打印件与下载件读的还是它们，也照样随保存/提交发给服务端
- 新增 `src/copreg/registration/jingbanren.ts`（纯逻辑，照 `openInfo.ts` / `subscribeQuery.ts` 的写法）：
  `GET {host}/xcx/yqt-co/subscribe/jingbanren?recordId={委托单号}` → `{ jingbanrenName, jingbanrenIdNumber }`；
  `jingbanrenUrl`（host/path 斜杠接缝、recordId 要 `encodeURIComponent`）、`jingbanrenFromPayload`（平铺认，套一层 `data`/`result`/`obj`（含 JSON 字符串）也认；认不出来就是空串，**不写 `undefined`**；身份证号按手填老口径清洗成「数字 + 结尾 X」并大写）、
  `applyJingbanren`（**只覆盖非空的那一项**，两项都没变化时 `changed = false`，调用方不用白改 state / 白落盘）
- 新增 `config/api.ts` 的 `JINGBANREN_PATH`（`VITE_JINGBANREN_PATH` 可覆盖，与 `open-info` / 支付同一个 `DOC_HOST`），15 秒超时
- 调整 `RegistrationDetailsStep`：挂载时（= 每打开一次填报页，刷新也算）读一次，拿到就写进 `form.authorization` 并**顺手落一次本地草稿**（用户还没点保存时，确认页与委托书预览也要看得到）；
  读请求走 `onceGate` 单飞闸门（dev 的 StrictMode 会挂载两次，没闸门就是两次 GET —— 服务人员查看页当初就是因此把一次性查看码用掉的）；读失败只提示、**不写脏数据**，页面上给一颗「重新获取」（先 `reset` 闸门再读，所以是真重读）
- 调整 `conflicts.ts` 的两条委托书校验文案：两项现在由接口带入、用户自己补不了，所以从「（或都留空交申请人手写）」改成「请联系企服专员核对『一窗通』经办人信息」；身份证号格式那条也加一句「号码由系统带入，请联系企服专员核对」
- 新增 `scripts/check-jingbanren.ts`（**28 项**，纯逻辑）：地址拼接与 encode、五种响应形态的解析、脏数据不写、只覆盖非空 / 没变化 `changed=false`、路径没配与缺单号时不发请求、非 2xx 透出服务端人话、空体报格式异常
- 新增 `.mcp-work/verify-jingbanren.mjs`（**12 项**，真机 · 两段）：① 读失败 → 提示服务端那句人话 + 「重新获取」→ 接口恢复后点一下**真的重读**（累计 2 次）、值出现并落草稿；② 接口**只给姓名** → 只覆盖姓名、身份证号保留草稿里原有的；**刷新（重新打开填报页）会再读一次**（累计 2 次）
- 调整 `.mcp-work/verify-trustee.mjs`（改成新口径，**12 项**）：草稿里放联系人张三 + 接口给李四 → 断言两颗输入框都不在了、页面与委托书正文用的是李四（尾号 x 规范成大写 X）、**不回落联系人张三**、值自动落草稿且保存草稿时发给服务端；顺带按新脚本规范改成 per-app 铺存档（不再用旧键 + 垫片）
- 调整 `.mcp-work/verify-authorization-print.mjs`：原来点进第 4 章后**往输入框里填**受托人，现在改成给 `/subscribe/jingbanren` 打桩、等接口带入后再打印（否则那颗 `querySelector('input[placeholder="请填写受托人姓名"]')` 会取到 null 直接抛）
- 更新 `docs/copreg-registration-fields.md`：1.4 节改成「由接口带入、界面上没有输入框」并补经办人接口的地址 / 触发时机 / 失败口径；校验表两条委托书规则同步改成「请联系企服专员核对」
- 更新 `AGENTS.md` §3 / §4：**不要每改一次代码就跑验证脚本**（用户 2026-10-08 要求）—— 自检是台账不是必过关卡，日常最多 `npm run lint`，其余按需跑；但删掉/改了界面元素要顺手把用到它的脚本改对，跑了哪些如实写进变更记录
- 回归（本节改动按需跑的那几个）：`npm run lint`、`npx tsx scripts/check-jingbanren.ts`（28 项）、`.mcp-work/verify-trustee.mjs`（12 项）、`.mcp-work/verify-jingbanren.mjs`（12 项）；
  `verify-authorization-print.mjs`（已改成打桩等接口带入，未跑）、`verify-conflicts.mjs`（走草稿预置，不受影响）、`npm run check:entry` / `npm run build` **留到发版前整套回归时再跑**

### 修复 第 5 步「注册资本」：基本信息填了 10，05 确认提交却显示「专家推荐」
- 修复 用户报的问题：「#fill-details 注册资本显示不对，基本信息填了 10，这里显示 专家推荐」—— 05 确认提交那一章的「注册资本」只写「专家推荐（由顾问出资建议方案确定）」，**把他填的数字整个吞掉**。根因：`basic.expert` 是**建表那一刻**从问卷抄来的快照（问卷问「是否需要注册资本专家建议」，默认「是 · 需要专家建议」→ 预填方案建议值 + `expert = true`），改输入框只改 `capital`、**不会清这个标记**，而确认页原来只看标记：`expert ? '专家推荐' : …`
- 新增 `src/copreg/registration/capitalHints.ts`（纯逻辑）两条口径：
  1. `capitalEditPatch(value)` —— **用户一旦自己改这一格，就等于他自己定了金额**：只留整数并顺手把 `expert` 撤成 false（治本；`BasicInfoSection` 的 `onChange` 改用它）；
  2. `capitalReviewTextOf(basic)` —— **确认页有数字就先显示数字**：`10 万元人民币`；`expert` 仍为 true（没动过、数字还是建议值）时附注「（专家建议值，最终由顾问确定）」；数字为空时保持原来的「专家推荐…/未填写」。这样连**改之前就已经存下来、带着 `expert = true` 的旧草稿**也不会再把数字藏起来
- 调整 `BasicInfoSection`：预填的仍是方案建议值时，输入框下面加一句说明（`CAPITAL_EXPERT_HINT`：「当前数字是方案给出的建议值（问卷里选了「需要注册资本专家建议」）…要自己定就直接改这一格，改完按你填的金额走，确认提交那一章也会显示这个数字」）—— 用户一眼就知道这个 100 不是他填的、可以改；改完这行也跟着消失
- 新增 `scripts/check-capital-hints.ts`（**16 项**，纯逻辑）：只留整数 / 改了必撤标记 / 清空也撤；确认页四种组合（自己填 / 建议值 / 带着标记但已改成 10 / 空值）的显示串，其中两条专门钉「不再写死『专家推荐』把数字吞掉」
- 新增 `.mcp-work/verify-capital-review.mjs`（**14 项**，真机）：预置一份「建议值 100 + 专家标记」的草稿 → 确认页显示 100 并注明是建议值 → 回基本信息用**真键盘输入**把金额改成 10（说明随之消失）→ 再进确认页显示「10 万元人民币」、没有「专家建议值」、旧值 100 不再出现 → 点「保存草稿」后断言存档与提交给服务端的 `var2` 都是 `capital = '10'` / `expert = false`（不只是显示层的事）
- 更新 `docs/copreg-registration-fields.md`：`capital` / `expert` 两行口径，新增「05 确认提交那一章怎么显示「注册资本」」小节
- 回归：`npm run lint`、`npx tsx scripts/check-capital-hints.ts`（16 项）、`npm run check:entry`（75 项）、`.mcp-work/verify-capital-review.mjs`（14 项）

### 修复 多主体顶栏状态不实时：付完款点开还是「待支付」（已支付不给作废 / 填报页深链也一起修好）
- 修复 用户报的问题：「头部多主体的状态没有实时更新，支付成功后点击还是未支付状态」。根因是**付款成功只更新了运行时那份订单**（`AppRuntime.order`，走 `onUpdateOrder`），**没写回主体记录里的订单摘要**（`1b_copreg_apps_v1`）—— 而顶栏下拉的状态徽标、「作废服务 / 已生效履约中」、以及支付成功页新开填报页的深链放行条件（`stepRoute.allowsFillDetailsIntent` 读 `order.status`）**读的全是那份摘要**。所以付款后界面已经是「支付成功」，顶栏却还是「待支付」、已付款的主体还留着「作废服务」入口（点下去会被 `discardApplication` 的 paid 规则拦住，但入口就不该在），**新开的填报页标签页也被拒**（深链落回支付页、`?open=fill-details` 没被认）
- 新增 `applications.ts` 的 **`applyPaidOrder(app, paid)`**（纯逻辑）：置 `order.status = 'paid'`、单号 / 支付时间 / 手机号**有才写**（空串不覆盖已有值）、顺手解锁 `group`（重复调用不写重复）；**`amount` / `tierName` 一律不动** —— 摘要里的金额是当时实际付的那笔，调用方手上那份订单是按**现价**现算的，报价改版后不能把已付金额盖掉（与 `patchOrderSummary` 同口径）
- 调整 `App.tsx`：新增 `handlePaymentSuccess(paidOrder)` —— 原来只 `unlockStep('group')`，现在改成 `updateActiveApp((app) => applyPaidOrder(app, …))`；**「进页面查单确认已支付」那条路也换成同一个函数**（两条路写入口径原本就有微差，现在收敛成一处）
- 调整 `AgreementAndPaymentStep`：`onPaymentSuccess` 从 `() => void` 改成 `(paidOrder: PaymentOrder) => void`（把这份付过款的订单交回 App）；顺手删掉声明了却从来没人传的 `onPaid` 死 prop（它的语义已被 `onPaymentSuccess` 吸收）
- 审计「其他状态是否也有此 bug」（用户要求）——**结论：只有支付状态漏写，其余都有落点**：主体名（改名 / 诊断派生）、数量（新增 / 作废）、套餐与价格（切档 / 生成方案）、步骤徽标（`setCurrentStep` 对可登记步骤写记录）、已提交（`handleSubmitForReview`）各自的回调都写了主体记录。第 4/5/6 步的徽标文案（服务群对接中 / 资料填报中 / 开办进度追踪）**显示不出来是设计使然**：徽标先判 `order.status === 'paid'`（与参考实现 `getStepBadge(step, isPaid)` 同序），付过款后一律「已支付 · 办理中」，不是这次的问题
- 更新 `scripts/check-applications.ts`（63 → **74 项**）：+11 条 `applyPaidOrder` 断言（置 paid / 单号时间手机号写回 / 空串不覆盖 / 金额与套餐名不动 / 不改当前步 / 刷新 `updatedAt` / 不动原记录 / 服务端没给字段时保留原值 / 重复调用 `group` 不写重复）
- 新增 `.mcp-work/verify-header-live-status.mjs`（**15 项**，真机 · 无头 Chrome，桩掉下单与查单）：A 在支付页真的点「立即支付」走完链路（查单桩**进页面时回 `status='0'`、点过下单才回 `'1'`**，否则进页面的核实直接把人送到支付成功界面、根本点不到按钮）→ 断言顶栏那一条同步翻成「已支付 · 办理中」「已生效履约中」、没有「作废服务」、摘要落成 paid 且**金额没被现算报价盖掉**；B 顺着 A 的结果新开 `?open=fill-details` 标签页 → 深链被放行（落第 5 步、参数已抹）；C 对照主体仍「待支付」+ 留着「作废服务」（没写串）；D 覆盖其余状态：切档后顶栏套餐 / 价格实时翻（¥600 → 全年无忧 ¥2500）并落进摘要、前往支付后徽标「方案待确认」→「待支付」。**把写回摘要那一步退回旧实现跑一遍，A/B 两段共 4 条会红（已实测）**
- 更新 `docs/copreg-multi-app.md`：§四「支付按主体」补「付款成功要写回摘要」的口径与三个症状，§验收 的断言数（63 → 74）与新增脚本一并同步
- 说明 [!] **没有动的一处相邻缺口**：跨标签页仍然**不会**把别人的改动实时同步到本页顶栏 —— `1b_copreg_apps_v1` 是共享键，但两页各持一份 React 快照、且**没有 `storage` 事件监听**（合并写只保证后写的不把前写的盖掉）。所以「填报页提交完回支付页，清单还显示待填报」「别的标签页新增的主体，这一页顶栏看不到」都还在。要不要加同步是产品决定：一加就得同时保住「每个标签页钉在自己的主体上」（`verify-cross-tab-apps.mjs` 正在钉这条），故这次先按用户报的那一条修，不动既有口径
- 回归：`npm run lint`、`npm run build` / `build:biz`、`npm run check:entry`（75 项）、全部 23 个 `scripts/check-*.ts`（check-applications 74 项）、`.mcp-work/verify-header-live-status.mjs`（15 项）、`verify-multi-app.mjs`（18 项）、`verify-cross-tab-apps.mjs`（13 项）、`verify-entry-paid-query.mjs`（12 项）、`verify-paid-cta.mjs`（12 项）、`verify-proposal-lock.mjs`

### 修复 服务人员查看页把一次性查询码用了两次 + 刷新不再失败（会话内快照）
- 修复 用户报的问题：进入 `copreg-view.html` **调了 2 次读接口**，而查看码只能使用 1 次，第二次就过期了。原因：dev 的 React StrictMode 会「挂载 → 清理 → 再挂载」，effect 跑两遍 —— 第一遍的请求已经消费掉查询码
- 新增 `src/copreg/registration/onceGate.ts` 的 **`createOnceGate` + `serviceViewGateKey`**（纯逻辑）：模块级单飞闸门，key = 开户单编号 + 查看码，同 key 在途/已出结果都复用同一个 promise（**失败的 promise 也记住**，不会因为一次网络抖动把同一枚码打两次）；另给 `reset`，让「重新读取」能真的再发一次（网络没打到服务端时同一枚码仍可用）。与 `orderStatusCheck.ts` 的查单单飞闸门同一套路（那边也是为 StrictMode 写的）
- 修复 用户接着报的「**刷新就会失败**」：刷新 = 整页重新加载 = 闸门也是新的 → 同一条链接再打一次接口必然被拒。新增 `src/copreg/registration/snapshotStore.ts` 的**会话内快照**：读成功时把接口原样响应按同一个 key 存进 `sessionStorage`（`1b_copreg_service_view`，最多留最近 5 条），刷新先查它，**命中就直接渲染、一个请求都不发**，并在概览上说明「本页是 ⋯ 读取的**会话内快照**：刷新不会重新读取（查看码一次有效）」+ 给出「回开户详情页重新点一次」的办法；概览另加一格「本次读取时间」
  - 键里含查看码：**换了一条新链接（新码）不会命中旧快照**，照常去读最新内容（会话内快照不会把新内容挡在外面）
  - **只写 `sessionStorage`**（随标签页关闭消失），`localStorage` 仍然一个键都不写 —— 客户数据不落服务人员浏览器的长期存储
  - 「重新读取」按钮只在**读取失败**时出现（那时没有快照）；命中快照时不提供重试（一次性码重试无意义）
- 调整 `ServiceRecordView`：effect 改走闸门 + 先查快照；`ServiceRecordContent` 增 `fetchedAt` / `fromSnapshot` 两个 props 与快照提示条；失效提示改成「本页链接的查看码一次有效：若已失效（例如刷新过页面），请回到开户详情页重新点一次「查看申报资料」」
- 更新 `scripts/check-service-view.ts`（50 → **66 项**）：+7 条闸门断言（同 key 只跑一次 / 复用同一个结果 / 换 key 重跑 / reset 重跑 / 在途并发只跑一次 / 失败也记住 / key 不串号），+9 条快照断言（坏 JSON 当空表 / 形状不对丢掉 / payload 原样 / 换码不命中 / 换编号不命中 / 同 key 覆盖 / 新的排最前 / 只留最近 5 条 / limit 为 0 也留一条）
- 更新 `scripts/check-copreg-entry.tsx`（73 → **75 项**）：概览出现「本次读取时间」；正常读取时**不**出现快照提示；`fromSnapshot` 时出现「会话内快照 · 刷新不会重新读取 · 请回开户详情页重新点一次」
- 更新 `.mcp-work/verify-service-view.mjs`（5 场景 40 项 → **6 场景 62 项**）：① 把「至少发了一次请求」改成 **「恰好只打了一次」（`calls.length === 1`）** —— 改回不带闸门的实现跑一遍会红（已实测：报 2 次调用）；② 断言读到的内容写进了 `sessionStorage` 快照；③ 新增 **`refresh` 场景**：真按一次浏览器刷新，断言**累计调用数仍是 1**、内容照旧、出现快照提示、`localStorage` 仍为 0、hash 仍没被改；调用日志跨刷新记在 `sessionStorage.__subCallLog`，而「有没有写 localStorage」的桩改成只在 `this === localStorage` 时记账（不然测试自己的 sessionStorage 日志会被算进去）
- 说明 仍未解决的一种情况：**换浏览器/转发给别人打开**同一条链接仍会失败（快照只在原标签页的会话里）。要做到那一点得让服务端把查看码放宽（有效期内可重复查看），前端不用改
- 更新 `docs/copreg-service-view.md`（§二 改成「一次打开只查一次，刷新靠会话内快照」并加两条保险的说明；页面边界 2 补 sessionStorage 例外；代码位置表补 `snapshotStore.ts`；自检数字同步）
- 回归：`npm run lint`、`npm run build` / `build:biz`、`npx tsx scripts/check-service-view.ts`（66 项）、`npm run check:entry`（75 项）、全部 23 个 `scripts/check-*.ts`、`.mcp-work/verify-service-view.mjs`（6 场景 62 项）

### 新增服务人员查看页 copreg-view.html（只读看客户提交的申报资料）
- 新增 **独立页面 `copreg-view.html`**（`src/copregView.tsx` + `components/ServiceRecordView.tsx` + `vite.config.ts` 新入口）：给服务人员按**开户单编号**看客户在第 5 步填的那几个对象。地址 `copreg-view.html?scbUuid=<开户单编号>[&code=<查看码>]`（`uuid` 作为别名也认，那是 www 站 `static/js/page-display.js` 的写法）。**没有做进 `copreg.html`**：客户主流程整页有本地存档、六步状态机、支付与查单，服务人员的浏览器里这些一份都没有，混在一起只会多出一堆「没存档怎么办」的分支，还容易把客户申请写进服务人员的浏览器
- 新增读取接口 `src/copreg/registration/subscribeQuery.ts`：`GET {DOC_HOST}{SUBSCRIBE_QUERY_PATH}{scbUuid}[?code=…]`，`SUBSCRIBE_QUERY_PATH` 默认 `/xcx/yqt-co/subscribe/`（`config/api.ts`，可用 `VITE_SUBSCRIBE_QUERY_PATH` 覆盖）。地址与凭据口径**照 www 站 `static/js/page-display.js` 的 code 版逻辑**（同一个 host = `DOC_HOST`/它的 `API_HOST`，同一个 basePath）—— 真机实测：带失效的 `code` 是 **400 + `{"reasons":[{"message":"查询码无效或已过期"}]}`**，不带 `code` 测试环境放行 200，所以前端**不强制要求 code**，错误文案统一走 `utils/serverError.ts` 把服务端那句人话透出来（15s 超时，与保存/提交同一口径）
- 新增纯逻辑 `src/copreg/serviceView.ts`：`serviceViewQueryOf`（`?scbUuid=` / `?uuid=` / 空值 / 畸形串）与 `serviceFormOf`（从响应的 **`openAccApply.var2`** 取申报表：字符串按 JSON 解、对象直接用，失败分档给「没有开户申请信息 / 客户还没提交 / 无法解析 / 无法识别」）
- 新增 `src/copreg/registration/formSnapshot.ts` 的 **`normalizeRegistrationForm`**：把「空骨架打底 + 存档覆盖 + 补后加字段默认值 + 附件逐项过滤」从 `RegistrationDetailsStep` 里抽出来 —— **填报页读本地草稿与查看页读接口 `var2` 共用同一份**，免得两处合并规则各自演化。`RegistrationDetailsStep` 行为不变（只是改成调它）
- 调整 `ReviewSection` 增加 `readOnly`：隐掉四块「修改」按钮与整条客户报喜横幅（「初审通过 · 资料已移交政务交付团队」这句进展话术没有数据支撑，服务人员不该把它当状态读），两个确认勾选置灰；**非只读时一字不动**（有回归断言盯着）
- 查看页的展示范围 = `var2` 里客户真填了的字段：正文复用「05 确认提交」那一章的四个区块 + 免责承诺 + 真实性确认，另补一块 **「5. 地址性质与场地证明」**（`basic.regAddressNature / workAddressNature / regFiles / workFiles` 在确认提交章没有渲染位，但办工商申报要看）；`var2` 里的 `setup` 与 `confirm.beneficiary` 在客户页面从来没有渲染位，不凭空展开。概览另给开户单编号 / 一企通方案号（`busUnionId`）/ 提交时间 / 经办手机，草稿单标「草稿（客户尚未确认提交）」
- 说明 三条边界：**完全不碰 localStorage**（真机脚本专门断言「一个键都没写」）、**不参与客户流程的步骤路由**（无 hash、不查单、不解锁步骤、不改地址栏）、**没有任何写操作**（附件只能预览/新窗口打开）
- 新增 `scripts/check-service-view.ts`（**50 项**）：参数解析、URL 组装（编码 / 尾斜杠 / 空 code）、`serviceFormOf` 取值（字符串 / 对象 / 缺 var2 / 坏 JSON / 不是申报表 / 缺字段补默认值 / 无 `fileUuid` 的旧附件丢掉）、七种失败文案 + 「路径没配 / 没编号不发请求」
- 更新 `scripts/check-copreg-entry.tsx`（62 → **73 项**）：客户页 `copreg.html` **不认** `?scbUuid=`；查看页带参数落只读视图、没参数提示「链接不完整」；`ServiceRecordContent` 在 SSR 里直接渲染（正文四块、客户填的值、地址卡、已提交/草稿徽标、只读无「修改」、勾选 disabled）；非只读的 `ReviewSection` 仍保留「修改」与跳转按钮（回归）
- 新增 `.mcp-work/verify-service-view.mjs`（**5 个场景 40 项**，真机 · 桩掉读接口）：`ok`（请求地址 = `{DOC_HOST}/xcx/yqt-co/subscribe/{scbUuid}?code=`、正文与概览、**没写任何 localStorage 键**、没有混进客户向导）、`draft`、`badcode`（400 + reasons「查询码无效或已过期」+ 提示索取新链接 + 重新读取）、`norecord`（没有 var2）、`nolink`（不带 scbUuid → 提示 + **一个请求都不发**）；`SHOT=1` 顺带存 `.mcp-work/service-view.png`
- 新增 `docs/copreg-service-view.md`（数据链路、参数与凭据、页面五条边界、渲染范围、代码位置、三层自检、怎么接到 ISP 后台）；更新 `AGENTS.md`（页面入口、§1.2 偏离清单、§3 文档清单与断言数）
- 说明 [!] **ISP 入口已接**（同一批改动）：`isp.ibanbu.com_V3/src/page/thirdparty/openAccount/detail.vue` 的「班步一企通」区块（`busUnionType == 1`）新增「客户申报资料 / 查看申报资料」→ `viewCopreg()`：现调 `POST /xcx/yqt-co/subscribe/generate-code` 拿查询码，打开 `{WWW_HOST}/OneBiz/copreg-view.html?scbUuid={detail.uuid}&code={查询码}`，**一律带 code**（不做「有没有 code」的区分，与旁边「编辑和分享」同一套凭据口径）；ISP 仓库的 `git-change.md` 也补了对应条目
- 回归：`npm run lint`、`npm run build` / `build:biz`（dist-www 与 dist-biz 都产出 `copreg-view.html` + 独立 `copregView-*.js` chunk ≈10 KB）、`npm run check:entry`（73 项）、全部 23 个 `scripts/check-*.ts`、`.mcp-work/verify-service-view.mjs`（5 场景 40 项）

### 多主体 · 跨标签页保存不再把主体列表写回旧快照（合并写）
- 修复 用户报的场景：「新开了一个申报资料填写页，然后在原网页切换了主体，新开的页面后面保存操作会不会数据混乱也切换到新主体保存了？」
  - **结论分两半**：① **数据不会串**：申报草稿写 `banbu-registration-{appId}`、保存/提交请求带的是本页那一刻的 `busUnionId`（各自主体的委托单号）—— 新开的那一页整个会话都钉在它启动时的主体上；② **但列表会被写乱**：整份主体列表是**一个** localStorage 键，旧口径 `writeApplicationsState(stored, apps)` 每次都把**本标签页手里那份（可能过期的）快照**整份盖上去 —— 原网页刚新增的主体凭空消失、刚切过去的当前主体被拽回来
- 新增 `applications.ts` 的 **`mergeApplicationsWrite(stored, mine, intent)`**（纯函数，带 `ApplicationsWriteIntent` / `MergedApplicationsWrite`）：以**存档里当前那份**为基准，只覆盖 `dirtyAppIds` 里「本标签页这次真改过的那几条」、按 `removedAppIds` 删、`activeAppId` **只有本标签页自己切过主体时才写**（`takeActiveAppId`）；列表为空时才回落到空白主体；`changed` 用 JSON 比对，没变就不落盘
- 调整 `App.tsx` 的落盘 effect 改成合并写，并用一个 `writeIntentRef`（`dirty` / `removed` / `takeActive`）在**动作发生时**打标：`updateActiveApp`、`handleRenameApplication` → dirty；`handleDiscardApplication` → removed；`handleSwitchApplication`、`handleConfirmRecordDeleted` → takeActive
- 修复 顺着这条口径补了两个漏标的地方（同一类 bug 的另外两个入口）：**新增主体**之后当前主体换成了新的那份、**作废的正好是当前主体**时会顺延到另一个主体 —— 这两处也要 takeActive，否则合并写会保留存档里的旧 `activeAppId`，刷新后落回上一个主体（作废非当前主体时**不**takeActive：别的标签页正指着的那个主体不该被这次落盘拽走）
- 更新 `scripts/check-applications.ts`（51 → **63 项**）：新增 12 条合并写断言（只覆盖改过的那几条、别人新增的不丢、别人改过的不被自己的旧值盖回、`activeAppId` 三种情形、removed 生效且不误删、没改动 `changed === false`、空列表回落空白主体）
- 新增 `.mcp-work/verify-cross-tab-apps.mjs`（**13 项**，真机 · 两个 target 共用一个 browser context）：B = 支付成功页新开的填报页（会话钉在自己的主体上）、A = 原页面**切主体 + 新增主体**，回到 B **保存草稿 + 改名** → 断言保存请求带的是 B 自己的 `busUnionId`、草稿写在自己的键下且没碰别人的草稿、B 的页面不跟着切、落盘后**3 个主体都在且 `activeAppId` 仍是 A 新增的那个**。把落盘退回旧口径（整份快照盖上去）跑一遍，最后三条会红（已实测），改回来 13 项全过
- 修复 `.mcp-work/verify-app-switch-isolation.mjs`（一直在挂，都是我前面批量改写留下的伤 + 与新步骤规则脱节）：① `Boolean(document.getElementById('btn-applications-switcher'),` 少一个右括号（页面端 eval 语法错，整个脚本一起死）；② `storageOf` 无条件 `localStorage.clear()` 而脚本是每次导航都注入的，②里切到 E 之后再进填报页就被抹回 D —— 改成「还没有主体列表才铺」；③ ②段改成走**现在唯一的入口**（`?open=fill-details` 深链）并把「切主体」的期望改成「落回各自的支付成功页」（第 5 步是会话级位置，不跟着串）。现在 **32 项通过 / 0 失败 / 1 跳过**
- 说明 [!] **发现一个待定缺口（没有动它）**：第 4 步服务群、第 6 步办理进度**从支付成功页都没有入口**（实测量过：已支付页只有「服务内容详情 / 微信扫码咨询 / 申报资料填报（已提交时是查看·修改）」四个按钮），而地址栏是**只读**的（hashchange 会被改回去）—— 于是「进度页 → 进入服务群」这条链的起点也够不着，`stepRoute.ts` 里「服务群仍在导航里可直达 / #progress 手敲可达」两句注释已经不成立。③服务群消息隔离那段因此**如实跳过并打印原因**，等入口定下来再恢复断言
- 更新 `docs/copreg-multi-app.md`：§三 改成「没有老存档迁移」（旧键不读不搬不删，`ensureApplicationsState` 只做收口/建空白），§四 补「跨标签页落盘是合并写」的口径与打标位置，§验收 的数量与场景重写（并记下③跳过）
- 回归：`npx tsc --noEmit`、`npm run build`、`npm run check:entry`（62 项）、`scripts/check-applications.ts`（63 项）、`.mcp-work/verify-cross-tab-apps.mjs`（13 项）、`verify-app-switch-isolation.mjs`（32 + 1 跳过）、`verify-multi-app.mjs`（18 项）、`verify-record-deleted.mjs`（14 项）

### 第 5 步 · 委托书打印把底部往上移（有的电脑会多印一页）
- 修复 委托书「直接打印」在部分电脑上会**多印一页**（白纸）：文档原本是 `.page{ width:210mm; min-height:297mm; padding:25mm 22mm }` —— 整页高度正好等于 A4，只要打印时勾了「页眉和页脚」（多占十几毫米）或浏览器把 mm→px 取整顶出去一丁点，内容就会被挤到第二页。现在页面高度改成 **285mm**（给整页留 12mm 余量）、**底部留白 25mm → 15mm**（底部往上移 10mm），签名块与日期也跟着收紧（`padding-top` 20→16mm、`margin-top` 8→6mm、`h1` 下边距 30→26mm）。「直接打印」与「下载模板」用的是同一份 HTML，两个入口一起生效
- 更新 `scripts/check-authorization-doc.ts`（16 → **19 项**）：新增三条版式断言 —— 高度留了余量（285mm 而不是 297mm）、底部留白是 15mm、签名块与日期跟着收紧
- 更新 `.mcp-work/verify-authorization-print.mjs`（12 → **15 项**）：新增 ④ 段，把 iframe 里那份委托书**真的打成 PDF**（`Page.printToPDF`，连 `displayHeaderFooter: true` 这种最容易溢出的情况一起量）→ 断言 **1 页**、整页高度 ≤290mm、底部留白 ≥10mm
- 说明 无头 Chrome 里旧样式也量出 1 页（4 种组合都是 1 页），所以这条是「降低在别的机器上溢出的概率」而不是复现某个确定的 bug —— 真机上确实遇到过多印一页；断言改成量「余量」比量「页数」更能盯住这类回归
- 更新 `docs/copreg-registration-fields.md`：1.4 节补「打印版式」说明（为什么高度小于 A4、底部留白多少）

### 第 5 步 · 「拟注册企业名称」改成只填字号（关键词），示例占位跟组织形式联动
- 调整 面板说明与占位文案（新增纯逻辑模块 `src/copreg/registration/nameHints.ts`）：这一格填的是**字号（关键词）**，不是完整公司名称 —— 说明改成「只需填写字号（关键词），例如「班步企程」，不必填写「上海班步企程服务有限公司」这样的完整名称——行政区划与组织形式由系统按所选组织形式补全。」，备选输入框与添加按钮统一成「备选字号 N」「添加备选字号（最多 9 个）」
- 调整 第一个输入框的示例占位**与企业组织形式联动**，并同时说清「填什么」与「会补成什么」：有限责任公司 →「只需填字号，例如：班步企程 → 上海班步企程服务有限公司」、股份有限公司 →「…服务股份有限公司」、合伙企业 →「…合伙企业（有限合伙）」、选「其他」时用用户自填的组织形式（没填 / 认不出的回落有限责任公司示例）；顺带去掉了占位末尾残留的 `*`
- 新增 `scripts/check-name-hints.ts`（**18 项**，纯逻辑）：说明里必须出现「只需填写字号（关键词）」与那个反例、四种组织形式的补全示例两两不同、「其他」用自填值、认不出/空值回落、占位组装（前缀、无 `*`、备选序号、上限 9）
- 更新 `scripts/check-copreg-entry.tsx`（56 → **62 项**）：第 5 步新增 6 条**渲染级**断言 —— 面板说明、首选占位（有限责任公司）、无残留星号、换股份有限公司/合伙企业/「其他」后占位跟着变
- 新增 `.mcp-work/shot-name-panel.mjs`：两个场景各截一张 02 区（有限责任公司 / 股份有限公司）→ `.mcp-work/name-panel-1.png` / `-2.png`，改版式或文案后直接看图核对
- 更新 `docs/copreg-registration-fields.md`：`basic.names` 的口径改成「只填字号（关键词）」并给出正例
- 说明 [!] **值本身没动**（用户填什么就存什么，不自动拼完整名称）：所以下游两处口径会跟着变 —— ① `conflicts.ts` 里「名称含『股份』/『合伙』但与组织形式不符」这两条判断，在只填字号时不会再触发；② 主体名（`deriveApplicationName` 用 `basic.names[0]`）与审阅页显示的就是字号。要不要在提交时按「行政区划 + 字号 + 组织形式」补全成完整名称，等产品定

### 第 3 步 · 支付成功页的「申报资料填报」改成新标签页打开（带 ?open=fill-details 深链）
- 调整 `AgreementAndPaymentStep.tsx`：支付成功界面办理清单第一项的两个按钮（「申报资料填报」/「查看/修改申报资料」，id `btn-fill-details-new-tab`）改成 **`window.open` 开新标签页**，当前页留在支付成功界面（填报要填很久，用户常要对着方案/协议/材料来回看）；**弹窗被浏览器拦掉时退回同页跳转**，按钮不会变成没反应。第 4 步服务群那边的入口仍是同页跳转
- 修复 **原网页也被跳走了**：`window.open(url, '_blank', 'noopener,noreferrer')` 带 `noopener` 时**浏览器一律返回 null**，于是「开成功」被当成「被弹窗拦截」、每次都走兜底的同页跳转。改成不带 `noopener`、开成功后再手动断 `opener`（同源页面风险可忽略），只有真返回 null 才退回同页
- 修复 自检也一起修：`.mcp-work/verify-paid-cta.page.js` 原来把 `window.open` **桩成返回一个假对象**，正好把这个真实行为盖住了。现在改成**包一层但真的调用它**（记 URL + 记返回值），点击也改成 CDP `Input.dispatchMouseEvent` 的**真实用户手势**（否则无头浏览器按弹窗拦截处理）。新增两条断言：`window.open 真开成功（返回值不是 null）`、`点击后当前页留在支付成功界面`；把 `noopener` 改回去跑一遍，这两条会红（已实测），改回来 10 项全过
- 新增 `stepRoute.ts` 的深链帮手（纯函数）：`openIntentOf(search)` 解析 `?open=fill-details`（**只认白名单值**）、`fillDetailsOpenUrl(origin, pathname)` 拼地址、`allowsFillDetailsIntent(orderPaid, detailsSubmitted)` 决定放不放行。为什么需要它：新标签页打开时**地址栏不指挥页面**（项目既有约定），光带 `#fill-details` 会按本地证据落回第 3 步 —— 所以用一个显式意图参数
- 新增 **步骤的「登记上限」**（`stepRoute.ts` 的 `MAX_PERSISTED_STEP = 'payment'` / `canPersistStep` / `clampPersistedStep`）：`fill_details`、`progress` 都是**会话级浏览位置，不写进主体记录** —— 「进度」最大到 `payment`，**第 5 步只能从支付成功页进**。`App.setCurrentStep` 分两路（超限的只 `setViewStep`，不落盘）；bootstrap 读存档时把写着 `fill_details` 的旧记录收口回 `payment`；切主体、提交完成都会清掉会话级浏览位置
- 新增 App bootstrap 处理：认到意图且**已付过款**（本地摘要 paid 或申报资料已提交）才把落点定到第 5 步（**只作为会话级浏览位置**）并解锁它；**没付过款一律忽略**（否则这条链接就成了绕过支付直接进填报页的入口）。参数**用过就抹掉**（挂载后 `replaceState` 只留 `{pathname}#fill-details`），刷新/转发出去的地址不会再跳步
- 更新 `scripts/check-step-route.ts`（35 → **54 项**）：新增 12 条深链断言（解析、白名单、畸形串不抛、地址与解析器往返一致、放行条件三态）+ 7 条登记上限断言（`fill_details` / `progress` 不落盘、超限收口回 payment、落点不超过第 3 步）
- 更新 `scripts/check-copreg-entry.tsx`（51 → **56 项**）：render 帮手支持 `search`，新增五条 —— 已支付 + `?open=fill-details` → 落第 5 步；未支付 + 同参数 → 忽略仍落第 3 步；不认识的意图值 → 忽略。；**深链只改会话级浏览位置、落盘步骤仍是 payment**；**存档里写着 `fill_details` 也收口回 payment**。（地址栏规范化与参数抹掉走 effect，SSR 看不到，由真机脚本覆盖）
- 更新 `.mcp-work/verify-paid-cta.mjs` / `.page.js`（0 → **12 项**）：桩掉 `window.open` 抓地址 → 断言当前页**没有**同页跳走、打开的地址带 `?open=fill-details`；再按该地址**另开一个 target**（同 context 共享 localStorage）断言真的落在填报页、**参数已抹掉且 hash 是 `#fill-details`**、底部「返回办理清单」能点回支付成功界面
- 修复 两个一直在挂的真机脚本（都是我前面批量改写时留下的伤）：`verify-submitted-landing.mjs` 的 `document.body.innerText.includes('支付成功 · 委托代办已生效',` 少一个右括号（页面端 eval 语法错）→ 3 场景全过；`verify-hash-ignored.mjs` 的垫片被插进 seed 数组的**每一项**里，导致「只有问卷」那一刻就先算出落点并落盘、后面补 report/record 再也进不去 → 改成所有 seed 写完后**统一跑一次**垫片 → 5 场景全过
- 调整 真机脚本进第 5 步的方式（8 个：conflicts / open-info / trustee / file-upload / authorization-print / address-nature-hints / wecom-qr / address-bar-readonly）：原来都是**点「申报资料填报」按钮**进填报页，现在那个按钮开新标签页、当前页不跳，改成按**同一条深链**（`?open=fill-details`）整页导航过去，等价于「在新标签页里打开填报页」。其中 `verify-wecom-qr.mjs` 要**保留场景原有的查询串**（`shareUserUuid` 是从 URL 读的，丢了就测不到专属码那条分支）；`verify-address-bar-readonly.mjs` 的第 ③④ 步改成「深链进填报页 → 点『返回办理清单』回支付页 → history.back() 不跳步」——它要验的「应用自己的跳步不压历史条目」与跳去哪一步无关，而原按钮已不再是会话内跳步
- 调整 所有真机脚本的查单桩补上 `scbUuid`（12 个脚本）：`scbUuid` 空现在表示「记录被后台删除」，桩里不写会走成另一条链路；`verify-entry-paid-query.mjs` 的 A/B 场景同步补上
- 更新 `docs/copreg-steps.md`（第 3 步补「新标签页 + 深链三条约束」）、`AGENTS.md` §1.2（偏离设计稿清单加一条）
- 回归：`npx tsc --noEmit`、`npm run build`、`npm run check:entry`（54 项）、`scripts/check-step-route.ts`（47 项）、`.mcp-work/verify-paid-cta.mjs`（12 项）、`verify-submitted-landing.mjs`（3 场景）、`verify-hash-ignored.mjs`（5 场景）
