// clim: ページ情報を日本向けに整形し、複数形式のリンクとしてコピーするcontent script。

var CLIM_FORMAT_LABELS = {
  markdown: "Markdown",
  markdownFrontmatter: "Markdown + frontmatter",
  markdownQuote: "Markdown + quote",
  scrapbox: "Scrapbox",
  plainText: "プレーンテキスト",
  html: "HTML"
};

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
  const trimmingRules = await getTrimmingRules();
  const pageMetadata = getPageMetadata(window.location.href);
  const baseTitle = getBestPageTitle(document.title, window.location.href, trimmingRules, pageMetadata);
  const cleanTitle = enrichTitle(baseTitle, pageMetadata);
  const decodedUrl = decodeJapaneseUrl(window.location.href);
  const text = formatLink(format, cleanTitle, decodedUrl, pageMetadata);

  await writeToClipboard(text);
  return text;
}

function formatLink(format, title, url, metadata) {
  switch (format) {
    case "scrapbox":
      return `[${title} ${url}]`;
    case "plainText":
      return `${title} ${url}`;
    case "html":
      return `<a href="${escapeHtmlAttribute(url)}">${escapeHtmlText(title)}</a>`;
    case "markdownFrontmatter":
      return formatMarkdownFrontmatterLink(title, url, metadata);
    case "markdownQuote":
      return formatMarkdownQuoteLink(title, url, metadata);
    case "markdown":
    default:
      return formatMarkdownLink(title, url, metadata);
  }
}

function formatMarkdownLink(title, url, metadata) {
  const markdown = `[${escapeMarkdownTitle(title)}](${escapeMarkdownUrl(url)})`;
  return appendMarkdownMetadata(markdown, metadata);
}

function formatMarkdownFrontmatterLink(title, url, metadata) {
  const markdown = `[${escapeMarkdownTitle(title)}](${escapeMarkdownUrl(url)})`;

  if (metadata.site === "zenn" || metadata.site === "qiita") {
    return `${formatTechBlogFrontmatter(title, url, metadata)}\n${markdown}`;
  }

  return appendMarkdownMetadata(markdown, metadata);
}

function formatMarkdownQuoteLink(title, url, metadata) {
  const markdown = formatMarkdownLink(title, url, metadata);
  const quote = formatSelectedTextQuote();

  return quote ? `${quote}\n\n${markdown}` : markdown;
}

function formatSelectedTextQuote() {
  const selectedText = cleanSelectedText(window.getSelection()?.toString() || "");

  if (!selectedText) {
    return "";
  }

  return selectedText
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function cleanSelectedText(text) {
  return toHalfWidthAlphaNumeric(text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getPageMetadata(url) {
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname.replace(/^www\./, "");

  if (hostname === "zenn.dev") {
    return getZennMetadata(parsedUrl);
  }

  if (hostname === "qiita.com") {
    return getQiitaMetadata(parsedUrl);
  }

  if (hostname === "github.com") {
    return getGitHubMetadata(parsedUrl);
  }

  return { site: "generic" };
}

function getZennMetadata(url) {
  return {
    site: "zenn",
    author: getZennAuthor(url),
    tags: uniqueList([
      ...getMetaKeywords(),
      ...getJsonLdKeywords(),
      ...getArticleTagTexts()
    ]),
    likes: getLikeCount(),
    published: getPublishedDate()
  };
}

function getQiitaMetadata(url) {
  return {
    site: "qiita",
    author: getQiitaAuthor(url),
    tags: uniqueList([
      ...getMetaKeywords(),
      ...getJsonLdKeywords(),
      ...getArticleTagTexts()
    ]),
    likes: getLikeCount(),
    published: getPublishedDate()
  };
}

function getGitHubMetadata(url) {
  const pathParts = url.pathname.split("/").filter(Boolean);
  const metadata = {
    site: "github",
    owner: pathParts[0],
    repo: pathParts[1],
    language: getGitHubPrimaryLanguage(),
    stars: getGitHubStars(),
    state: getGitHubIssueOrPullState()
  };

  if (pathParts.length >= 4 && (pathParts[2] === "issues" || pathParts[2] === "pull")) {
    metadata.kind = pathParts[2] === "pull" ? "PR" : "Issue";
    metadata.number = pathParts[3];
    metadata.title = getGitHubIssueOrPullTitle() || cleanGitHubTitle(document.title);
  } else if (pathParts.length === 2) {
    metadata.kind = "Repository";
    metadata.title = getGitHubRepositoryTitle(metadata);
  }

  return metadata;
}

function getBestPageTitle(defaultTitle, url, trimmingRules, metadata) {
  if (metadata.site === "github" && metadata.title) {
    return cleanJapaneseTitle(metadata.title, url, trimmingRules);
  }

  return cleanJapaneseTitle(defaultTitle, url, trimmingRules);
}

function enrichTitle(title, metadata) {
  if (metadata.site !== "github") {
    return title;
  }

  const githubTitle = cleanGitHubTitle(metadata.title || title);

  if (metadata.kind === "Repository") {
    const details = [metadata.language, formatGitHubStars(metadata.stars)].filter(Boolean);
    return details.length ? `${githubTitle} (${details.join(", ")})` : githubTitle;
  }

  if (metadata.kind === "Issue" || metadata.kind === "PR") {
    const details = [metadata.kind, metadata.state].filter(Boolean);
    return details.length ? `${githubTitle} (${details.join(" ")})` : githubTitle;
  }

  return githubTitle;
}

function cleanGitHubTitle(title) {
  return title
    .replace(/^\s*GitHub\s*(?:-|:)\s*/i, "")
    .replace(/\s*·\s*(?:Issue|Pull Request)\s*#\d+\s*·\s*[^·]+$/i, "")
    .replace(/\s*·\s*GitHub\s*$/i, "")
    .replace(/\s*-\s*GitHub\s*$/i, "")
    .trim();
}

function getGitHubRepositoryTitle(metadata) {
  if (!metadata.owner || !metadata.repo) {
    return "";
  }

  return `${metadata.owner}/${metadata.repo}`;
}

function getGitHubIssueOrPullTitle() {
  const selectors = [
    "bdi.js-issue-title",
    ".js-issue-title",
    "[data-testid='issue-title']",
    "span.js-issue-title",
    "h1 bdi"
  ];

  for (const selector of selectors) {
    const title = document.querySelector(selector)?.textContent.trim();

    if (title) {
      return title;
    }
  }

  return "";
}

function appendMarkdownMetadata(markdown, metadata) {
  const lines = getMarkdownMetadataLines(metadata);
  return lines.length ? `${markdown}\n${lines.join("\n")}` : markdown;
}

function formatTechBlogFrontmatter(title, url, metadata) {
  const fields = [
    ["title", title],
    ["author", metadata.author ? `@${metadata.author.replace(/^@/, "")}` : ""],
    ["tags", metadata.tags],
    ["likes", metadata.likes],
    ["published", metadata.published],
    ["url", url]
  ].filter(([, value]) => hasFrontmatterValue(value));

  return [
    "---",
    ...fields.map(([key, value]) => `${key}: ${formatYamlValue(value)}`),
    "---"
  ].join("\n");
}

function hasFrontmatterValue(value) {
  return Array.isArray(value) ? value.length > 0 : value !== "" && value !== null && value !== undefined;
}

function formatYamlValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatYamlScalar(item)).join(", ")}]`;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return formatYamlScalar(value);
}

function formatYamlScalar(value) {
  const text = String(value);

  if (/^[A-Za-z0-9_@./:-]+$/.test(text)) {
    return text;
  }

  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function getMarkdownMetadataLines(metadata) {
  if (metadata.site === "zenn" || metadata.site === "qiita") {
    const parts = [
      metadata.author ? `@${metadata.author.replace(/^@/, "")}` : "",
      ...metadata.tags.map((tag) => `#${normalizeTag(tag)}`)
    ].filter(Boolean);

    return parts.length ? [parts.join(" ")] : [];
  }

  return [];
}

function getZennAuthor(url) {
  const pathParts = url.pathname.split("/").filter(Boolean);
  return pathParts[0] || getAuthorFromMeta();
}

function getQiitaAuthor(url) {
  const pathParts = url.pathname.split("/").filter(Boolean);
  return pathParts[0] || getAuthorFromMeta();
}

function getAuthorFromMeta() {
  return getMetaContent("author")
    || getMetaContent("article:author")
    || getMetaContent("twitter:creator")?.replace(/^@/, "")
    || "";
}

function getPublishedDate() {
  return normalizeDate(
    getMetaContent("article:published_time")
      || getMetaContent("datePublished")
      || getJsonLdValues("datePublished")[0]
      || document.querySelector("time[datetime]")?.getAttribute("datetime")
      || document.querySelector("[datetime]")?.getAttribute("datetime")
      || ""
  );
}

function normalizeDate(value) {
  if (!value) {
    return "";
  }

  const text = String(value).trim();
  const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);

  if (dateMatch) {
    return dateMatch[0];
  }

  const parsedDate = new Date(text);
  return Number.isNaN(parsedDate.getTime()) ? text : parsedDate.toISOString().slice(0, 10);
}

function getLikeCount() {
  return getLikeCountFromStructuredData()
    ?? getLikeCountFromDom()
    ?? "";
}

function getLikeCountFromStructuredData() {
  const pageText = Array.from(document.scripts)
    .map((script) => script.textContent)
    .join("\n");
  const patterns = [
    /"likes_count"\s*:\s*(\d+)/i,
    /"likesCount"\s*:\s*(\d+)/i,
    /"liked_count"\s*:\s*(\d+)/i,
    /"likedCount"\s*:\s*(\d+)/i,
    /"likes"\s*:\s*(\d+)/i,
    /"likeCount"\s*:\s*(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = pageText.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function getLikeCountFromDom() {
  const selectors = [
    "[aria-label*='いいね']",
    "[aria-label*='Like']",
    "[aria-label*='like']",
    "[title*='いいね']",
    "[title*='Like']",
    "[class*='like']",
    "[class*='Like']"
  ];

  for (const element of document.querySelectorAll(selectors.join(","))) {
    const count = parseCountFromText([
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.textContent
    ].filter(Boolean).join(" "));

    if (count !== null) {
      return count;
    }
  }

  return null;
}

function parseCountFromText(text) {
  const match = String(text).replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([kK万])?/);

  if (!match) {
    return null;
  }

  const number = Number(match[1]);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (match[2]?.toLowerCase() === "k") {
    return Math.round(number * 1000);
  }

  if (match[2] === "万") {
    return Math.round(number * 10000);
  }

  return Math.round(number);
}

function getMetaKeywords() {
  return getMetaContent("keywords")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function getJsonLdKeywords() {
  return getJsonLdValues("keywords").flatMap((keywords) => {
    if (Array.isArray(keywords)) {
      return keywords;
    }

    return String(keywords)
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  });
}

function getJsonLdValues(key) {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .flatMap((script) => {
      try {
        return collectJsonValues(JSON.parse(script.textContent), key);
      } catch (_error) {
        return [];
      }
    });
}

function collectJsonValues(value, key) {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectJsonValues(item, key));
  }

  return Object.entries(value).flatMap(([entryKey, entryValue]) => {
    const ownValues = entryKey === key ? [entryValue] : [];
    return [...ownValues, ...collectJsonValues(entryValue, key)];
  });
}

function getArticleTagTexts() {
  const selectors = [
    'a[href*="/topics/"]',
    'a[href*="/tags/"]',
    'a[href*="/tag/"]',
    '[class*="tag"] a',
    '[class*="Tag"] a'
  ];

  return Array.from(document.querySelectorAll(selectors.join(",")))
    .map((element) => element.textContent.trim().replace(/^#/, ""))
    .filter((text) => text && text.length <= 40);
}

function getGitHubPrimaryLanguage() {
  return document.querySelector("[itemprop='programmingLanguage']")?.textContent.trim()
    || getMetaContent("octolytics-dimension-repository_language")
    || "";
}

function getGitHubStars() {
  const ariaLabel = document.querySelector("a[href$='/stargazers']")?.getAttribute("aria-label") || "";
  const ariaMatch = ariaLabel.match(/([\d,.]+)\s+users?\s+starred/i);

  if (ariaMatch) {
    return ariaMatch[1];
  }

  return document.querySelector("a[href$='/stargazers'] .Counter")?.textContent.trim() || "";
}

function getGitHubIssueOrPullState() {
  const stateText = document.querySelector(".State")?.textContent.trim()
    || document.querySelector("[data-testid='issue-state-badge']")?.textContent.trim()
    || "";

  if (/closed|merged/i.test(stateText)) {
    return "Closed";
  }

  if (/open/i.test(stateText)) {
    return "Open";
  }

  return "";
}

function getMetaContent(name) {
  const escapedName = cssEscape(name);
  return document.querySelector(`meta[name="${escapedName}"]`)?.content?.trim()
    || document.querySelector(`meta[property="${escapedName}"]`)?.content?.trim()
    || "";
}

function uniqueList(items) {
  const seen = new Set();

  return items
    .map((item) => normalizeTag(item))
    .filter((item) => {
      const key = item.toLowerCase();

      if (!item || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function normalizeTag(tag) {
  return toHalfWidthAlphaNumeric(tag)
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .replace(/[()[\]{}]/g, "")
    .trim();
}

function formatGitHubStars(stars) {
  return stars ? `★${stars}` : "";
}

function cssEscape(value) {
  return value.replace(/["\\]/g, "\\$&");
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

async function getTrimmingRules() {
  const defaultRules = globalThis.CLIM_DEFAULT_TRIMMING_RULES || [];

  try {
    const stored = await chrome.storage.sync.get({
      trimmingRules: defaultRules
    });

    return Array.isArray(stored.trimmingRules) ? stored.trimmingRules : defaultRules;
  } catch (_error) {
    return defaultRules;
  }
}

function cleanJapaneseTitle(title, url, rules) {
  const normalizedTitle = toHalfWidthAlphaNumeric(title)
    .replace(/\s+/g, " ")
    .trim();

  return applyTrimmingRules(normalizedTitle, url, rules);
}

function applyTrimmingRules(title, url, rules) {
  return rules
    .filter((rule) => rule?.enabled !== false && matchesRuleDomain(rule.domain, url))
    .reduce((currentTitle, rule) => applyTrimmingRule(currentTitle, rule), title)
    .replace(/\s+/g, " ")
    .trim();
}

function applyTrimmingRule(title, rule) {
  if (!rule?.pattern) {
    return title;
  }

  if (rule.type === "regex") {
    try {
      return title.replace(new RegExp(rule.pattern, sanitizeRegexFlags(rule.flags)), "");
    } catch (error) {
      console.warn("[clim] 無効なトリミング正規表現をスキップしました。", rule, error);
      return title;
    }
  }

  return title.split(rule.pattern).join("");
}

function matchesRuleDomain(domain, url) {
  const hostname = new URL(url).hostname.replace(/^www\./, "");

  return splitRuleDomains(domain).some((ruleDomain) => {
    if (ruleDomain === "*") {
      return true;
    }

    const normalizedDomain = ruleDomain.replace(/^www\./, "").toLowerCase();
    return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
  });
}

function splitRuleDomains(domain) {
  return String(domain || "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeRegexFlags(flags = "") {
  return Array.from(new Set(String(flags).replace(/[^dgimsuvy]/g, "").split(""))).join("");
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
