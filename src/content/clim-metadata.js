// clim: URL、DOM、meta、JSON-LDからページ固有の情報を集める。

function getPageMetadata(url, siteSettings = []) {
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname.replace(/^www\./, "");

  if (hostname === "zenn.dev") {
    return getZennMetadata(parsedUrl, siteSettings);
  }

  if (hostname === "qiita.com") {
    return getQiitaMetadata(parsedUrl, siteSettings);
  }

  if (hostname === "github.com") {
    return getGitHubMetadata(parsedUrl, siteSettings);
  }

  const title = getKnownSiteTitle(hostname, siteSettings);

  if (title) {
    return {
      site: "known",
      title
    };
  }

  return { site: "generic" };
}

function getZennMetadata(url, siteSettings) {
  return {
    site: "zenn",
    title: getKnownSiteTitle("zenn.dev", siteSettings),
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

function getQiitaMetadata(url, siteSettings) {
  return {
    site: "qiita",
    title: getKnownSiteTitle("qiita.com", siteSettings),
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

function getGitHubMetadata(url, siteSettings) {
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
    metadata.title = getGitHubIssueOrPullTitle(siteSettings) || cleanGitHubTitle(document.title);
  } else if (pathParts.length === 2) {
    metadata.kind = "Repository";
    metadata.title = getGitHubRepositoryTitle(metadata);
  }

  return metadata;
}

function getBestPageTitle(defaultTitle, url, trimmingRules, metadata, siteSettings = []) {
  if (metadata.title) {
    return cleanJapaneseTitle(metadata.title, url, trimmingRules);
  }

  if (!shouldUseDocumentTitle(siteSettings, url)) {
    return "";
  }

  return cleanJapaneseTitle(defaultTitle, url, trimmingRules);
}

function shouldUseDocumentTitle(siteSettings, url) {
  const matchedSettings = getMatchingSiteSettings(siteSettings, url);
  return !matchedSettings.length || matchedSettings.some((setting) => setting.useDocumentTitle !== false);
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

function getKnownSiteTitle(hostname, siteSettings = []) {
  const matchedSettings = getMatchingSiteSettings(siteSettings, `https://${hostname}/`);
  const selectors = getTitleSelectorsFromSettings(matchedSettings, hostname);
  const useJsonLdTitle = matchedSettings.some((setting) => setting.useJsonLdTitle !== false);
  const useOpenGraphTitle = matchedSettings.some((setting) => setting.useOpenGraphTitle !== false);

  if (!selectors.length && !useJsonLdTitle && !useOpenGraphTitle) {
    return "";
  }

  const domTitle = getFirstTextFromSelectors(selectors);

  return domTitle
    || (useJsonLdTitle ? getStructuredPageTitle() : "")
    || (useOpenGraphTitle ? cleanCommonTitleNoise(getMetaContent("og:title")) : "")
    || (useOpenGraphTitle ? cleanCommonTitleNoise(getMetaContent("twitter:title")) : "")
    || "";
}

function getTitleSelectorsFromSettings(settings, hostname) {
  const configuredSelectors = settings
    .flatMap((setting) => String(setting.titleSelectors || "").split("\n"))
    .map((selector) => selector.trim())
    .filter(Boolean);

  return configuredSelectors.length ? configuredSelectors : getKnownSiteTitleSelectors(hostname);
}

function getKnownSiteTitleSelectors(hostname) {
  if (hostname === "zenn.dev") {
    return ["article h1", "main h1", "h1"];
  }

  if (hostname === "qiita.com") {
    return ["article h1", "[data-testid='article-title']", "main h1", "h1"];
  }

  if (hostname === "note.com") {
    return ["article h1", "main h1", "h1"];
  }

  if (hostname === "speakerdeck.com") {
    return [".deck-title", "main h1", "h1"];
  }

  if (hostname === "connpass.com" || hostname === "techplay.jp") {
    return ["main h1", "article h1", "h1"];
  }

  if (
    hostname === "classmethod.jp"
    || hostname === "dev.classmethod.jp"
    || hostname === "gihyo.jp"
    || hostname === "codezine.jp"
    || hostname === "atmarkit.itmedia.co.jp"
    || hostname.endsWith(".hatenablog.com")
    || hostname.endsWith(".hatena.ne.jp")
  ) {
    return ["article h1", ".entry-title", "main h1", "h1"];
  }

  if (hostname === "medium.com" || hostname === "dev.to") {
    return ["article h1", "main h1", "h1"];
  }

  return [];
}

function getFirstTextFromSelectors(selectors) {
  for (const selector of selectors) {
    const title = document.querySelector(selector)?.textContent.trim();

    if (title) {
      return cleanCommonTitleNoise(title);
    }
  }

  return "";
}

function getStructuredPageTitle() {
  const values = [
    ...getJsonLdValues("headline"),
    ...getJsonLdValues("name")
  ];

  for (const value of values) {
    const title = getTextFromStructuredValue(value);

    if (title) {
      return cleanCommonTitleNoise(title);
    }
  }

  return "";
}

function getTextFromStructuredValue(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    return getTextFromStructuredValue(value.name || value.headline || value.text);
  }

  return "";
}

function cleanCommonTitleNoise(title) {
  return String(title)
    .replace(/\s*[-|｜–—·]\s*(?:Zenn|Qiita|GitHub|note|Note|Speaker Deck|connpass|TECH PLAY|クラスメソッド|DevelopersIO)\s*$/i, "")
    .trim();
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

function cleanGitHubTitle(title) {
  return String(title)
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

function getGitHubIssueOrPullTitle(siteSettings = []) {
  const selectors = getTitleSelectorsFromSettings(
    getMatchingSiteSettings(siteSettings, "https://github.com/"),
    "github.com"
  );

  for (const selector of selectors) {
    const title = document.querySelector(selector)?.textContent.trim();

    if (title) {
      return title;
    }
  }

  return "";
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

function formatGitHubStars(stars) {
  return stars ? `★${stars}` : "";
}
