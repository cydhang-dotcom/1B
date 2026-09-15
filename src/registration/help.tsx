import type { ReactNode } from 'react';

import { Dialog, SECONDARY_BUTTON } from './ui';

/** 帮助弹窗里的一行规则 */
function Rule({ name, children }: { name: string; children: ReactNode }) {
  return (
    <tr className="border-b border-stone-100 last:border-0">
      <th scope="row" className="w-[120px] py-2.5 pr-2 text-left align-top text-xs font-semibold text-stone-500">
        {name}
      </th>
      <td className="py-2.5 text-xs leading-5 text-stone-600">{children}</td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-stone-700">{title}</h3>
      <div className="grid gap-2 text-xs leading-[1.65] text-stone-600">{children}</div>
    </section>
  );
}

export function HelpDialog({
  onClose,
  onExport,
  onImport,
}: {
  onClose: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  return (
    <Dialog
      title="填写帮助与规则说明"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[11px] text-stone-400">需求版本 · 2026-09-14</span>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            我知道了
          </button>
        </>
      }
    >
      <div className="grid gap-6">
        <Section title="填写与暂存">
          <p>
            点击左侧章节或上一项、下一项可自由切换。暂存会在当前浏览器保存填写内容和附件；未暂存的修改在关闭页面后可能丢失。换设备或备份时，请导出完整草稿。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="font-semibold text-[#3f9d87]" onClick={onExport}>
              导出完整草稿 ↓
            </button>
            <label className="cursor-pointer font-semibold text-[#3f9d87]">
              导入草稿备份
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  event.target.value = '';
                  if (picked) onImport(picked);
                }}
              />
            </label>
          </div>
        </Section>

        <Section title="人员复用与附件">
          <p>
            已有人员以标签列出，选中后基础信息保持只读，身份证照片仍可上传、更换或删除；保存后同步至同一人员的关联记录，取消编辑则不生效。新增主要人员时，已添加的人员不再出现在可选列表中。点击「改为手动填写」会生成独立副本；附件也随副本保留，不覆盖来源记录。没有照片仍可保存记录和暂存，正式提交前必须补齐。
          </p>
          <p>
            上传功能为本地文件读取，没有发送到服务器。不限制格式与大小；可预览常见图片，其他格式可下载查看。身份证正面、反面分别上传；营业执照使用单个占位，重新上传会替换该位置。提交时检查两个身份证占位是否齐全，不核验证件内容、有效性或公章。旧草稿附件可手动指定对应位置。
          </p>
        </Section>

        <Section title="当前采用的待确认规则">
          <table className="w-full">
            <tbody>
              <Rule name="拟注册名称">默认 3 个空白栏，至少填 1 个；从第 4 个开始，添加后必填或移除；最多 9 个。</Rule>
              <Rule name="注册资金">
                币种固定人民币，金额为非负整数，单位万元；专家推荐可免填。金额上限、是否可改币种待确认。
              </Rule>
              <Rule name="股东人数">支持一位或多位股东，至少添加一位。</Rule>
              <Rule name="出资">
                每位股东的比例须大于 0 且不超过 100%；不强制合计 100%，不校验金额合计，不自动推算。出资形式支持多选，点击已选项可取消；该字段选填，选项适用性待确认。
              </Rule>
              <Rule name="主要人员">
                暂按法定代表人、财务负责人、联系人必填；总经理选填；允许兼任，不校验兼任冲突。同一人员仅添加一条记录，多个角色在原记录内选择。
              </Rule>
              <Rule name="设立信息">
                不按组织形式联动治理校验；人数只检查非负整数。董事与监事人数、期限、员工人数暂不作为提交必填项；设立期限可选长期或固定年限，选择固定年限后必须输入正整数年数；全部填写后章节才标记完成。
              </Rule>
              <Rule name="免申报">
                免申报承诺为选填。含企业或其他类型股东时不作承诺；全为自然人时可自行决定是否承诺。资本门槛、控制权等条件待核验，系统不自动认定免申报资格。不作承诺不影响申请提交。
              </Rule>
              <Rule name="受益所有人">本申请不收集受益所有人补充信息或附件。不满足条件或不作免申报承诺时，无需提交此类信息。</Rule>
              <Rule name="未新增字段">
                未新增国籍/地区、证件类型、企业注册地、企业法定代表人、企业联系电话或邮编。
              </Rule>
              <Rule name="链接与提交">
                本地演示提交会保存状态，不发送业务数据。申请链接的权限、有效期和编辑能力待确认。
              </Rule>
            </tbody>
          </table>
        </Section>

        <Section title="一般提醒">
          <p>
            选择有限合伙企业等股东时，请自行留意相关普通合伙人、有限合伙人安排。企业大类暂按自然人 /
            含企业 / 含其他类型股东识别；未收集国籍等信息，不能据此判定内资或外资。
          </p>
          <p>需要正式上线时，须接入短信验证、业务受理、附件存储及申请链接权限服务。本页用于填写体验与需求评审。</p>
        </Section>
      </div>
    </Dialog>
  );
}
