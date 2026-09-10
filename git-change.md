# 变更记录

> 下次发布后清空此文件

## [开发中]

### 新企业注册信息采集页
- 新增 新企业注册信息采集页及 registration.html 多页面构建入口
- 新增 双栏步骤导航（企业侧/服务专员侧），企业侧按填写进度逐级解锁
- 新增 完整办理流程总览，展开可见 14 个环节并标注责任方与关键控制点
- 新增 名称申报、住所信息、联系与章程信息、股东及出资信息、主要人员信息、受益所有人信息等企业侧采集步骤
- 新增 企业服务确认、经办人信息、选择申请机关、办理方式等服务专员填写步骤
- 新增 法人委托书只读预览与打印，内容由经办人信息带出
- 新增 提交前信息确认与填写完成汇总页
- 新增 zod 表单校验与跨步骤字段定位，校验失败自动跳到出错步骤
- 新增 开发环境示例数据预填，生产构建回到空表单
- 新增 scripts/check-registration-schema.ts 数据结构校验脚本
- 新增 打印样式，打印时仅输出法人委托书本体并按 A4 排版
- 新增 react-hook-form、zod、@hookform/resolvers 依赖
- 新增 SERVICE_CONFIRM_SAVE_PATH 企业服务确认独立保存接口路径（待接口方确认）
- 调整 提交接口尚未接入，当前仅做前端校验与汇总，不发起网络请求

### 首页
- 调整 AI 注册向导按钮跳转地址改为绝对地址 https://www.ibanbu.com/CAA

### 售前咨询页
- 调整 AI 注册向导按钮跳转地址改为绝对地址 https://www.ibanbu.com/CAA

### 导航栏
- 调整 桌面端与移动端 AI 注册向导链接改为绝对地址 https://www.ibanbu.com/CAA

### 部署配置
- 新增 DEPLOY_TARGET=biz 时以域名根目录为 base 打包，产物输出至 dist-biz
- 新增 npm run build:biz 脚本
- 调整 默认构建产物目录由 dist 改为 dist-www
- 新增 deploy.sh 支持 biz.ibanbu.com 测试/预发/生产三环境部署
- 新增 vpn.sh VPN 连接管理模块
- 新增 npm run deploy:all 一键执行 www 与 biz 两条部署流程
- 调整 本地部署脚本拷贝源由 dist 改为 dist-www
- 更新 .gitignore 忽略 dist-www/ 与 dist-biz/
