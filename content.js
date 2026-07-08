// clim: ページ情報を日本向けに整形し、複数形式のリンクとしてコピーするcontent script。

var CLIM_FORMAT_LABELS = {
  markdown: "Markdown",
  scrapbox: "Scrapbox",
  plainText: "プレーンテキスト",
  html: "HTML"
};

if (!globalThis.__climContentScriptReady) {
  globalThis.__climContentScriptReady = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "CLIM_COPY_LINK") {
      return false;
    }

    copyCurrentPageLink(message.format)
      .then((text) => {
        const label = CLIM_FORMAT_LABELS[message.format] ?? "リンク";
        showToast(`${label}リンクをコピーしました`);
        sendResponse({ ok: true, text });
      })
      .catch((error) => {
        console.error("[clim] コピーに失敗しました。", error);
        showToast("コピーに失敗しました");
        sendResponse({ ok: false, error: String(error) });
      });

    // 非同期でsendResponseするためtrueを返します。
    return true;
  });
}

async function copyCurrentPageLink(format = "markdown") {
  const cleanTitle = cleanJapaneseTitle(document.title);
  const decodedUrl = decodeJapaneseUrl(window.location.href);
  const text = formatLink(format, cleanTitle, decodedUrl);

  await writeToClipboard(text);
  return text;
}

function formatLink(format, title, url) {
  switch (format) {
    case "scrapbox":
      return `[${title} ${url}]`;
    case "plainText":
      return `${title} ${url}`;
    case "html":
      return `<a href="${escapeHtmlAttribute(url)}">${escapeHtmlText(title)}</a>`;
    case "markdown":
    default:
      return `[${escapeMarkdownTitle(title)}](${escapeMarkdownUrl(url)})`;
  }
}

function escapeHtmlText(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function decodeJapaneseUrl(url) {
  try {
    // 要件どおりdecodeURIComponentで日本語URLエンコードを人間が読める形にします。
    return decodeURIComponent(url);
  } catch (_error) {
    try {
      return decodeURI(url);
    } catch (_fallbackError) {
      return url;
    }
  }
}

function cleanJapaneseTitle(title) {
  return toHalfWidthAlphaNumeric(title)
    .replace(/\s+/g, " ")
    // 先頭のメタ情報を除去: 【2026年最新】, [対談], 【公式】など。
    .replace(/^\s*(?:【[^】]{1,40}】|\[[^\]]{1,40}\])\s*/g, "")
    // 末尾のサイト名を除去: "記事タイトル | Zenn", "記事タイトル - Qiita"など。
    .replace(/\s*(?:\||｜|-|ー|--|–|—)\s*(?:Zenn|Qiita|Note|note|クラスメソッド|DevelopersIO|はてなブログ|Hatena Blog|Speaker Deck|connpass|TECH PLAY)\s*$/i, "")
    // 先頭のサイト名を除去: "Qiita - 記事タイトル"など。
    .replace(/^\s*(?:Zenn|Qiita|Note|note|クラスメソッド|DevelopersIO|はてなブログ|Hatena Blog|Speaker Deck|connpass|TECH PLAY)\s*(?:\||｜|-|ー|--|–|—)\s*/i, "")
    .trim();
}

function toHalfWidthAlphaNumeric(text) {
  // 全角英数字だけを半角化します。日本語や記号はなるべく壊さず残します。
  return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
  });
}

function escapeMarkdownTitle(title) {
  // Markdownリンクの表示テキストで壊れやすい文字だけエスケープします。
  return title.replace(/([\\[\]])/g, "\\$1");
}

function escapeMarkdownUrl(url) {
  // URL内の閉じ括弧はMarkdownリンクを壊すためエスケープします。
  return url.replace(/[\\)]/g, "\\$&");
}

async function writeToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // HTTPページやフォーカス状態によってClipboard APIが拒否される場合は旧APIへフォールバックします。
      console.warn("[clim] navigator.clipboard.writeText failed. fallbackします。", error);
    }
  }

  fallbackCopyText(text);
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = [
    "position: fixed",
    "top: -9999px",
    "left: -9999px",
    "width: 1px",
    "height: 1px",
    "opacity: 0"
  ].join(";");

  document.documentElement.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("document.execCommand('copy') failed");
  }
}

function showToast(message) {
  const existingToast = document.getElementById("clim-copy-toast");
  existingToast?.remove();

  const toast = document.createElement("div");
  toast.id = "clim-copy-toast";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483647;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.92);
    color: #fff;
    font: 600 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.24);
    pointer-events: none;
  `;

  document.documentElement.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 1000);
}
