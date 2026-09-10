import { Info, Printer } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { AgentNote, StepCard } from './steps';
import { ATTORNEY_HINT, type AgencyValues, type FormValues } from './schema';

/** 打印时只输出这一块，选择器与 index.css 的 @media print 对应 */
const LETTER_ID = 'attorney-print';

/** 委托书上的填空线：无内容时留一段不换行空格，下划线仍可见，供打印后手写 */
const Fill = ({ value, className = '' }: { value?: string; className?: string }) => (
  <span className={`inline-block border-b border-stone-800 px-1 align-baseline ${className}`}>
    {value || ' '}
  </span>
);

const splitDate = (value: string) => {
  const [year = '', month = '', day = ''] = value.split('-');
  return { year, month, day };
};

/**
 * A4 版式的法定代表人委托书，正文与现有《法定代表人委托书》页面逐字一致。
 * 受托人直接取环节 3 的经办人——PDF 要求两者一致，分开填迟早会对不上。
 */
function AttorneyLetter({ value }: { value: AgencyValues }) {
  const { year, month, day } = splitDate(value.principalDate);

  return (
    <div id={LETTER_ID} className="rounded-2xl border border-stone-200 bg-white px-6 py-10 sm:px-8">
      <h3 className="text-center text-xl font-bold tracking-[0.2em] text-stone-900 sm:text-2xl">
        法定代表人委托书
      </h3>

      <p className="mt-8 text-[15px] leading-9 text-stone-900">
        <span className="pl-8" />
        兹委托
        <Fill value={value.agentName} className="w-28 text-center" />
        （身份证号码：
        <Fill value={value.agentIdNumber} className="w-44 text-center" />
        <span className="text-xs text-stone-500">，注：受托人需与「一窗通」公章经办人一致</span>
        ）代表我公司办理公章刻制业务，受托人在上述事项内所签署的有关文件及提供的手续材料，本委托人均予以承认并承担相应的法律责任。
      </p>

      {/* 参考页把签署区缩进 30%，窄卡片里那样会让签名线短到写不下，改为占满整行；
          两个标签同宽，签名线与日期线才会左右对齐，窄屏改为上下排列 */}
      <div className="mt-16 space-y-8">
        <p className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-2">
          <span className="font-bold text-stone-900 sm:w-60 sm:shrink-0 sm:whitespace-nowrap">
            委托人（法定代表人亲笔签名）：
          </span>
          <Fill value={value.principalSign} className="min-w-24 self-stretch sm:flex-1" />
        </p>
        <p className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-2">
          <span className="font-bold text-stone-900 sm:w-60 sm:shrink-0 sm:whitespace-nowrap">
            委托日期：
          </span>
          <span className="flex flex-1 items-end gap-1">
            <Fill value={year} className="w-14 text-center" />
            <span className="font-bold text-stone-900">年</span>
            <Fill value={month} className="w-10 text-center" />
            <span className="font-bold text-stone-900">月</span>
            <Fill value={day} className="w-10 text-center" />
            <span className="font-bold text-stone-900">日</span>
          </span>
        </p>
      </div>
    </div>
  );
}

/** 环节 11 · 法人委托书（只读查看 + 打印，内容由右栏「我司服务人员填写」提供） */
export function AttorneyStep() {
  const { control } = useFormContext<FormValues>();
  const agency = useWatch({ control, name: 'agency' });
  const value: AgencyValues = agency ?? {
    agentName: '',
    agentIdNumber: '',
    agentMobile: '',
    principalSign: '',
    principalDate: '',
  };
  const ready = Boolean(value.agentName && value.agentIdNumber);

  return (
    <StepCard badge="环节 11 · 刻章信息" title="法定代表人委托书" hint={ATTORNEY_HINT}>
      {!ready && (
        <p className="mb-5 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          受托人（金桥镇经办人）信息尚未在「环节 3 · 经办人信息」中填好，下方委托书中该栏暂为空白。可先打印，待专员补充后再打印一次。
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-stone-800">委托书预览</h3>
        {/* ponytail: 用浏览器打印输出 A4，不引第三方 PDF 库；打印样式见 index.css */}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-[#66cdb5] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#57bea6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/25"
        >
          <Printer size={16} aria-hidden="true" />
          打印委托书
        </button>
      </div>

      <AttorneyLetter value={value} />

      <AgentNote title="打印后请这样交给金桥镇经办人">
        委托书须由法定代表人亲笔签名（打印件上手写，电子签名无效），再由经办人在环节 11「刻章信息」中上传。材料限
        jpg、单张不超过 500K，建议打印签名后拍照或扫描为 jpg 再提交。
      </AgentNote>
    </StepCard>
  );
}
