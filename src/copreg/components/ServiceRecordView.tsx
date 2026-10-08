/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **服务人员查看页**（`copreg-view.html`）：按地址栏里的开户单 uuid（`scbUuid`）读回客户提交的
 * 申报资料，**只读**呈现 —— 版式照客户第 5 步 `#fill-details` 的「05 确认提交」那一章
 * （`ReviewSection` 的 `readOnly`），字段就是 `openAccApply.var2` 里有的那些。
 *
 * 三条刻意的边界：
 *   1. **完全不碰 localStorage**：不读主体列表、不写草稿、不落步骤 —— 服务人员的浏览器里
 *      本来就没有客户那份存档，任何「顺手落盘」都会在这一页造出一份假申请；
 *   2. **不参与客户流程的步骤路由**：没有 hash、不查单、不解锁步骤，地址栏参数只用来发这一次读请求；
 *   3. **没有任何写操作**：没有保存 / 提交 / 修改按钮，附件只能预览与在新窗口打开。
 *
 * 读接口的地址与凭据口径照 www 站 `static/js/page-display.js`（见 `registration/subscribeQuery.ts`）。
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle, FileText, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { ReviewSection } from '../registration/ReviewSection';
import { FilePreviewModal } from '../registration/FilePreviewModal';
import { formatSize } from '../registration/defaultData';
import {
  fetchSubscribeDetail,
  type SubscribeQueryEndpoint,
} from '../registration/subscribeQuery';
import { createOnceGate, serviceViewGateKey } from '../registration/onceGate';
import {
  SERVICE_SNAPSHOT_KEY,
  snapshotFor,
  withSnapshot,
} from '../registration/snapshotStore';
import { serviceFormOf, type ServiceViewQuery } from '../serviceView';
import type { FileAttachment, RegistrationFullForm } from '../registration/types';
import { DOC_HOST, SUBSCRIBE_QUERY_PATH } from '../../config/api';

/** 只有 React 这一层读 config/api.ts：它依赖 import.meta.env，是 Vite 专有的 */
const SUBSCRIBE_ENDPOINT: SubscribeQueryEndpoint = { host: DOC_HOST, path: SUBSCRIBE_QUERY_PATH };

/**
 * **读接口的单次闸门**（模块级：一次打开只查一次）。
 *
 * 查看码是**一次性的**，服务端用过即失效；而 dev 的 StrictMode 会「挂载 → 清理 → 再挂载」，
 * 下面那个 effect 会跑两遍 —— 没有这道闸门时第二遍会真再打一次接口，服务端回
 * 「查询码无效或已过期」，页面就永远只能看到报错。真机脚本专门盯这条（断言只打一次）。
 */
const subscribeGate = createOnceGate<unknown>();

/** 读会话内的快照表（隐私模式 / SSR 下拿不到 sessionStorage 就当没有） */
const readSnapshotRaw = (): string | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SERVICE_SNAPSHOT_KEY);
  } catch {
    return null;
  }
};

/** 存一份快照（存不下不影响本次查看：只是下次刷新要重新去要链接） */
const writeSnapshot = (key: string, payload: unknown, fetchedAt: string): void => {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(
      SERVICE_SNAPSHOT_KEY,
      withSnapshot(readSnapshotRaw(), { key, fetchedAt, payload })
    );
  } catch {
    /* 隐私模式 / 配额满：忽略 */
  }
};

const nowText = (): string => new Date().toLocaleString('zh-CN', { hour12: false });

type ServiceViewState =
  | { kind: 'badLink' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      form: RegistrationFullForm;
      busUnionId: string;
      /** 这份内容是什么时候读到的（服务端响应里没有这个概念，由页面记） */
      fetchedAt: string;
      /** true = 刷新时命中了会话内快照（这一趟没有打接口，因为查看码一次有效） */
      fromSnapshot: boolean;
    };

const MetaCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-[11px] text-slate-400 font-medium">{label}</dt>
    <dd className="text-xs sm:text-sm text-slate-800 font-semibold mt-0.5 break-all">{value || '—'}</dd>
  </div>
);

/** 附件一排（与 ReviewSection 里那套按钮同款，只做预览 / 新窗口打开） */
const FileRow: React.FC<{ files: FileAttachment[]; onPreview: (file: FileAttachment) => void }> = ({
  files,
  onPreview,
}) => {
  if (!files || files.length === 0) return <span className="text-xs text-slate-400">未附资料照片</span>;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => onPreview(file)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-[#E6F7F2] hover:text-[#1D6C5E] border border-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition-colors shadow-2xs"
        >
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span className="truncate max-w-[160px]">{file.fileName || '附件'}</span>
          <span className="text-slate-400 text-[10px]">({formatSize(file.size)})</span>
        </button>
      ))}
    </div>
  );
};

/**
 * 「05 确认提交」那一章没覆盖、但确实在 `var2` 里的两项：地址性质与场地证明附件。
 * 客户在 01 基本信息里选 / 传的，服务人员办工商申报时要看，所以单独补一块。
 * （`var2` 里的 `setup` 与 `confirm.beneficiary` 在客户页面从来没有渲染位，就不在这里凭空展开。）
 */
const AddressProofCard: React.FC<{ form: RegistrationFullForm; onPreview: (file: FileAttachment) => void }> = ({
  form,
  onPreview,
}) => (
  <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
    <div className="pb-3.5 mb-4 border-b border-slate-100">
      <h2 className="text-sm sm:text-base font-bold text-slate-800">5. 地址性质与场地证明</h2>
    </div>
    <dl className="space-y-4 text-xs sm:text-sm">
      <div>
        <dt className="text-slate-400 font-medium">注册地址性质：</dt>
        <dd className="text-slate-800 font-semibold mt-0.5">{form.basic.regAddressNature || '—'}</dd>
        <div className="mt-1">
          <FileRow files={form.basic.regFiles || []} onPreview={onPreview} />
        </div>
      </div>
      <div className="pt-3 border-t border-slate-100">
        <dt className="text-slate-400 font-medium">实际经营地址性质：</dt>
        <dd className="text-slate-800 font-semibold mt-0.5">{form.basic.workAddressNature || '—'}</dd>
        <div className="mt-1">
          <FileRow files={form.basic.workFiles || []} onPreview={onPreview} />
        </div>
      </div>
    </dl>
  </div>
);

/**
 * 读到资料之后要展示的东西（概览 + 只读正文）。
 *
 * 单独抽出来是为了能被 `npm run check:entry` 在 Node 里**直接渲染**：
 * 真机上它是 effect 拿到数据之后才出现的，SSR 跑不到 effect，只有把它拆成纯展示组件才验得到。
 */
export const ServiceRecordContent: React.FC<{
  form: RegistrationFullForm;
  busUnionId: string;
  /** 读到这份内容的时刻 */
  fetchedAt: string;
  /** 这一趟是不是刷新命中的会话内快照（是的话要说清「刷新没重新读」） */
  fromSnapshot: boolean;
  onPreviewFile: (file: FileAttachment) => void;
}> = ({ form, busUnionId, fetchedAt, fromSnapshot, onPreviewFile }) => {
  const isSubmitted = form.status === 'submitted';

  return (
    <>
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between gap-3 pb-3.5 mb-4 border-b border-slate-100">
          <h2 className="text-sm sm:text-base font-bold text-slate-800">申报信息概览</h2>
          <span
            className={`shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
              isSubmitted
                ? 'text-emerald-800 bg-emerald-100/80 border-emerald-200/60'
                : 'text-amber-800 bg-amber-100/80 border-amber-200/60'
            }`}
          >
            {isSubmitted ? '已确认提交' : '草稿（客户尚未确认提交）'}
          </span>
        </div>

        {/* 刷新命中快照时要说清：这一趟**没有**重新读服务端（查看码一次有效，也不会去读） */}
        {fromSnapshot && (
          <div className="mb-4 rounded-xl px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
            本页是 <span className="font-semibold text-slate-700">{fetchedAt}</span> 读取的
            <span className="font-semibold text-slate-700">会话内快照</span>
            ：刷新不会重新读取（查看码一次有效）。要看最新内容，请回开户详情页重新点一次
            「查看申报资料」。
          </div>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <MetaCell label="提交时间" value={form.submittedAt || ''} />
          <MetaCell label="经办手机号" value={form.submissionPhone || ''} />
          <MetaCell label="一企通方案号（busUnionId）" value={busUnionId} />
          <MetaCell label="客户最近保存时间" value={form.savedAt || ''} />
          <MetaCell label="本次读取时间" value={fetchedAt} />
        </dl>
      </div>

      <ReviewSection
        form={form}
        readOnly
        onGoChapter={() => {}}
        onUpdateConfirm={() => {}}
        onPreviewFile={onPreviewFile}
        onProceedToDelivery={() => {}}
        errors={{}}
      />

      <AddressProofCard form={form} onPreview={onPreviewFile} />
    </>
  );
};

export const ServiceRecordView: React.FC<{ query: ServiceViewQuery | null }> = ({ query }) => {
  const [state, setState] = useState<ServiceViewState>({ kind: query === null ? 'badLink' : 'loading' });
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  /** 点「重新读取」时 +1，用来重跑下面那个 effect */
  const [reloadKey, setReloadKey] = useState(0);

  const uuid = query === null ? '' : query.uuid;
  const code = query === null ? '' : query.code;
  const gateKey = serviceViewGateKey(uuid, code);

  useEffect(() => {
    if (uuid === '') {
      setState({ kind: 'badLink' });
      return;
    }
    setState({ kind: 'loading' });

    /**
     * 先看会话内快照：**命中了就直接渲染，一个请求都不发**。
     * 查看码一次有效 —— 刷新这一下如果再去读，服务端只会回「查询码无效或已过期」。
     */
    const cached = snapshotFor(readSnapshotRaw(), gateKey);
    if (cached !== null) {
      const restored = serviceFormOf(cached.payload);
      if (restored.ok === true) {
        setState({
          kind: 'ready',
          form: restored.form,
          busUnionId: restored.busUnionId,
          fetchedAt: cached.fetchedAt,
          fromSnapshot: true,
        });
        return;
      }
    }

    // StrictMode 会「挂载 → 清理 → 再挂载」：第一轮的结果按已取消丢掉，别让它覆盖第二轮；
    // **但请求本身只发一次**（走 subscribeGate）—— 查看码一次性，多发一次就把码用废了。
    let cancelled = false;

    subscribeGate
      .run(gateKey, () => fetchSubscribeDetail(SUBSCRIBE_ENDPOINT, { uuid, code }))
      .then((payload) => {
        if (cancelled) return;
        const result = serviceFormOf(payload);
        if (result.ok === true) {
          const fetchedAt = nowText();
          // 存快照供刷新用（存不下不影响本次查看）
          writeSnapshot(gateKey, payload, fetchedAt);
          setState({
            kind: 'ready',
            form: result.form,
            busUnionId: result.busUnionId,
            fetchedAt,
            fromSnapshot: false,
          });
        } else {
          setState({ kind: 'error', message: result.message });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : '读取客户申报资料失败，请稍后重试',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [uuid, code, gateKey, reloadKey]);

  /** 「重新读取」：放掉闸门里的记录再重跑 effect（网络没打到服务端时同一枚码还能用） */
  const handleReload = () => {
    subscribeGate.reset(gateKey);
    setReloadKey((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶栏：与客户页区分开，明确这是只读的服务人员视图 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-800 truncate">客户申报资料</h1>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              开户单编号：{uuid || '—'}
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1D6C5E] bg-[#E6F7F2] border border-[#2AA894]/20 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>服务人员查看 · 只读</span>
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {state.kind === 'badLink' && (
          <div className="rounded-2xl p-6 border border-amber-200/90 bg-amber-50/70">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                <div className="font-bold mb-1">链接不完整，缺少开户单编号</div>
                <p>
                  本页需要用开户单编号（<span className="font-mono">scbUuid</span>）打开，例如：
                </p>
                <p className="mt-1.5 font-mono text-[11px] break-all text-amber-800">
                  copreg-view.html?scbUuid=&lt;开户单编号&gt;&amp;code=&lt;查看码&gt;
                </p>
                <p className="mt-1.5">请向发起人索取完整链接。</p>
              </div>
            </div>
          </div>
        )}

        {state.kind === 'loading' && (
          <div className="rounded-2xl p-10 border border-slate-200/80 bg-white shadow-2xs flex flex-col items-center justify-center text-center">
            <Loader2 className="w-6 h-6 text-[#36B39E] animate-spin mb-3" />
            <p className="text-xs sm:text-sm text-slate-600">正在读取客户申报资料…</p>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="rounded-2xl p-6 border border-rose-200/90 bg-rose-50/70">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs sm:text-sm text-rose-900 leading-relaxed">
                <div className="font-bold mb-1">读取失败</div>
                <p>{state.message}</p>
                {/* 带查看码的链接被拒时，服务人员真正该做的是回开户详情页再点一次（一次有效） */}
                {code !== '' && (
                  <p className="mt-1 text-[11px] text-rose-700/90">
                    本页链接的查看码一次有效：若已失效（例如刷新过页面），请回到开户详情页重新点一次「查看申报资料」。
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleReload}
                  className="mt-3 px-4 py-2 rounded-full bg-white border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>重新读取</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {state.kind === 'ready' && (
          <ServiceRecordContent
            form={state.form}
            busUnionId={state.busUnionId}
            fetchedAt={state.fetchedAt}
            fromSnapshot={state.fromSnapshot}
            onPreviewFile={(file) => setPreviewFile(file)}
          />
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 sm:px-6 pb-10 text-center text-[11px] text-slate-400">
        本页为客户提交内容的只读快照，页面上的任何操作都不会修改客户数据。
      </footer>

      {previewFile !== null && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
};
