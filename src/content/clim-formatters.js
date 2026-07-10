// clim: 集めたページ情報をMarkdownなどの文字列へ変換する。

var CLIM_FORMAT_LABELS = {
  markdown: "Markdown",
  markdownFrontmatter: "Markdown + frontmatter",
  markdownQuote: "Markdown + quote",
  scrapbox: "Scrapbox",
  plainText: "プレーンテキスト",
  html: "HTML"
};

function formatLink(format, title, url, metadata, templates = []) {
  const template = getOutputTemplate(format, templates);
  return renderOutputTemplate(template, format, title, url, metadata);
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

function getOutputTemplate(format, templates) {
  const template = templates.find((item) => item.id === format)?.template;

  if (template) {
    return template;
  }

  const defaultTemplate = (globalThis.CLIM_DEFAULT_OUTPUT_TEMPLATES || []).find((item) => item.id === format)?.template;
  return defaultTemplate || "[{title}]({url})";
}

function renderOutputTemplate(template, format, title, url, metadata) {
  const context = createTemplateContext(format, title, url, metadata);

  return String(template)
    .replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => context[key] ?? "")
    .split("\n")
    .filter((line) => !line.match(/\{\w+\}/))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createTemplateContext(format, title, url, metadata) {
  const selectedText = cleanSelectedText(window.getSelection()?.toString() || "");
  const quote = selectedText
    ? selectedText.split("\n").map((line) => `> ${line}`).join("\n")
    : "";
  const frontmatter = metadata.site === "zenn" || metadata.site === "qiita"
    ? formatTechBlogFrontmatter(title, url, metadata)
    : "";
  const markdownMetadata = getMarkdownMetadataLines(metadata).join("\n");
  const tags = Array.isArray(metadata.tags) ? metadata.tags.join(", ") : "";
  const hashtags = Array.isArray(metadata.tags) ? metadata.tags.map((tag) => `#${normalizeTag(tag)}`).join(" ") : "";

  return {
    title: formatTemplateValue("title", title, format),
    url: formatTemplateValue("url", url, format),
    rawTitle: document.title,
    rawUrl: window.location.href,
    selectedText,
    quote,
    frontmatter,
    markdownMetadata,
    author: metadata.author ? `@${String(metadata.author).replace(/^@/, "")}` : "",
    tags,
    hashtags,
    published: metadata.published || "",
    likes: metadata.likes || "",
    site: metadata.site || "",
    owner: metadata.owner || "",
    repo: metadata.repo || "",
    language: metadata.language || "",
    stars: metadata.stars || "",
    kind: metadata.kind || "",
    number: metadata.number || "",
    state: metadata.state || ""
  };
}

function formatTemplateValue(key, value, format) {
  if (format === "html") {
    return key === "url" ? escapeHtmlAttribute(value) : escapeHtmlText(value);
  }

  if (format === "markdown" || format === "markdownFrontmatter" || format === "markdownQuote") {
    return key === "url" ? escapeMarkdownUrl(value) : escapeMarkdownTitle(value);
  }

  return String(value);
}
