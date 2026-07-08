// clim: ショートカットキーだけで各形式のリンクをコピーするService Worker。

const COMMAND_FORMATS = {
  "copy-markdown-link": "markdown",
  "copy-scrapbox-link": "scrapbox",
  "copy-plain-text-link": "plainText",
  "copy-html-link": "html"
};

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
  try {
    // 拡張機能を読み込む前から開いていたタブでも動くよう、ショートカット時に注入します。
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "CLIM_COPY_LINK",
      format
    });

    if (!response?.ok) {
      console.warn("[clim] リンクのコピーに失敗しました。", response?.error);
    }
  } catch (error) {
    // chrome:// や Chrome Web Store など、content scriptを実行できないページでは失敗します。
    console.warn("[clim] このページではMarkdownリンクをコピーできませんでした。", error);
  }
});
