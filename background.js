// clim: ショートカットキーだけで各形式のリンクをコピーするService Worker。

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

const CONTEXT_MENU_ITEMS = [
  {
    id: "clim-copy-markdown",
    title: "Markdown: [タイトル](URL)",
    format: "markdown"
  },
  {
    id: "clim-copy-markdown-frontmatter",
    title: "Markdown + frontmatter",
    format: "markdownFrontmatter"
  },
  {
    id: "clim-copy-markdown-quote",
    title: "Markdown + quote",
    format: "markdownQuote"
  },
  {
    id: "clim-copy-scrapbox",
    title: "Scrapbox: [タイトル URL]",
    format: "scrapbox"
  },
  {
    id: "clim-copy-plain-text",
    title: "プレーンテキスト: タイトル URL",
    format: "plainText"
  },
  {
    id: "clim-copy-html",
    title: "HTML: <a href=\"URL\">タイトル</a>",
    format: "html"
  }
];

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

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

  const item = CONTEXT_MENU_ITEMS.find((menuItem) => menuItem.id === info.menuItemId);

  if (!item || !tab?.id) {
    return;
  }

  await copyLinkFromTab(tab.id, item.format);
});

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ROOT_ID,
      title: "climでクリーンコピー",
      contexts: ["all"]
    });

    for (const item of CONTEXT_MENU_ITEMS) {
      chrome.contextMenus.create({
        id: item.id,
        parentId: CONTEXT_MENU_ROOT_ID,
        title: item.title,
        contexts: ["all"]
      });
    }

    chrome.contextMenus.create({
      id: CONTEXT_MENU_OPTIONS_ID,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: "トリミング設定を開く",
      contexts: ["all"]
    });
  });
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
      files: ["content.js"]
    });

    return chrome.tabs.sendMessage(tabId, {
      type: "CLIM_COPY_LINK",
      format
    });
  }
}
