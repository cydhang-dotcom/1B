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

### 售前咨询页
- 修复 客服二维码兜底图由根相对路径改为绝对地址，页面被部署到子路径或别的域名下打开时不再失效
- 新增 兜底图来源注释，说明接口取不到专属企微码时会回落到该图，不会把二维码留成空白

### 文档
- 更新 docs/copreg-plan-api.md 与 docs/copreg-registration-fields.md，反映并入后的流程与字段

### 校验脚本
- 新增 npm run check:entry，用 vite SSR 把真实的 App 组件树在 Node 里渲染一次，只替换本地存档来验证首屏落点
- 新增 scripts/check-copreg-entry.tsx，11 项断言覆盖凭据有效、凭据过期、凭据与存档不配套、老存档等落点
- 调整 scripts/check-service-confirm.ts 断言数由 80 增至 121
- 删除 scripts/check-registration-schema.ts，随注册页一并并入

### 配置
- 调整 vite.config.ts 移除 registration 入口
- 新增 package.json 的 check:entry 脚本
- 更新 .gitignore 忽略 .mcp-work/
- 删除 src/assets/customer-service-qr.png，该文件从未被任何代码引用
