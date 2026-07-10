// clim: ページ上でコピー処理を実行するcontent scriptの入口。

if (!globalThis.__climContentScriptReady) {
  globalThis.__climContentScriptReady = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "CLIM_COPY_LINK" && message?.type !== "CLIM_COPY_MARKDOWN_LINK") {
      return false;
    }

    const format = message.type === "CLIM_COPY_MARKDOWN_LINK" ? "markdown" : message.format;

    copyCurrentPageLink(format)
      .then((text) => {
        const label = CLIM_FORMAT_LABELS[format] ?? "リンク";
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
  const siteSettings = await getSiteSettings();
  const outputTemplates = await getOutputTemplates();
  const trimmingRules = getTrimmingRulesFromSiteSettings(siteSettings, window.location.href);
  const pageMetadata = getPageMetadata(window.location.href, siteSettings);
  const baseTitle = getBestPageTitle(document.title, window.location.href, trimmingRules, pageMetadata, siteSettings);
  const cleanTitle = enrichTitle(baseTitle, pageMetadata);
  const decodedUrl = decodeJapaneseUrl(window.location.href);
  const text = formatLink(format, cleanTitle, decodedUrl, pageMetadata, outputTemplates);

  await writeToClipboard(text);
  return text;
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
