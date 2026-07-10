// Clim: 現在ページのURLをそのままクリップボードへコピーする。

if (!globalThis.__climContentScriptReady) {
  globalThis.__climContentScriptReady = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CLIM_PING") {
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type !== "CLIM_COPY_CURRENT_URL") {
      return false;
    }

    copyCurrentUrl()
      .then((text) => {
        showToast("URLをコピーしました", "success");
        sendResponse({ ok: true, text });
      })
      .catch((error) => {
        console.error("[Clim] URLコピーに失敗しました。", error);
        showToast("コピーに失敗しました", "error");
        sendResponse({ ok: false, error: String(error) });
      });

    return true;
  });
}

async function copyCurrentUrl() {
  const text = window.location.href;
  await writeToClipboard(text);
  return text;
}

async function writeToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      console.warn("[Clim] navigator.clipboard.writeText failed. fallbackします。", error);
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

function showToast(message, status = "success") {
  const existingToast = document.getElementById("clim-copy-toast");
  existingToast?.remove();

  const toast = document.createElement("div");
  toast.id = "clim-copy-toast";
  toast.setAttribute("role", "status");
  toast.textContent = `${status === "success" ? "✓" : "!"} ${message}`;
  toast.style.cssText = `
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483647;
    max-width: min(320px, calc(100vw - 32px));
    padding: 8px 11px;
    border-radius: 8px;
    border: 1px solid ${status === "success" ? "rgba(148, 163, 184, 0.32)" : "rgba(248, 113, 113, 0.38)"};
    background: ${status === "success" ? "rgba(17, 24, 39, 0.92)" : "rgba(127, 29, 29, 0.92)"};
    color: #fff;
    font: 500 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 8px 20px rgba(17, 24, 39, 0.18);
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 140ms ease, transform 140ms ease;
    pointer-events: none;
  `;

  document.documentElement.appendChild(toast);
  window.requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    window.setTimeout(() => {
      toast.remove();
    }, 160);
  }, 1200);
}
