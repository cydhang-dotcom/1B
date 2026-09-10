/**
 * 《金桥镇新企业注册流程》全部 14 个环节，逐条取自 PDF 第 2 页「办理环节一览及关键控制点」。
 *
 * 用途：页面上的流程总览据此渲染，让企业看清本页采集的是哪几个环节、
 * 其余环节由金桥镇服务专员在「上海企业登记在线」平台内办理。
 */
export type FlowOwner = '企业' | '金桥' | '无需办理';

export type FlowStep = {
  /** PDF 中的环节序号 */
  step: number;
  title: string;
  /** 关键控制点 */
  keyPoint: string;
  owner: FlowOwner;
  /** 对应页面上的步骤 key，用于总览里跳转 */
  formKey?: string;
};

export const FLOW_STEPS: FlowStep[] = [
  {
    step: 1,
    title: '登录平台',
    keyPoint: '以金桥镇身份登录，选择「开办」→「企业」',
    owner: '金桥',
  },
  {
    step: 2,
    title: '名称申报',
    keyPoint: '选择字号、行业表述、组织形式，系统自动比对名称',
    owner: '企业',
    formKey: 'basic',
  },
  {
    step: 3,
    title: '经办人信息',
    keyPoint:
      '须填写金桥镇指定人员；经办人类型选「经营主体登记注册代理人」，「是否代理机构」选「否」',
    owner: '金桥',
    formKey: 'agent',
  },
  {
    step: 4,
    title: '选择申请机关',
    keyPoint: '中国（上海）自由贸易试验区，新金桥路 27 号 14 号楼',
    owner: '金桥',
    formKey: 'authority',
  },
  {
    step: 5,
    title: '住所信息',
    keyPoint: '集中登记地址，须先取得租赁合同编号；邮编 201206',
    owner: '企业',
    formKey: 'address',
  },
  {
    step: 6,
    title: '联系与章程信息',
    keyPoint: '注册客户联系电话、章程决议日期、经营范围',
    owner: '企业',
    formKey: 'charter',
  },
  {
    step: 7,
    title: '股东及出资信息',
    keyPoint: '企业法人股东也须填写移动电话，一般填写法人手机号',
    owner: '企业',
    formKey: 'shareholders',
  },
  {
    step: 8,
    title: '人员信息',
    keyPoint: '按系统要求填写法定代表人、董事、监事、财务负责人',
    owner: '企业',
    formKey: 'personnel',
  },
  {
    step: 9,
    title: '受益人信息',
    keyPoint: '按系统要求填写受益所有人',
    owner: '企业',
    formKey: 'beneficiaries',
  },
  {
    step: 10,
    title: '办理方式',
    keyPoint: '选择全程网办下的「需要材料辅导」，辅导材料须先预审',
    owner: '金桥',
    formKey: 'method',
  },
  {
    step: 11,
    title: '刻章信息',
    keyPoint:
      '经办人上传金桥镇经办人信息，须提供法人委托书（可在本页查看并打印签署）；材料限 jpg、单张不超过 500K',
    owner: '金桥',
    formKey: 'attorney',
  },
  {
    step: 12,
    title: '材料预览与提交',
    keyPoint: '下载预览文件（特别是公司章程）核对无误后再提交',
    owner: '金桥',
  },
  {
    step: 13,
    title: '其他联办事项',
    keyPoint: '五险一金、涉税事项及银行开户预约本次无需填报',
    owner: '无需办理',
  },
  {
    step: 14,
    title: '办理结果查询',
    keyPoint: '经营主体登记及企业印章刻制均「已办结」后，及时反馈金桥对接人',
    owner: '金桥',
  },
];

/** 企业侧需要填写的环节数，用于总览文案 */
export const ENTERPRISE_FLOW_COUNT = FLOW_STEPS.filter((item) => item.owner === '企业').length;
