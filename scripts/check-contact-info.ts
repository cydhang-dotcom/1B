/**
 * `#paid` 头部「经办人姓名 / 经办联系电话」取值口径的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-contact-info.ts
 *
 * 用户报的是：「如果后面填写了联系人信息，就取联系人的姓名和电话」——
 *   1. 联系人 = 申报资料「03 主要人员」里角色带「联系人」的那个人（同一个人可兼多角色）；
 *   2. **没有联系人就不拿法定代表人顶替**（联系人未必是法定代表人）；
 *   3. 联系人填了哪一项就覆盖哪一项，没填的那项退回订单上查单带回来的值，都没有才显示破折号；
 *   4. 草稿可能来自旧版本 / 被手改坏：认不出的草稿一律当「没填」，不许抛。
 */
import { createBlankForm } from '../src/copreg/registration/defaultData';
import { CONTACT_ROLE, agentCardOf, contactOfDraftJson, contactOfForm } from '../src/copreg/registration/contactInfo';
import type { RegistrationFullForm } from '../src/copreg/registration/types';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

const person = (id: string, name: string, phone: string) => ({ id, name, phone, email: '', education: '', address: '', files: [] });

const formWith = (people: RegistrationFullForm['people'], roles: RegistrationFullForm['roles']): RegistrationFullForm => ({
  ...createBlankForm(),
  people,
  roles,
});

/* ------------------------------------------------ 1. 从表单里取联系人 */

{
  const form = formWith(
    { p1: person('p1', '张三', '13800000000'), p2: person('p2', '李四', '13911112222') },
    [
      { id: 'r1', personId: 'p1', roles: ['法定代表人', '总经理'] },
      { id: 'r2', personId: 'p2', roles: [CONTACT_ROLE] },
    ]
  );
  const contact = contactOfForm(form);
  ok('取的是角色带「联系人」的那个人', contact.name === '李四' && contact.phone === '13911112222');
  ok('不取法定代表人（张三）', contact.name !== '张三');
}

{
  // 同一人兼多角色（法定代表人兼联系人）也要取到
  const form = formWith(
    { p1: person('p1', '张三', '13800000000') },
    [{ id: 'r1', personId: 'p1', roles: ['法定代表人', '财务负责人', CONTACT_ROLE] }]
  );
  ok('法定代表人兼联系人 → 取这个人', contactOfForm(form).name === '张三');
}

{
  const form = formWith(
    { p1: person('p1', '张三', '13800000000') },
    [{ id: 'r1', personId: 'p1', roles: ['法定代表人'] }]
  );
  const contact = contactOfForm(form);
  ok('★ 没有「联系人」角色 → 空（不拿法定代表人顶替）', contact.name === '' && contact.phone === '');
}

{
  const form = formWith({}, [{ id: 'r1', personId: 'p-missing', roles: [CONTACT_ROLE] }]);
  ok('角色指着不存在的人 → 空，不抛', contactOfForm(form).name === '');
}

{
  const form = formWith(
    { p1: person('p1', '  李四  ', '  13911112222  ') },
    [{ id: 'r1', personId: 'p1', roles: [CONTACT_ROLE] }]
  );
  ok('姓名 / 电话两边的空格去掉', contactOfForm(form).name === '李四' && contactOfForm(form).phone === '13911112222');
}

{
  const form = formWith(
    { p1: person('p1', '李四', '') },
    [{ id: 'r1', personId: 'p1', roles: [CONTACT_ROLE] }]
  );
  const contact = contactOfForm(form);
  ok('只填了姓名没填电话 → 姓名有、电话空（两项分开判断）', contact.name === '李四' && contact.phone === '');
}

ok('空表单 → 空', contactOfForm(null).name === '' && contactOfForm(undefined).phone === '');

/* --------------------------------------------------- 2. 从草稿 JSON 取 */

{
  const form = formWith(
    { p1: person('p1', '李四', '13911112222') },
    [{ id: 'r1', personId: 'p1', roles: [CONTACT_ROLE] }]
  );
  ok('正常草稿 → 取到联系人', contactOfDraftJson(JSON.stringify(form)).name === '李四');
  ok('坏 JSON → 当没填，不抛', contactOfDraftJson('{不是 json').name === '');
  ok('空串 / null → 当没填', contactOfDraftJson('').name === '' && contactOfDraftJson(null).phone === '');
  ok('顶层是数组（脏数据）→ 当没填', contactOfDraftJson('[1,2]').name === '');
  // 旧版本草稿：没有 roles / people 这两个键
  ok('没有 roles / people 的旧草稿 → 当没填', contactOfDraftJson(JSON.stringify({ status: 'draft', basic: {} })).name === '');
}

/* ------------------------------------- 3. 卡片两格：联系人优先，其次订单 */

{
  const contact = { name: '李四', phone: '13911112222' };
  const order = { contactName: '', contactPhone: '13800000000' };
  const card = agentCardOf(contact, order);
  ok('★ 联系人填了就取联系人的姓名', card.name === '李四');
  ok('★ 联系人填了就取联系人的电话（不再用订单上那个）', card.phone === '13911112222');
}

{
  const card = agentCardOf({ name: '李四', phone: '' }, { contactName: '', contactPhone: '13800000000' });
  ok('只填了联系人姓名 → 姓名取联系人的、电话退回订单上的', card.name === '李四' && card.phone === '13800000000');
}

{
  const card = agentCardOf({ name: '', phone: '' }, { contactName: '王五', contactPhone: '13800000000' });
  ok('没填联系人 → 退回订单上那两项（原行为不变）', card.name === '王五' && card.phone === '13800000000');
}

{
  const card = agentCardOf({ name: '', phone: '' }, {});
  ok('两边都没有 → 破折号（不是 undefined / 空字符串）', card.name === '—' && card.phone === '—');
}

{
  const card = agentCardOf({ name: '', phone: '' }, { contactName: '   ', contactPhone: '  13800000000  ' });
  ok('订单上的空串 / 空格也当没有 → 姓名破折号、电话去空格', card.name === '—' && card.phone === '13800000000');
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
