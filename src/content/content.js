// Clim: 設定済みテンプレートで現在ページのURLをコピーする。

const CLIM_STORAGE_KEY = "climOptions";
const URL_COPY_TEMPLATE_ID = "url-copy";
const DEFAULT_TEMPLATES = [
  {
    id: URL_COPY_TEMPLATE_ID,
    name: "URLコピー",
    body: "{{url}}",
    readonly: true,
    deletable: false
  }
];
const DEFAULT_CLIM_OPTIONS = {
  toastEnabled: true,
  templates: DEFAULT_TEMPLATES,
  shortcutSlots: {
    1: URL_COPY_TEMPLATE_ID,
    2: URL_COPY_TEMPLATE_ID,
    3: URL_COPY_TEMPLATE_ID,
    4: URL_COPY_TEMPLATE_ID
  }
};

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

    const slot = normalizeSlot(message.slot);

    copyCurrentUrl(slot, message.source)
      .then((result) => {
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => {
        console.error("[Clim] URLコピーに失敗しました。", error);
        showErrorToast();
        sendResponse({ ok: false, error: String(error) });
      });

    return true;
  });
}

async function copyCurrentUrl(slot = 1, source = "shortcut") {
  const options = await getClimOptions();
  const templateId = options.shortcutSlots[slot];
  const template = findTemplate(options.templates, templateId);

  if (source === "shortcut" && !template) {
    if (options.toastEnabled) {
      showToast(`スロット${slot}は未割り当てです`, "error");
    }

    return { skipped: true };
  }

  const text = renderTemplate(source === "shortcut" ? template.body : "{{url}}", getTemplateValues());

  await writeToClipboard(text);

  if (options.toastEnabled) {
    const label = source === "shortcut" ? `スロット${slot}` : "右クリック";
    showToast(`${label}でURLをコピーしました`, "success");
  }

  return { text };
}

function normalizeSlot(slot) {
  const number = Number(slot);
  return Number.isInteger(number) && number >= 1 && number <= 4 ? number : 1;
}

async function getClimOptions() {
  let stored = {};

  try {
    stored = await chrome.storage.sync.get(CLIM_STORAGE_KEY);
  } catch (error) {
    console.warn("[Clim] 設定の取得に失敗しました。デフォルト設定でコピーします。", error);
  }

  const options = stored[CLIM_STORAGE_KEY] || {};

  return {
    ...DEFAULT_CLIM_OPTIONS,
    ...options,
    templates: mergeDefaultTemplates(options.templates),
    shortcutSlots: {
      ...DEFAULT_CLIM_OPTIONS.shortcutSlots,
      ...options.shortcutSlots
    }
  };
}

function mergeDefaultTemplates(templates = []) {
  const customTemplates = templates.filter((template) => template.id !== URL_COPY_TEMPLATE_ID);
  return [...DEFAULT_TEMPLATES, ...customTemplates];
}

function findTemplate(templates, templateId) {
  return templates.find((template) => template.id === templateId);
}

function getTemplateValues() {
  const now = new Date();
  const canonicalUrl = getLinkHref("canonical");

  return {
    url: window.location.href,
    title: document.title,
    canonicalUrl,
    description: getMetaContent("description") || getMetaContent("og:description"),
    siteName: getMetaContent("og:site_name"),
    ogTitle: getMetaContent("og:title"),
    ogDescription: getMetaContent("og:description"),
    ogImage: getMetaContent("og:image"),
    publishedTime: getMetaContent("article:published_time"),
    modifiedTime: getMetaContent("article:modified_time"),
    author: getMetaContent("author") || getMetaContent("article:author"),
    lang: document.documentElement.lang,
    selectedText: window.getSelection()?.toString().trim() || "",
    domain: window.location.hostname,
    date: now.toISOString().slice(0, 10),
    datetime: now.toISOString()
  };
}

function renderTemplate(template, values) {
  return template.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_match, expression) => {
    try {
      return evaluateTemplateExpression(expression, values);
    } catch (error) {
      console.warn("[Clim] テンプレート式の評価に失敗しました。", expression, error);
      return "";
    }
  });
}

function evaluateTemplateExpression(expression, values) {
  const trimmedExpression = expression.trim();

  if (trimmedExpression.toLowerCase().startsWith("if ")) {
    return evaluateIfExpression(trimmedExpression, values);
  }

  return evaluateConcatExpression(trimmedExpression, values);
}

function evaluateIfExpression(expression, values) {
  const body = expression.slice(3).trim();
  const thenIndex = findKeywordOutsideQuotes(body, " then ");

  if (thenIndex === -1) {
    return "";
  }

  const conditionExpression = body.slice(0, thenIndex).trim();
  const afterThen = body.slice(thenIndex + " then ".length);
  const elseIndex = findKeywordOutsideQuotes(afterThen, " else ");
  const truthyExpression = (elseIndex === -1 ? afterThen : afterThen.slice(0, elseIndex)).trim();
  const falsyExpression = elseIndex === -1 ? "" : afterThen.slice(elseIndex + " else ".length).trim();
  const conditionValue = evaluateConcatExpression(conditionExpression, values);

  return conditionValue ? evaluateConcatExpression(truthyExpression, values) : evaluateConcatExpression(falsyExpression, values);
}

function evaluateConcatExpression(expression, values) {
  return splitOutsideQuotes(expression, "+")
    .map((part) => evaluateTemplateValue(part.trim(), values))
    .join("");
}

function evaluateTemplateValue(value, values) {
  if (!value) {
    return "";
  }

  if (isQuotedString(value)) {
    return parseQuotedString(value);
  }

  return values[value] ?? "";
}

function isQuotedString(value) {
  return value.startsWith("\"") && value.endsWith("\"");
}

function parseQuotedString(value) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value.slice(1, -1);
  }
}

function splitOutsideQuotes(text, separator) {
  const parts = [];
  let current = "";
  let inQuote = false;
  let escaped = false;

  for (const character of text) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }

    if (character === "\"") {
      current += character;
      inQuote = !inQuote;
      continue;
    }

    if (!inQuote && character === separator) {
      parts.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  parts.push(current);
  return parts;
}

function findKeywordOutsideQuotes(text, keyword) {
  let inQuote = false;
  let escaped = false;

  for (let index = 0; index <= text.length - keyword.length; index += 1) {
    const character = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === "\"") {
      inQuote = !inQuote;
      continue;
    }

    if (!inQuote && text.slice(index, index + keyword.length) === keyword) {
      return index;
    }
  }

  return -1;
}

function getMetaContent(name) {
  return document
    .querySelector(`meta[name="${CSS.escape(name)}"], meta[property="${CSS.escape(name)}"]`)
    ?.content
    ?.trim() || "";
}

function getLinkHref(rel) {
  return document.querySelector(`link[rel="${CSS.escape(rel)}"]`)?.href || "";
}

async function showErrorToast() {
  try {
    const options = await getClimOptions();

    if (options.toastEnabled) {
      showToast("コピーに失敗しました", "error");
    }
  } catch (_error) {
    showToast("コピーに失敗しました", "error");
  }
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
