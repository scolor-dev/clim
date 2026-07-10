// Clim: ショートカットとページ右クリックからURLコピーを起動する。

const COPY_COMMAND = "copy-current-url";
const COPY_MENU_ID = "clim-copy-current-url";
const MENU_CONTEXTS = ["page", "selection", "link", "image", "video", "audio", "editable"];
let contextMenuBuildQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => {
  queueCreateContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  queueCreateContextMenus();
});

queueCreateContextMenus();

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== COPY_COMMAND) {
    return;
  }

  const tab = await getActiveTab();

  if (tab?.id) {
    await copyUrlFromTab(tab.id);
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === COPY_MENU_ID && tab?.id) {
    await copyUrlFromTab(tab.id);
  }
});

function queueCreateContextMenus() {
  contextMenuBuildQueue = contextMenuBuildQueue
    .catch((error) => {
      console.warn("[Clim] 右クリックメニューの再生成に失敗しました。", error);
    })
    .then(() => createContextMenus());

  return contextMenuBuildQueue;
}

async function createContextMenus() {
  await removeAllContextMenus();
  await createContextMenu({
    id: COPY_MENU_ID,
    title: "ClimでURLをコピー",
    contexts: MENU_CONTEXTS
  });
}

function removeAllContextMenus() {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      const error = chrome.runtime.lastError;

      if (error) {
        console.warn("[Clim] 右クリックメニューの削除に失敗しました。", error.message);
      }

      resolve();
    });
  });
}

function createContextMenu(options) {
  return new Promise((resolve) => {
    chrome.contextMenus.create(options, () => {
      const error = chrome.runtime.lastError;

      if (error && !error.message.includes("duplicate id")) {
        console.warn("[Clim] 右クリックメニューの作成に失敗しました。", error.message);
      }

      resolve();
    });
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tab;
}

async function copyUrlFromTab(tabId) {
  try {
    await ensureContentScript(tabId);
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "CLIM_COPY_CURRENT_URL"
    });

    if (!response?.ok) {
      console.warn("[Clim] URLコピーに失敗しました。", response?.error);
    }
  } catch (error) {
    console.warn("[Clim] このページではURLをコピーできませんでした。", error);
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "CLIM_PING"
    });
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/content.js"]
    });
  }
}
