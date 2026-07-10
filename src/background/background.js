// clim: ショートカットキーだけで各形式のリンクをコピーするService Worker。

import "../shared/shared-config.js";

const COMMAND_FORMATS = {
  "copy-markdown-link": "markdown",
  "copy-markdown-frontmatter-link": "markdownFrontmatter",
  "copy-markdown-quote-link": "markdownQuote",
  "copy-scrapbox-link": "scrapbox",
  "copy-plain-text-link": "plainText",
  "copy-html-link": "html"
};

const CONTEXT_MENU_ROOT_ID = "clim-copy-root";
const CONTEXT_MENU_OPTIONS_ID = "clim-open-options";
const CONTEXT_MENU_TEMPLATE_PREFIX = "clim-copy-template:";
const CONTEXT_MENU_CONTEXTS = ["all"];

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.outputTemplates) {
    createContextMenus();
  }
});

// 開発中の拡張機能リロードやService Worker再起動後も、右クリックメニューを確実に復元します。
createContextMenus();

chrome.commands.onCommand.addListener(async (command) => {
  const format = COMMAND_FORMATS[command];

  if (!format) {
    return;
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id) {
    return;
  }

  // 実際のタイトル取得・URL取得・クリップボード書き込みはcontent.jsへ委譲します。
  // content scriptならページDOMへアクセスでき、トースト表示も自然に行えます。
  await copyLinkFromTab(tab.id, format);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_OPTIONS_ID) {
    chrome.runtime.openOptionsPage();
    return;
  }

  const item = getContextMenuTemplateId(info.menuItemId);

  if (!item || !tab?.id) {
    return;
  }

  await copyLinkFromTab(tab.id, item);
});

async function createContextMenus() {
  const items = await getContextMenuItems();
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: CONTEXT_MENU_ROOT_ID,
    title: "climでクリーンコピー",
    contexts: CONTEXT_MENU_CONTEXTS
  });

  for (const item of items) {
    chrome.contextMenus.create({
      id: `${CONTEXT_MENU_TEMPLATE_PREFIX}${item.id}`,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: item.label,
      contexts: CONTEXT_MENU_CONTEXTS
    });
  }

  chrome.contextMenus.create({
    id: CONTEXT_MENU_OPTIONS_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: "設定ページを開く",
    contexts: CONTEXT_MENU_CONTEXTS
  });
}

async function getContextMenuItems() {
  const defaultTemplates = globalThis.CLIM_DEFAULT_OUTPUT_TEMPLATES || [];
  const stored = await chrome.storage.sync.get({
    outputTemplates: defaultTemplates
  });
  const storedTemplates = Array.isArray(stored.outputTemplates) ? stored.outputTemplates : defaultTemplates;
  const defaultIds = new Set(defaultTemplates.map((template) => template.id));
  const customTemplates = storedTemplates.filter((template) => template?.id && !defaultIds.has(template.id));

  return [
    ...defaultTemplates.map((template) => storedTemplates.find((storedTemplate) => storedTemplate.id === template.id) || template),
    ...customTemplates
  ].filter((template) => template?.id && template?.label);
}

function getContextMenuTemplateId(menuItemId) {
  if (typeof menuItemId !== "string" || !menuItemId.startsWith(CONTEXT_MENU_TEMPLATE_PREFIX)) {
    return "";
  }

  return menuItemId.slice(CONTEXT_MENU_TEMPLATE_PREFIX.length);
}

async function copyLinkFromTab(tabId, format) {
  try {
    const response = await sendCopyCommand(tabId, format);

    if (!response?.ok) {
      console.warn("[clim] リンクのコピーに失敗しました。", response?.error);
    }
  } catch (error) {
    // chrome:// や Chrome Web Store など、content scriptを実行できないページでは失敗します。
    console.warn("[clim] このページではリンクをコピーできませんでした。", error);
  }
}

async function sendCopyCommand(tabId, format) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "CLIM_COPY_LINK",
      format
    });
  } catch (_error) {
    // 拡張機能を読み込む前から開いていたタブではcontent scriptが未注入のことがあります。
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "src/shared/shared-config.js",
        "src/content/clim-utils.js",
        "src/content/clim-metadata.js",
        "src/content/clim-formatters.js",
        "src/content/content.js"
      ]
    });

    return chrome.tabs.sendMessage(tabId, {
      type: "CLIM_COPY_LINK",
      format
    });
  }
}
