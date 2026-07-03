# 变更记录

> 下次发布后清空此文件

## [开发中]

### 售前咨询页
- 新增 presales.html 入口页面，标题为"班步一企通 - 售前咨询"
- 新增 src/PresalesApp.tsx 售前页面组件，去除托管我的企业和注册新公司按钮
- 新增 src/presales.tsx React 入口文件

### 导航栏组件
- 优化 onOpenModal 改为可选属性，未传入时隐藏托管我的企业按钮

### 英雄区组件
- 优化 onOpenModal 改为可选属性，未传入时隐藏托管我的企业和注册新公司按钮

### 构建配置
- 新增 build.rollupOptions.input 多页面配置，参考 CAA 项目模式
