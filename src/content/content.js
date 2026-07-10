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
  },
  {
    id: "markdown-link",
    name: "Markdownリンク",
    body: "[{{cleanTitle}}]({{url}})",
    readonly: false,
    deletable: true,
    seeded: true
  },
  {
    id: "markdown-quote",
    name: "選択引用Markdown",
    body: "{{if selectedText then \"> \" + selectedText + \"\\n\\n\" else \"\"}}[{{cleanTitle}}]({{url}})",
    readonly: false,
    deletable: true,
    seeded: true
  },
  {
    id: "html-link",
    name: "HTMLリンク",
    body: "<a href=\"{{url}}\">{{cleanTitle}}</a>",
    readonly: false,
    deletable: true,
    seeded: true
  },
  {
    id: "scrapbox-link",
    name: "Scrapboxリンク",
    body: "[{{cleanTitle}} {{url}}]",
    readonly: false,
    deletable: true,
    seeded: true
  },
  {
    id: "notion-memo",
    name: "Notionメモ",
    body: "{{cleanTitle}}\n{{url}}\n{{if description then description else siteName}}",
    readonly: false,
    deletable: true,
    seeded: true
  }
];
const DEFAULT_VARIABLE_RULES = [
  {
    id: "clean-title",
    name: "クリーンタイトル",
    variable: "cleanTitle",
    source: "title",
    pattern: "",
    transforms: ["fullWidthAlnum", "removeBracketPrefix", "removeSiteSuffix", "trim"],
    readonly: true,
    deletable: false
  },
  {
    id: "url-slug",
    name: "URL末尾",
    variable: "urlSlug",
    source: "pathname",
    pattern: "([^/]+)\\/?$",
    transforms: ["decodeUri", "replaceSeparators", "trim"],
    readonly: true,
    deletable: false
  }
];
const DEFAULT_TRANSFORM_RULES = [
  { id: "decodeUri", name: "URLデコード", type: "builtin", readonly: true, deletable: false },
  { id: "fullWidthAlnum", name: "全角英数字を半角化", type: "builtin", readonly: true, deletable: false },
  { id: "removeBracketPrefix", name: "先頭の括弧情報を削除", type: "builtin", readonly: true, deletable: false },
  { id: "removeSiteSuffix", name: "末尾のサイト名を削除", type: "builtin", readonly: true, deletable: false },
  { id: "replaceSeparators", name: "区切り文字を空白へ", type: "builtin", readonly: true, deletable: false },
  { id: "trim", name: "前後空白を削除", type: "builtin", readonly: true, deletable: false }
];
const DEFAULT_CLIM_OPTIONS = {
  toastEnabled: true,
  templates: DEFAULT_TEMPLATES,
  variableRules: DEFAULT_VARIABLE_RULES,
  transformRules: DEFAULT_TRANSFORM_RULES,
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

  const values = applyVariableRules(getTemplateValues(), options.variableRules, options.transformRules);
  const text = renderTemplate(source === "shortcut" ? template.body : "{{url}}", values);

  await writeToClipboard(text);

  if (options.toastEnabled) {
    // ショートカット時はスロットに割り当てられたテンプレート、
    // 右クリック時は既定の「URLコピー」テンプレートの名前を参照する
    const usedTemplate =
      source === "shortcut" ? template : findTemplate(options.templates, URL_COPY_TEMPLATE_ID);
    const templateName = usedTemplate?.name || "URL";

    showToast(`「${templateName}」をコピーしました`, "success");
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
    variableRules: mergeDefaultVariableRules(options.variableRules),
    transformRules: mergeDefaultTransformRules(options.transformRules),
    shortcutSlots: {
      ...DEFAULT_CLIM_OPTIONS.shortcutSlots,
      ...options.shortcutSlots
    }
  };
}

function mergeDefaultTemplates(templates = []) {
  const defaultTemplateIds = new Set(DEFAULT_TEMPLATES.map((template) => template.id));
  const customTemplates = templates.filter((template) => !defaultTemplateIds.has(template.id));
  return [...DEFAULT_TEMPLATES, ...customTemplates];
}

function mergeDefaultVariableRules(rules = []) {
  const customRules = rules.filter(
    (rule) => !DEFAULT_VARIABLE_RULES.some((defaultRule) => defaultRule.id === rule.id)
  );
  return [...DEFAULT_VARIABLE_RULES, ...customRules];
}

function mergeDefaultTransformRules(rules = []) {
  const customRules = rules.filter(
    (rule) => !DEFAULT_TRANSFORM_RULES.some((defaultRule) => defaultRule.id === rule.id)
  );
  return [...DEFAULT_TRANSFORM_RULES, ...customRules];
}

function findTemplate(templates, templateId) {
  return templates.find((template) => template.id === templateId);
}

function getTemplateValues() {
  const now = new Date();
  const canonicalUrl = getLinkHref("canonical");

  const values = {
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

  return values;
}

function applyVariableRules(values, rules, transformRules) {
  return rules.reduce((nextValues, rule) => {
    if (!isValidVariableName(rule.variable) || nextValues[rule.variable] !== undefined) {
      return nextValues;
    }

    const rawValue = getRuleSourceValue(rule);
    const extractedValue = extractRuleValue(rawValue, rule.pattern);
    const transformedValue = applyRuleTransforms(extractedValue, rule.transforms, transformRules);

    return {
      ...nextValues,
      [rule.variable]: transformedValue
    };
  }, values);
}

function getRuleSourceValue(rule) {
  if (rule.source === "title") {
    return document.title;
  }

  if (rule.source === "url") {
    return window.location.href;
  }

  if (rule.source === "pathname") {
    return window.location.pathname;
  }

  if (rule.source === "hostname") {
    return window.location.hostname;
  }

  return "";
}

function extractRuleValue(value, pattern) {
  if (!pattern) {
    return value;
  }

  try {
    const match = value.match(new RegExp(pattern));
    return match?.[1] ?? match?.[0] ?? "";
  } catch (error) {
    console.warn("[Clim] 変数ルールの正規表現が不正です。", pattern, error);
    return "";
  }
}

function applyRuleTransforms(value, transforms = [], transformRules = []) {
  const transformById = new Map(transformRules.map((rule) => [rule.id, rule]));

  return transforms.reduce((nextValue, transformId) => {
    const transform = transformById.get(transformId);

    if (!transform) {
      return nextValue;
    }

    if (transform.type === "replace") {
      return replaceByTransform(nextValue, transform);
    }

    if (transform.type === "prepend") {
      return `${transform.value || ""}${nextValue}`;
    }

    if (transform.type === "append") {
      return `${nextValue}${transform.value || ""}`;
    }

    if (transform.id === "decodeUri") {
      return decodeUriSafely(nextValue);
    }

    if (transform.id === "fullWidthAlnum") {
      return normalizeFullWidthAlnum(nextValue);
    }

    if (transform.id === "removeBracketPrefix") {
      return nextValue.replace(/^\s*(?:【[^】]+】|\[[^\]]+\])\s*/g, "");
    }

    if (transform.id === "removeSiteSuffix") {
      return nextValue.replace(/\s*(?:[|\-｜–—]\s*(?:Zenn|Qiita|note|Note|クラスメソッド|はてなブログ|GitHub))\s*$/i, "");
    }

    if (transform.id === "replaceSeparators") {
      return nextValue.replace(/[-_]+/g, " ");
    }

    if (transform.id === "trim") {
      return nextValue.trim();
    }

    return nextValue;
  }, value || "");
}

function replaceByTransform(value, transform) {
  try {
    return value.replace(new RegExp(transform.pattern || "", "g"), transform.replacement || "");
  } catch (error) {
    console.warn("[Clim] 変換ルールの正規表現が不正です。", transform.pattern, error);
    return value;
  }
}

function decodeUriSafely(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
}

function normalizeFullWidthAlnum(value) {
  return value.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0)
  );
}

function isValidVariableName(name) {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(name || "");
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
