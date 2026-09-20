# 变更记录

> 下次发布后清空此文件

## [开发中]

### 企业注册申请页
- 调整 采集流程由双栏 14 环节改为「企业基本信息 → 股东及出资 → 企业主要人员 → 企业设立信息 → 委托书办理 → 信息确认并提交」六步
- 新增 步骤导航，桌面端放在侧栏、窄屏放在正文顶部并改用简称
- 新增 委托书办理章节，按「打印委托书 → 法定代表人签字并盖章 → 上传已签署文件」三步操作
- 新增 打印委托书，打印时只输出 A4 公文纸，隐藏导航、按钮与页脚
- 新增 下载委托书，生成可独立打开与另存的 A4 HTML 模板
- 新增 上传已签署扫描件，只保留一份，重新上传即替换
- 新增 委托书上的委托日期与签名一致留空白下划线，交由申请人线下手写
- 新增 确认页委托书办理面板，免申报与信息确认编号顺延为 06、07
- 新增 帮助弹窗的委托书办理段落与委托书规则行
- 新增 草稿暂存：首选 IndexedDB 存附件，不可用时退回 localStorage，两条路都失败时提示导出备份
- 新增 旧草稿迁移，兼容出资形式、设立期限的历史写法，并为缺失的委托书补空结构
- 新增 申请数据导出 JSON，导出文件同时带原始结构与扁平值
- 新增 手机号短信验证弹窗与演示提交，验证码仅在页面显示，不发起网络请求
- 新增 提交后把状态与提交时间一并写入草稿，刷新不丢失
- 新增 帮助弹窗，列出填写规则
- 新增 证件照片固定占位：自然人两张、企业一张，支持替换与删除，未归位附件单独列出
- 新增 附件本地读取为 dataURL，图片可页内预览，其余类型提供下载
- 新增 扁平值输出受托人姓名、受托人身份证号、委托书已上传、委托书份数
- 新增 校验失败自动跳到出错步骤并高亮对应字段，未点击提交前不提示错误
- 新增 有未暂存修改时离开页面给出二次确认
- 修复 导航完成标记复用了受提交门控的报错列表，导致只填一个字段就出现打勾、一点提交又整排退回未完成
- 删除 法人委托书只读预览与打印
- 删除 帮助弹窗的填写与暂存段落及其导出、导入草稿入口
- 删除 服务专员侧采集步骤（企业服务确认、经办人信息、选择申请机关、办理方式）与开发环境示例数据预填

### 企业注册申请模块
- 新增 authorization.tsx 承载委托书章节与打印、下载、上传三处副作用
- 新增 design.css 整段移植原型样式并统一字号字体栈，注册页不再引 index.css
- 新增 model.ts 收敛数据模型、选项常量、步骤标题与校验结果类型
- 新增 ui.tsx 抽出 Panel、Field、TextArea、ChoiceRow、ChoiceMulti、Checkbox、Dialog、PhotoSlots 等通用控件
- 新增 dialogs.tsx 抽出股东与人员记录编辑弹窗，支持复用已有人员时基础信息只读
- 新增 draft.ts 负责草稿存取、旧草稿迁移与导出
- 新增 flat.ts 生成「中文键 → 字符串」扁平视图并写入同源 localStorage，供代办协议等模板取用
- 新增 files.ts 负责附件读取、证件位置归位与未归位附件筛选
- 新增 review.tsx 信息确认步骤，空值统一显示为破折号
- 新增 help.tsx 帮助弹窗
- 调整 model、schema、ui、steps、dialogs、review、help、flat、draft 由 Tailwind 工具类改用 design.css 语义化类名
- 删除 agency-steps、attorney、dev-defaults、fields、flow、person-options 六个文件，逻辑并入上述模块

### 企业方案（copreg）
- 新增 第 2 步「确认并前往支付」接入 `POST /api/company-plan/confirm-proposal`，把第 1 步的两份存档（问卷 + 套餐加购、诊断返回）连同手机号验证信息一并提交，请求体分 formData / proposalResult / phoneNumber 三个字段
- 新增 formData.addons 由 id 字符串数组改为对象数组（id + 名称 + 实收价），服务端照这份清单就能出单，不必自己再查 id 对应的服务名与价格；套餐内含的服务项不上报，服务端按 tier 自己映射
- 新增 自选项取自方案页报价明细里 `addon-*` 的行项目，顺序固定（银行开户 → 税局开户 → 社保公积金开户），价格与页面显示的是同一个数
- 调整 本地存档 1b_copreg_plan_form 与请求体统一形状：PlanForm.addons 同样是对象数组，确认接口直接拿 PlanForm 当 formData 的类型，存下去什么就发什么
- 新增 proposalQuote.addonsOf 作为自选项唯一的派生入口（App 存盘与确认接口调同一个函数），derive 一次两边一致；normalizeAddons 负责存档读回
- 新增 旧存档兼容：addons 是 id 字符串数组的老存档也能读回，按目录补上名称与价格，认不出的 id 与重复项丢掉
- 新增 后端 proposalResult 标了 @NotNull，而第 1 步「诊断失败不拦人前进」是既有行为：诊断结果缺失时前端就地拦住、一个请求都不发，提示回第 1 步重新生成，不硬送 null 换回一句看不懂的 400
- 新增 确认接口失败拦在方案页：弹窗不关、按钮恢复可点、错误文案直接显示在弹窗里，可原地重试
- 新增 确认在途时手机号、验证码、获取验证码、取消与右上角关闭全部置灰，主按钮显示「提交中…」
- 新增 serviceConfirm.ts 承载请求体拼装与调用，端点由 React 层注入以便离线自检；套餐、加购统一取自方案页那份 activePlan，提交值与页面显示不会出现两套价格
- 删除 上一版临时加的 formData.services（套餐内含服务项、交付物清单）：改为只上报自选增值服务，由 addons 的对象数组承载
- 新增 scripts/check-service-confirm.ts 自检脚本，80 项断言覆盖请求体形状、addons 对象数组的内容与顺序（含 bundle 档 addons 恒空这一约定）、自选项派生与存档往返（含旧存档迁移）、存档与请求同源、深拷贝、诊断结果缺失时不发请求、端点未配置与五类失败文案
- 调整 apiClient 的 postJson 支持自定义超时，确认接口用 15s 而不是大模型接口的 60s
- 调整 确认接口归入企业方案服务：新增 CONFIRM_PROPOSAL_PATH（可用 VITE_CONFIRM_PROPOSAL_PATH 覆盖），与填充 / 诊断共用 VITE_COMPANY_PLAN_HOST；删掉上一轮占位用的 SERVICE_CONFIRM_SAVE_PATH
- 更新 docs/copreg-plan-api.md，补第三节「确认并前往支付」（含 addons 对象数组字段表与 proposalResult 非空的处理）并把后续章节顺延

### 校验脚本
- 调整 scripts/check-registration-schema.ts 改为直接调用纯函数的自检脚本，覆盖六个步骤的校验规则与扁平值派生

### 微信支付模块
- 新增 src/payment/ 独立模块，封装下单、出码、轮询、终态全链路，待确定调用位置后接入
- 新增 model.ts 承载数据模型与全部纯函数，零依赖零 DOM，可直接用 tsx 运行
- 新增 client.ts 为全模块唯一发起请求处，端点由调用方注入以便离线测试
- 新增 qrcode.ts 将 code_url 编码为 SVG path，组件无需 dangerouslySetInnerHTML
- 新增 useWechatNativePay.ts 无头 hook，含状态机、递归轮询、倒计时与回前台补查
- 新增 PayQrCode.tsx 零样式二维码组件，同时支持后端返回 codeUrl 与 qrImageUrl
- 新增 下单只在调用方显式触发时执行，避免 React StrictMode 双跑 effect 产生两个订单
- 新增 轮询网络抖动只置提示而不改状态，避免用户扫码时二维码被卸载
- 新增 服务端终态优先于本地倒计时，已支付订单不会被显示成已过期
- 新增 接口路径留空时抛未配置错误并进入未开通态，不做静默降级
- 新增 scripts/check-wechat-pay.ts 自检脚本，131 项断言覆盖解析、状态映射、退避与超时
- 新增 二维码矩阵与 SVG path 的往返一致性断言，确保生成的码可扫
- 新增 uqr 依赖用于生成二维码，相较于 qrcode 不引入 yargs 等命令行解析依赖
- 修复 code_url 校验把 host 写死成 wxpay，导致合单支付的 pay.weixin.qq.com 形态被误拒
- 调整 校验改为只认 weixin 私有协议与 /bizpayurl 路径，host 与查询参数名不再参与判断
- 修复 nextPollDelay 取数组元素在 noUncheckedIndexedAccess 下类型为 undefined，改为夹取并显式兜底

### 配置
- 新增 config/api.ts 的下单与查单路径常量及期望的请求响应字段，路径留空待接口方确认
- 新增 config/api.ts 的短信服务、腾讯行为验证码与企业方案服务三组配置
- 新增 vite.config.ts 的 copreg 多页面入口
- 更新 .gitignore 忽略 node_modules.bak/
- 删除 .env.example 并移除 .gitignore 中对应的例外，各服务默认值已内置于 config/api.ts

### 文档
- 新增 docs/copreg-plan-api.md 与 docs/copreg-registration-fields.md
