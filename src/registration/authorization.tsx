import { useState } from 'react';
import type { ReactNode } from 'react';

import { formatSize, openAttachment, readFiles } from './files';
import {
  trusteeNameOf,
  trusteeOf,
  type ApplicationData,
  type Attachment,
  type Authorization,
} from './model';
import { Panel } from './ui';

/**
 * 类名与 DOM 结构对齐 deepseek_html_20260916_6661c2-4.html 的「委托书办理」章节；
 * 样式在 design.css 末尾整段移植。改动前先改设计稿，再同步本文件与 design.css。
 */

/* ------------------------------------------------------------ 下载用的独立模板 */

/** 模板是字符串拼接，没有 JSX 的自动转义，而姓名来自用户输入 */
const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[char] ?? char;
  });

/**
 * 下载的是一份自带排版的独立 A4 文档，不走打印样式，所以样式内联在这里。
 * 页面内预览用中文引号、模板里用直引号，与设计稿一致。
 */
function buildAuthHtml(data: ApplicationData): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>法定代表人委托书</title>
<style>
  @page { size: A4; margin: 0; }
  body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;margin:0;padding:0;background:#fff}
  .page{
    width:210mm;min-height:297mm;box-sizing:border-box;
    padding:25mm 22mm;color:#0F172A;line-height:2.2;
    display:flex;flex-direction:column;
  }
  h1{text-align:center;font-size:22pt;letter-spacing:.06em;margin:0 0 30mm;font-weight:800}
  .body{font-size:12pt;line-height:2.4;text-align:justify}
  .underline{display:inline-block;min-width:100px;border-bottom:1px solid #0F172A;text-align:center;padding:0 8px;font-weight:600}
  .underline.short{min-width:56px}
  .sign{margin-top:auto;padding-top:20mm;font-size:12pt}
  .line{display:inline-block;min-width:220px;border-bottom:1px solid #0F172A}
  .date{margin-top:8mm;font-size:12pt}
</style></head>
<body>
  <div class="page">
    <h1>法定代表人委托书</h1>
    <div class="body">
      兹委托 <span class="underline">${escapeHtml(trusteeOf(data).name)}</span> （身份证号码： <span class="underline"></span> ，注：受托人需与"一窗通"公章经办人一致）代表我公司办理公章刻制业务，受托人在上述事项内所签署的有关文件及提供的手续材料，本委托人均予以承认并承担相应的法律责任。
    </div>
    <div class="sign">委托人（法定代表人亲笔签名）：<span class="line"></span></div>
    <div class="date">委托日期：<span class="underline short"></span> 年 <span class="underline short"></span> 月 <span class="underline short"></span> 日</div>
  </div>
</body></html>`;
}

const downloadAuth = (data: ApplicationData): void => {
  const blob = new Blob([buildAuthHtml(data)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '法定代表人委托书.html';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/* -------------------------------------------------------------------- 局部零件 */

/**
 * 委托日期和签名一样线下手写，所以打印出来是三段空白下划线。
 * 用独立字符串拼接日期，「年 / 月 / 日」两侧的空格才不会被 JSX 的换行合并规则吃掉。
 */
function BlankDate() {
  return (
    <>
      <span className="auth-doc-fill short" />
      {' 年 '}
      <span className="auth-doc-fill short" />
      {' 月 '}
      <span className="auth-doc-fill short" />
      {' 日'}
    </>
  );
}

/** 上传区与已上传态共用的文档线稿，对齐设计稿里的内联结构 */
function DocIcon({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'auth-uploaded-icon' : 'auth-icon-doc'}>
      <div className="auth-icon-line" style={{ width: '75%' }} />
      <div className="auth-icon-line" style={{ width: '90%' }} />
      <div className="auth-icon-line" style={{ width: '55%' }} />
      <div className="auth-icon-seal" />
    </div>
  );
}

function TimelineNode({
  step,
  title,
  desc,
  done,
  children,
}: {
  step: string;
  title: string;
  desc?: string;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`auth-tl-node${done ? ' done' : ''}`}>
      <div className="auth-tl-badge">{done ? '✓' : step}</div>
      <div className="auth-tl-head">
        <div className="auth-tl-title">{title}</div>
        {desc && <div className="auth-tl-desc">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- 步骤 5 */

export function AuthorizationStep({
  data,
  onPatch,
  onToast,
}: {
  data: ApplicationData;
  onPatch: (patch: Partial<Authorization>) => void;
  onToast: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const file: Attachment | undefined = data.authorization.files[0];

  /** 只留一份：重新上传即替换，不做归位与堆叠 */
  const pick = async (chosen: File | undefined) => {
    if (!chosen || busy) return;
    setBusy(true);
    setError('');
    onToast('正在读取附件…');
    try {
      const [attachment] = await readFiles([chosen]);
      onPatch({ files: [attachment] });
      onToast('委托书已载入');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法读取文件');
    } finally {
      setBusy(false);
    }
  };

  const uploader = (label: ReactNode, className: string) => (
    <label className={className}>
      <input
        type="file"
        accept="image/*,.pdf"
        disabled={busy}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          // 清空值，否则连续选同一个文件不会再触发 change
          event.target.value = '';
          void pick(chosen);
        }}
      />
      {label}
    </label>
  );

  return (
    <Panel title="法定代表人委托书" subtitle="按以下三个步骤完成委托书的打印、签署与上传。" number="05">
      <div className="auth-timeline">
        <TimelineNode step="1" title="打印委托书" desc="使用下方按钮打印或下载委托书，建议使用 A4 纸打印">
          <div className="auth-doc-stage">
            <div id="print-section">
              <div className="auth-doc-paper">
                <div className="auth-doc-title">法定代表人委托书</div>
                {/* 拆成独立的字符串字面量：JSX 会把源码换行合并成一个空格，公文正文里不能有这个空格 */}
                <div className="auth-doc-text">
                  {'兹委托 '}
                  <span className="auth-doc-fill">{trusteeNameOf(data)}</span>
                  {' （身份证号码：'}
                  <span className="auth-doc-fill" />
                  {'，注：受托人需与“一窗通”公章经办人一致）代表我公司办理公章刻制业务，受托人在上述事项内所签署的有关文件及提供的手续材料，本委托人均予以承认并承担相应的法律责任。'}
                </div>
                <div className="auth-doc-sign">
                  <div>
                    委托人（法定代表人亲笔签名）：<span className="auth-doc-sign-line" />
                  </div>
                  <div style={{ marginTop: 6 }}>
                    委托日期：<BlankDate />
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-btn-row no-print">
              <button type="button" className="primary" onClick={() => window.print()}>
                <svg
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  style={{ verticalAlign: -2, marginRight: 5 }}
                  aria-hidden="true"
                >
                  <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
                </svg>
                打印委托书
              </button>
              <button type="button" onClick={() => downloadAuth(data)}>
                <svg
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  style={{ verticalAlign: -2, marginRight: 5 }}
                  aria-hidden="true"
                >
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                下载委托书
              </button>
            </div>
          </div>
        </TimelineNode>

        <TimelineNode step="2" title="法定代表人签字并盖章">
          <div className="auth-sign-guide">
            <div className="auth-guide-left">
              <span className="auth-guide-emoji" aria-hidden="true">
                ✍️
              </span>
              <span>请将打印出的纸质委托书完成以下两项签署：</span>
            </div>
            <div className="auth-guide-chips">
              <span className="auth-chip">✓ 亲笔签字</span>
              <span className="auth-chip">✓ 加盖公章</span>
            </div>
          </div>
        </TimelineNode>

        <TimelineNode
          step="3"
          title="上传已签署文件"
          desc="请上传法定代表人亲笔签名并加盖公章的扫描件或照片"
          done={Boolean(file)}
        >
          {file ? (
            <>
              <div className="auth-uploaded-file">
                <DocIcon compact />
                <div className="auth-uploaded-info">
                  <div className="auth-uploaded-name">{file.name}</div>
                  <div className="auth-uploaded-meta">已上传 · {formatSize(file.size)}</div>
                </div>
                <div className="auth-uploaded-actions">
                  <button type="button" onClick={() => openAttachment(file)}>
                    预览
                  </button>
                  {uploader('重新上传', 'auth-reupload')}
                  <button type="button" className="danger" onClick={() => onPatch({ files: [] })}>
                    删除
                  </button>
                </div>
              </div>
              <div className="auth-complete-note">已上传已签署委托书，可继续下一步</div>
            </>
          ) : (
            uploader(
              <>
                <DocIcon />
                <div className="auth-upload-main">＋ 上传已签署委托书</div>
                <div className="auth-upload-sub">A4 规格 · 支持 JPG、PNG、PDF</div>
              </>,
              'auth-upload-zone',
            )
          )}
          {error && <div className="error">{error}</div>}
        </TimelineNode>
      </div>
    </Panel>
  );
}
