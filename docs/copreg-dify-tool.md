# 把 #fill-details 的接口导入 Dify（Swagger API 工具）

第 5 步「企业注册申报资料填报」（`#fill-details`）的那几个接口，整理成了一份 OpenAPI 3.1.0 的
YAML，可以直接粘进 Dify 的**自定义工具（Swagger API）**：

| | |
|---|---|
| 接口文件 | [`docs/openapi/copreg-fill-details.yaml`](openapi/copreg-fill-details.yaml) |
| 契约自检 | `npx tsx scripts/check-openapi-fill-details.ts`（59 项：路径 / 字段名 / 选项表与代码逐条对齐） |
| 四件事 | 保存草稿 / 提交申请（**主**）、上传图片 / 附件（**主**）、读经办人、按开户单读回申报表（后两个只读，可不要） |
| 口径来源 | `src/config/api.ts`、`registration/openInfo.ts`、`utils/fileUpload.ts`、`registration/jingbanren.ts`、`registration/subscribeQuery.ts` |

---

## 一、导入步骤

1. Dify → **集成 / Integrations → 工具（Tools） → 自定义（Custom） → 创建自定义工具**；
2. 名称 / 图标随便填（建议「copreg 申报资料」）；
3. 把 [`docs/openapi/copreg-fill-details.yaml`](openapi/copreg-fill-details.yaml) 的**全文粘进 Schema 编辑框**
   （也可以填一个能访问到这份 YAML 的 URL 让它去拉）；
4. **认证方式选「无」** —— 这一族接口走内网网关，当前不带 token。以后接口方要 token，用 Dify 的
   「请求头 / Request Header」方式加，YAML 不用改；
5. 保存后回到 Agent / 工作流，勾选需要的工具。只想做「改数据 + 传图」就勾前两个：
   `saveSubscribeOpenInfo`、`uploadSubscribeFile`。

导入后 Dify 会按下面这样生成工具（用来核对导入结果对不对）：

| operationId | 方法 / 地址（基地址 = `servers[0].url`） | Dify 里的参数 |
|---|---|---|
| `saveSubscribeOpenInfo` | `POST {基地址}/v1/xcx/yqt-co/subscribe/open-info` | `busUnionId`(文本·必填)、`var2`(文本·必填)、`savaType`(文本·必填) |
| `uploadSubscribeFile` | `POST {基地址}/zuul/v1/xcx/yqt-co/subscribe/upload/file` | `file`(**文件**·必填) |
| `getSubscribeHandler` | `GET {基地址}/v1/xcx/yqt-co/subscribe/handler` | `busUnionId`(query·必填) |
| `getSubscribeDetail` | `GET {基地址}/v1/xcx/yqt-co/subscribe/{scbUuid}` | `scbUuid`(路径·必填)、`code`(query·选填) |

### 换环境：只改 `servers[0].url`

**Dify 的解析器只读 `servers` 的第一条**（`servers[0].url`），所以换环境就是换这一条：

| 环境 | `servers[0].url` | 代码里的对应值 |
|---|---|---|
| 测试（文件里现在写的就是它） | `http://testv3001.yowits.net` | `.env.development` 的 `VITE_DOC_HOST` 去掉结尾 `/v1` |
| 生产 | `https://yqt.ibanbu.com` | `.env.production` 的 `VITE_DOC_HOST` 去掉结尾 `/v1` |

⚠️ `open-info` 是**会写库**的接口（草稿与提交都覆盖服务端那份 `var2`），**别拿生产地址试导入**。
文件里 `servers[1]` 已经把生产地址写好了，注释也标了，改顺序或改第一条即可。

注意基地址是**站点根（不带 `/v1`）**，所以路径里带着 `/v1/...`；而上传那条自带 `zuul/v1` 前缀
（上传走 zuul 网关，与普通接口的 `/v1/...` 不是一个前缀）—— 这两条别「顺手统一」。

---

## 二、四条接口各自是什么

### 1. `saveSubscribeOpenInfo` —— 保存草稿 / 提交申请（要改数据就用它）

`POST {站点根}/v1/xcx/yqt-co/subscribe/open-info`，请求体**恰好三个字段**：

| 字段 | 说明 |
|---|---|
| `busUnionId` | 委托单号（第 1 步生成需求方案返回的 `recordId`）。**必给**，服务端靠它认这笔开户业务；没有就先去第 1 步生成方案，不要自己编 |
| `var2` | **申报表快照的 JSON 字符串**（对象 `JSON.stringify` 之后的文本）。服务端原样存进开户单的 `openAccApply.var2` |
| `savaType` | `0` = 临时保存（保存草稿）、`1` = 保存（确认并提交申请）。**字段名就是这个拼写**（后端 DTO 原文），不是 `saveType` |

响应体**不解析：HTTP 2xx 即成功**；非 2xx 时把响应体里的 `message` / `reasons[].message` 当错误原因。

`var2` 的结构（完整定义在 YAML 的 `components.schemas.RegistrationFormSnapshot`，字段与
`src/copreg/registration/types.ts` 一致）：

- 顶层：`id` / `status`(`draft`|`submitted`) / `savedAt` / `submittedAt` / `submissionPhone` /
  `completionPercent`(0~100，= 已完善卡片数 ÷ 10 张卡片) / `basic` / `people` / `shareholders` /
  `roles` / `authorization` / `confirm`；
- 附件行只放上传接口给的 `fileUuid`，**不传文件内容、也不传地址**（地址会过期，现拼
  `{DOC_HOST}/doc/uuid/{fileUuid}/get`）；
- `capital` / `ratio` / `amount` / `directors` 都是**字符串数字**（`"100"` 而不是 `100`）。

### 2. `uploadSubscribeFile` —— 上传图片 / 附件

`POST {站点根}/zuul/v1/xcx/yqt-co/subscribe/upload/file`，`multipart/form-data`，**字段名固定 `file`**，
一次一个文件（多文件就多调几次）。成功后返回 `{ fileUuid, fileName }`，把这个 `fileUuid` 写进 `var2`
里对应附件行的 `fileUuid`。

附件行的 `slot`（附件位）取值：人员证件 `idFront` / `idBack`、营业执照 `license`、
注册场地 `regAddressProof`、经营场地 `workAddressProof`；委托书与确认页的附件不带 `slot`。

> ⚠️ **Dify 里这个参数是「文件」类型**：`format: binary` 会被 Dify 认成 FILE 参数，值只能是
> 用户上传的文件（或上游节点产出的文件），**LLM 自己变不出一个文件**。所以典型编排是：
> 用户在表单/对话里上传图片 → 那个 file 变量喂给 `uploadSubscribeFile` → 拿 `fileUuid` → 再拼
> `var2` 调 `saveSubscribeOpenInfo`。

### 3. `getSubscribeHandler` —— 读「一窗通」经办人（只读）

`GET {站点根}/v1/xcx/yqt-co/subscribe/handler?busUnionId=…` → `{ handName, handIdNumber }`。
委托书上的「受托经办人姓名 / 身份证号」由服务端下发（要与「一窗通」公章经办人一致），用户不手填。
读不到时**不要把已有值抹成空**，提示联系企服专员。

### 4. `getSubscribeDetail` —— 按开户单编号读回申报表（只读）

`GET {站点根}/v1/xcx/yqt-co/subscribe/{scbUuid}[?code=…]` —— 客户提交的申报表在响应的
`openAccApply.var2` 里（字符串时 parse，已经是对象就直接用）。`code` 是一次性查看码，无效时是
`400` + `{"reasons":[{"message":"查询码无效或已过期"}]}`。

做「先读回来 → 改 → 再提交」的 Agent 时这一条有用：读出来的是**整份快照**，改完原样写回，
但**写回用的是 `busUnionId`**（不是这里的 `scbUuid`），`savaType` 传 `1`。

---

## 三、踩过的坑（Dify 侧）

1. **`var2` 必须是字符串**。Dify 里它是「文本」参数；如果让 LLM 直接传了个对象，Dify 会
   `str(dict)` 出来一串**单引号**的假 JSON，服务端 Jackson 按 `String var2` 反序列化会 400。
   给 Agent 的提示里写死：「`var2` 是 `JSON.stringify` 之后的字符串」。YAML 里 `var2` 的说明
   已经带了一份可照抄的最小 JSON 样例 —— Dify 会把这段说明当参数描述喂给 LLM。
2. **基地址只看 `servers[0]`**，第二条（生产）只是个备查注释；列表顺序就是实际生效顺序。
3. **一次只传一个文件**：Dify 把 `format: binary` 当单文件参数；想多文件得调多次（前端也是串行）。
4. **别把响应体当成功判据**：Dify 的 API 工具在 `status >= 400` 时抛
   `Request failed with status code NNN and <body>`，那句报错会进 LLM 上下文；
   `open-info` 的 2xx 里也可能是个业务信封，别只看 `code`。
5. **超时**：Dify 的 API 工具默认读超时 60s（`API_TOOL_DEFAULT_READ_TIMEOUT`），与上传接口
   自己的 60s 同档；批量上传大图慢时要么加这个环境变量，要么在编排里分批。
6. **看图片**：拿 `fileUuid` 拼 `{DOC_HOST}/doc/uuid/{fileUuid}/get`（生产
   `https://yqt.ibanbu.com/v1/doc/uuid/{fileUuid}/get`）—— 与上传接口**不是同一个 host**。

## 四、手工验一条（不经过 Dify）

```bash
# 1) 上传一张图，记下返回的 fileUuid
curl -sS -F 'file=@./idcard.png' \
  http://testv3001.yowits.net/zuul/v1/xcx/yqt-co/subscribe/upload/file

# 2) 把 var2 填成 JSON 字符串（注意是字符串，不是对象），存一份草稿
curl -sS -X POST http://testv3001.yowits.net/v1/xcx/yqt-co/subscribe/open-info \
  -H 'Content-Type: application/json' \
  -d '{
        "busUnionId": "第 1 步的委托单号",
        "savaType": "0",
        "var2": "{\"status\":\"draft\",\"completionPercent\":0,\"basic\":{\"org\":\"有限责任公司\",\"names\":[\"班步企程\"]},\"people\":{},\"shareholders\":[],\"roles\":[],\"authorization\":{\"files\":[]},\"confirm\":{\"accurate\":false}}"
      }'

# 3) 读回来看看（服务人员那条链路；scbUuid 是开户单编号）
curl -sS 'http://testv3001.yowits.net/v1/xcx/yqt-co/subscribe/<scbUuid>'
```

---

## 五、改口径时的清单

改到下面任何一处，**回来改 YAML，再跑一次自检**（`scripts/check-openapi-fill-details.ts` 会逐条告诉你哪条对不上）：

| 改了代码里的 | 要同步 |
|---|---|
| `config/api.ts` 的四个端点默认值 | YAML 里对应 path（注意 `/v1` 与 `zuul/v1` 的差别） |
| `openInfo.ts` 的请求体字段 / `savaType` 取值 | `requestBody.properties` 与 `enum` |
| `fileUpload.ts` 的字段名 / 响应字段 | 上传那条的 `multipart` schema 与响应 schema |
| `registration/types.ts` 的表单结构 | `components.schemas.RegistrationFormSnapshot` 及各子 schema |
| 地址性质（`addressNatureHints.ts`）、附件位、出资形式、角色 | 对应 `enum` 与 `var2` 说明里的取值清单 |
