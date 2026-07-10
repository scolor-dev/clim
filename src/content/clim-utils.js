// clim: content script群で共有する小さなユーティリティ。

function getMetaContent(name) {
  const escapedName = cssEscape(name);
  return document.querySelector(`meta[name="${escapedName}"]`)?.content?.trim()
    || document.querySelector(`meta[property="${escapedName}"]`)?.content?.trim()
    || "";
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

function cssEscape(value) {
  return value.replace(/["\\]/g, "\\$&");
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

async function getOutputTemplates() {
  const defaultTemplates = globalThis.CLIM_DEFAULT_OUTPUT_TEMPLATES || [];

  try {
    const stored = await chrome.storage.sync.get({
      outputTemplates: defaultTemplates
    });

    return mergeOutputTemplates(stored.outputTemplates, defaultTemplates);
  } catch (_error) {
    return defaultTemplates;
  }
}

async function getSiteSettings() {
  const defaultSiteSettings = globalThis.CLIM_DEFAULT_SITE_SETTINGS || [];

  try {
    const stored = await chrome.storage.sync.get({
      siteSettings: defaultSiteSettings,
      trimmingRules: []
    });

    const siteSettings = mergeSiteSettings(stored.siteSettings, defaultSiteSettings);

    if (Array.isArray(stored.trimmingRules) && stored.trimmingRules.length) {
      return mergeLegacyTrimmingRules(siteSettings, stored.trimmingRules);
    }

    return siteSettings;
  } catch (_error) {
    return defaultSiteSettings;
  }
}

function mergeOutputTemplates(storedTemplates, defaultTemplates) {
  const storedById = new Map(
    Array.isArray(storedTemplates)
      ? storedTemplates.map((template) => [template.id, template])
      : []
  );

  const merged = defaultTemplates.map((template) => ({
    ...template,
    ...storedById.get(template.id),
    id: template.id,
    label: storedById.get(template.id)?.label || template.label,
    locked: template.locked === true
  }));

  const customTemplates = Array.isArray(storedTemplates)
    ? storedTemplates.filter((template) => template?.id && !defaultTemplates.some((defaultTemplate) => defaultTemplate.id === template.id))
    : [];

  return [...merged, ...customTemplates];
}

function mergeSiteSettings(storedSettings, defaultSettings) {
  const storedById = new Map(
    Array.isArray(storedSettings)
      ? storedSettings.map((setting) => [setting.id, setting])
      : []
  );

  const merged = defaultSettings.map((setting) => ({
    ...setting,
    ...storedById.get(setting.id),
    id: setting.id,
    domain: setting.locked ? setting.domain : storedById.get(setting.id)?.domain || setting.domain,
    locked: setting.locked === true
  }));

  const customSettings = Array.isArray(storedSettings)
    ? storedSettings.filter((setting) => setting?.id && !defaultSettings.some((defaultSetting) => defaultSetting.id === setting.id))
    : [];

  return [...merged, ...customSettings];
}

function mergeLegacyTrimmingRules(siteSettings, trimmingRules) {
  const rootSetting = siteSettings.find((setting) => setting.id === "root");

  if (!rootSetting) {
    return siteSettings;
  }

  return siteSettings.map((setting) => {
    if (setting.id !== "root") {
      return setting;
    }

    return {
      ...setting,
      trimmingRules: trimmingRulesToText(trimmingRules)
    };
  });
}

function getMatchingSiteSettings(siteSettings, url) {
  return siteSettings.filter((setting) => setting?.enabled !== false && matchesRuleDomain(setting.domain, url));
}

function getTrimmingRulesFromSiteSettings(siteSettings, url) {
  return getMatchingSiteSettings(siteSettings, url)
    .flatMap((setting) => parseTrimmingRulesText(setting.trimmingRules, setting.domain));
}

function parseTrimmingRulesText(text, domain = "*") {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [type, pattern, flags = "", description = ""] = splitRuleLine(line);
      return {
        id: `${domain}-${index}`,
        enabled: true,
        domain,
        type: type === "text" ? "text" : "regex",
        pattern: pattern || "",
        flags,
        description
      };
    })
    .filter((rule) => rule.pattern);
}

function splitRuleLine(line) {
  const parts = [];
  let current = "";

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const previousChar = line[index - 1];

    if (char === "|" && previousChar !== "\\") {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  parts.push(current);
  return parts;
}

function trimmingRulesToText(rules) {
  return rules
    .filter((rule) => rule?.pattern)
    .map((rule) => [
      rule.type === "text" ? "text" : "regex",
      rule.pattern,
      rule.flags || "",
      rule.description || ""
    ].join("|"))
    .join("\n");
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

function toHalfWidthAlphaNumeric(text) {
  // 全角英数字だけを半角化します。日本語や記号はなるべく壊さず残します。
  return String(text).replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
  });
}

function escapeHtmlText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function escapeMarkdownTitle(title) {
  // Markdownリンクの表示テキストで壊れやすい文字だけエスケープします。
  return String(title).replace(/([\\[\]])/g, "\\$1");
}

function escapeMarkdownUrl(url) {
  // URL内の閉じ括弧はMarkdownリンクを壊すためエスケープします。
  return String(url).replace(/[\\)]/g, "\\$&");
}
