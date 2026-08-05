# 变更记录

> 下次发布后清空此文件

## [开发中]

### 首页 & 售前咨询页
- 重构 字体加载改为本地 FontSource 包，移除 Google Fonts 外部依赖
- 新增 src/fonts.css 统一字体入口文件
- 新增 @fontsource/inter 和 @fontsource/noto-serif-sc npm 依赖

### 售前咨询页
- 新增 售前咨询页面并配置多页面构建

### 首页
- 调整 按钮文案"托管我的企业"改为"获取服务"并新增右箭头图标
- 调整 按钮文案"注册新的公司"改为"AI注册向导"并新增AI图标

### 弹窗页
- 新增 二维码根据 shareUserUuid 参数动态调用接口获取
- 新增 二维码 loading 状态和 AbortController 请求管理
- 调整 API 地址抽取为环境变量配置项

### 配置
- 新增 src/config/api.ts 统一管理 API 和文档服务地址
- 新增 .env.development 和 .env.production 区分环境
- 更新 .env.example 补充 API 配置项
- 优化 构建脚本适配跨平台部署路径
