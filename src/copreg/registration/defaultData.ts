/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RegistrationFullForm } from './types';

export const STORAGE_KEY = 'banbu-registration-20260913-v1';

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function createBlankForm(): RegistrationFullForm {
  return {
    id: uid(),
    status: 'draft',
    savedAt: null,
    submittedAt: null,
    submissionPhone: '',
    basic: {
      org: '有限责任公司',
      orgOther: '',
      intro: '拟设立有限责任公司，开展全链路数字化与跨境商贸服务。',
      service: '主营数字化渠道运营、供应链协同履约及相关技术咨询服务。',
      scope: '',
      capital: '100',
      expert: false,
      names: ['', '', ''],
      regAddress: '',
      regRecommend: false,
      regAddressNature: '租赁用房',
      regFiles: [],
      workAddress: '',
      workRecommend: false,
      workAddressNature: '商业租赁',
      workFiles: [],
      board: '不设董事会',
      directors: '',
      singleDirector: '由总经理代行职务（不设董事）',
      singleSupervisor: '不设监事',
      unanimous: true,
    },
    people: {},
    shareholders: [],
    roles: [],
    setup: {
      establishmentType: '发起设立',
      board: '不设董事会',
      directors: '',
      singleDirector: '由总经理代行职务（不设董事）',
      supervisorBoard: '不设监事会',
      supervisors: '',
      singleSupervisor: '不设监事',
      unanimous: true,
      term: '长期',
      termYears: '',
      employees: '5',
    },
    authorization: {
      trusteeName: '',
      trusteeIdNumber: '',
      entrustDate: new Date().toISOString().split('T')[0],
      files: [],
    },
    confirm: {
      exemption: false,
      beneficiary: '',
      files: [],
      accurate: false,
    },
  };
}

// Generates high-quality compliant demo form data initialized with practical values
export function createCompliantDemoForm(contactName = '林楚天', contactPhone = '13800138000'): RegistrationFullForm {
  const p1Id = 'person-1';
  const p2Id = 'person-2';
  const p3Id = 'person-3';

  return {
    id: uid(),
    status: 'draft',
    savedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    submittedAt: null,
    submissionPhone: '',
    basic: {
      org: '有限责任公司',
      orgOther: '',
      intro: '拟设立一家有限责任公司，主营跨境电商与海外品牌出海，依托数字化独立站与第三方跨境贸易平台，面向全球市场提供高性价比优质产品。',
      service: '主营海外仓配履约、跨境独立站全渠道运营、供应链数字化协同及品牌海外推广咨询服务。',
      scope: '互联网销售（除销售需要许可的商品）；货物进出口；技术进出口；供应链管理服务；国内贸易代理；国际货物运输代理；信息技术咨询服务；软件开发；数字内容制作服务（不含出版）。',
      capital: '100',
      expert: false,
      names: [
        '云帆盛景电子商务（深圳）有限公司',
        '帆扬出海数字科技（深圳）有限公司',
        '云帆联动供应链（深圳）有限公司'
      ],
      regAddress: '深圳市南山区粤海街道高新南四道18号创维半导体设计大厦西座8层806室',
      regRecommend: false,
      regAddressNature: '租赁用房',
      regFiles: [
        {
          id: 'file-reg-proof-1',
          name: '创维半导体设计大厦商业房屋租赁合同及场地证明.pdf',
          size: 1420500,
          type: 'application/pdf',
          slot: 'regAddressProof',
          data: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCg==',
        },
      ],
      workAddress: '深圳市南山区粤海街道高新南四道18号创维半导体设计大厦西座8层806室',
      workRecommend: false,
      workAddressNature: '商业租赁',
      workFiles: [
        {
          id: 'file-work-proof-1',
          name: '办公场所租赁协议与使用证明.pdf',
          size: 985200,
          type: 'application/pdf',
          slot: 'workAddressProof',
          data: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCg==',
        },
      ],
      board: '不设董事会',
      directors: '',
      singleDirector: '由总经理代行职务（不设董事）',
      singleSupervisor: '不设监事',
      unanimous: true,
    },
    people: {
      [p1Id]: {
        id: p1Id,
        name: contactName || '林楚天',
        phone: contactPhone || '13800138000',
        email: 'chutian.lin@yunfancross.com',
        education: '大学本科',
        address: '深圳市南山区粤海街道蔚蓝海岸社区3栋1202室',
        files: [
          {
            id: 'file-p1-front',
            name: `${contactName || '林楚天'}_身份证人像面.jpg`,
            size: 852400,
            type: 'image/jpeg',
            data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190"><rect width="300" height="190" rx="10" fill="%23E2E8F0"/><circle cx="80" cy="75" r="30" fill="%2394A3B8"/><path d="M40 145 c0 -30 80 -30 80 0" fill="%2394A3B8"/><rect x="150" y="55" width="110" height="12" rx="4" fill="%2394A3B8"/><rect x="150" y="80" width="90" height="12" rx="4" fill="%23CBD5E1"/><rect x="150" y="105" width="120" height="12" rx="4" fill="%23CBD5E1"/><text x="150" y="145" font-size="14" font-family="sans-serif" fill="%2364748B">身份证人像面</text></svg>',
            slot: 'idFront',
          },
          {
            id: 'file-p1-back',
            name: `${contactName || '林楚天'}_身份证国徽面.jpg`,
            size: 914200,
            type: 'image/jpeg',
            data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190"><rect width="300" height="190" rx="10" fill="%23E2E8F0"/><circle cx="80" cy="65" r="24" fill="%23B45309" fill-opacity="0.3"/><rect x="70" y="110" width="160" height="12" rx="4" fill="%2394A3B8"/><rect x="70" y="132" width="130" height="12" rx="4" fill="%23CBD5E1"/><text x="150" y="70" font-size="14" font-family="sans-serif" fill="%2364748B">中华人民共和国居民身份证</text></svg>',
            slot: 'idBack',
          },
        ],
      },
      [p2Id]: {
        id: p2Id,
        name: '张宇哲',
        phone: '13911223344',
        email: 'yuzhe.zhang@yunfancross.com',
        education: '硕士研究生',
        address: '深圳市福田区莲花街道紫荆苑2栋501室',
        files: [
          {
            id: 'file-p2-front',
            name: '张宇哲_身份证人像面.jpg',
            size: 798200,
            type: 'image/jpeg',
            data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190"><rect width="300" height="190" rx="10" fill="%23E2E8F0"/><circle cx="80" cy="75" r="30" fill="%2394A3B8"/><path d="M40 145 c0 -30 80 -30 80 0" fill="%2394A3B8"/><text x="150" y="95" font-size="14" font-family="sans-serif" fill="%2364748B">身份证人像面</text></svg>',
            slot: 'idFront',
          },
          {
            id: 'file-p2-back',
            name: '张宇哲_身份证国徽面.jpg',
            size: 831200,
            type: 'image/jpeg',
            data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190"><rect width="300" height="190" rx="10" fill="%23E2E8F0"/><text x="80" y="95" font-size="14" font-family="sans-serif" fill="%2364748B">身份证国徽面</text></svg>',
            slot: 'idBack',
          },
        ],
      },
      [p3Id]: {
        id: p3Id,
        name: '陈美仪',
        phone: '13799887766',
        email: 'meiyi.chen@yunfancross.com',
        education: '大学本科',
        address: '深圳市南山区蛇口街道海昌街新街大厦703室',
        files: [
          {
            id: 'file-p3-front',
            name: '陈美仪_身份证人像面.jpg',
            size: 812300,
            type: 'image/jpeg',
            data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190"><rect width="300" height="190" rx="10" fill="%23E2E8F0"/><circle cx="80" cy="75" r="30" fill="%2394A3B8"/><text x="150" y="95" font-size="14" font-family="sans-serif" fill="%2364748B">身份证人像面</text></svg>',
            slot: 'idFront',
          },
          {
            id: 'file-p3-back',
            name: '陈美仪_身份证国徽面.jpg',
            size: 840500,
            type: 'image/jpeg',
            data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190"><rect width="300" height="190" rx="10" fill="%23E2E8F0"/><text x="80" y="95" font-size="14" font-family="sans-serif" fill="%2364748B">身份证国徽面</text></svg>',
            slot: 'idBack',
          },
        ],
      },
    },
    shareholders: [
      {
        id: 'share-1',
        type: '自然人',
        personId: p1Id,
        name: '',
        code: '',
        ratio: '70',
        amount: '70',
        method: ['货币'],
        files: [],
      },
      {
        id: 'share-2',
        type: '自然人',
        personId: p2Id,
        name: '',
        code: '',
        ratio: '30',
        amount: '30',
        method: ['货币'],
        files: [],
      },
    ],
    roles: [
      {
        id: 'role-1',
        personId: p1Id,
        roles: ['法定代表人', '总经理', '联系人'],
      },
      {
        id: 'role-2',
        personId: p2Id,
        roles: [],
      },
      {
        id: 'role-3',
        personId: p3Id,
        roles: ['财务负责人'],
      },
    ],
    setup: {
      establishmentType: '发起设立',
      board: '不设董事会',
      directors: '',
      singleDirector: '由总经理代行职务（不设董事）',
      supervisorBoard: '不设监事会',
      supervisors: '',
      singleSupervisor: '不设监事',
      unanimous: true,
      term: '长期',
      termYears: '',
      employees: '5',
    },
    authorization: {
      trusteeName: contactName || '林楚天',
      trusteeIdNumber: '440301199308123418',
      entrustDate: new Date().toISOString().split('T')[0],
      files: [
        {
          id: 'auth-file-1',
          name: '法定代表人委托书_签字盖章扫描件.pdf',
          size: 1420500,
          type: 'application/pdf',
          data: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL0xlbmd0aCA1IDAgUiAvRmlsdGVyIC9GbGF0ZURlY29kZSA+PgpzdHJlYW0KeAEr5HIK4TKyVDAwM1EwMjC0VDBQMzSzNDAwNzQzNlAwUjA1AQEALeQGMQplbmRzdHJlYW0KZW5kb2JqCg==',
        },
      ],
    },
    confirm: {
      exemption: true,
      beneficiary: '',
      files: [],
      accurate: true,
    },
  };
}
