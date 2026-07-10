const DEFAULT_OUTPUT_TEMPLATES = globalThis.CLIM_DEFAULT_OUTPUT_TEMPLATES || [];
const DEFAULT_SITE_SETTINGS = globalThis.CLIM_DEFAULT_SITE_SETTINGS || [];

const templatesList = document.getElementById("templatesList");
const sitesList = document.getElementById("sitesList");
const templateItemTemplate = document.getElementById("templateItemTemplate");
const siteItemTemplate = document.getElementById("siteItemTemplate");
const message = document.getElementById("message");

const stored = await chrome.storage.sync.get({
  outputTemplates: DEFAULT_OUTPUT_TEMPLATES,
  siteSettings: DEFAULT_SITE_SETTINGS
});

renderTemplates(mergeOutputTemplates(stored.outputTemplates, DEFAULT_OUTPUT_TEMPLATES));
renderSites(mergeSiteSettings(stored.siteSettings, DEFAULT_SITE_SETTINGS));

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === tab.dataset.panel);
    });
  });
});

document.getElementById("addTemplate").addEventListener("click", () => {
  appendTemplateItem({
    id: createId("template"),
    label: "カスタム",
    template: "[{title}]({url})",
    locked: false
  });
});

document.getElementById("addSite").addEventListener("click", () => {
  appendSiteItem({
    id: createId("site"),
    enabled: true,
    domain: "example.com",
    titleSelectors: "article h1\nmain h1\nh1",
    useJsonLdTitle: true,
    useOpenGraphTitle: true,
    useDocumentTitle: true,
    trimmingRules: "",
    locked: false
  });
});

document.getElementById("resetSettings").addEventListener("click", () => {
  renderTemplates(DEFAULT_OUTPUT_TEMPLATES);
  renderSites(DEFAULT_SITE_SETTINGS);
  showMessage("初期設定を読み込みました。保存すると反映されます。");
});

document.getElementById("saveSettings").addEventListener("click", async () => {
  const outputTemplates = readTemplates();
  const siteSettings = readSites();
  const invalidTemplate = outputTemplates.find((template) => !template.id || !template.label || !template.template);
  const invalidSite = siteSettings.find((setting) => !setting.domain);
  const invalidRule = siteSettings.flatMap((setting) => parseTrimmingRulesText(setting.trimmingRules, setting.domain))
    .find((rule) => rule.type === "regex" && !isValidRegex(rule.pattern, rule.flags));

  if (invalidTemplate) {
    showMessage("テンプレートの名前、ID、本文を入力してください。");
    return;
  }

  if (invalidSite) {
    showMessage("サイト別設定のドメインを入力してください。");
    return;
  }

  if (invalidRule) {
    showMessage(`正規表現が無効です: ${invalidRule.description || invalidRule.pattern}`);
    return;
  }

  await chrome.storage.sync.set({
    outputTemplates,
    siteSettings
  });
  await chrome.storage.sync.remove("trimmingRules");
  showMessage("保存しました");
});

function renderTemplates(templates) {
  templatesList.replaceChildren();
  templates.forEach((template) => appendTemplateItem(template));
}

function appendTemplateItem(template) {
  const item = templateItemTemplate.content.firstElementChild.cloneNode(true);
  item.dataset.locked = template.locked === true ? "true" : "false";
  item.querySelector(".templateId").value = template.id || createId("template");
  item.querySelector(".templateLabel").value = template.label || "";
  item.querySelector(".templateText").value = template.template || "";

  const idInput = item.querySelector(".templateId");
  const deleteButton = item.querySelector(".deleteTemplate");
  idInput.readOnly = template.locked === true;
  deleteButton.disabled = template.locked === true;

  deleteButton.addEventListener("click", () => item.remove());
  templatesList.appendChild(item);
}

function readTemplates() {
  return Array.from(templatesList.querySelectorAll(".outputTemplateItem"))
    .map((item) => ({
      id: item.querySelector(".templateId").value.trim(),
      label: item.querySelector(".templateLabel").value.trim(),
      template: item.querySelector(".templateText").value,
      locked: item.dataset.locked === "true"
    }));
}

function renderSites(settings) {
  sitesList.replaceChildren();
  settings.forEach((setting) => appendSiteItem(setting));
}

function appendSiteItem(setting) {
  const item = siteItemTemplate.content.firstElementChild.cloneNode(true);
  item.dataset.id = setting.id || createId("site");
  item.dataset.locked = setting.locked === true ? "true" : "false";
  item.querySelector(".siteEnabled").checked = setting.enabled !== false;
  item.querySelector(".siteDomain").value = setting.domain || "*";
  item.querySelector(".titleSelectors").value = setting.titleSelectors || "";
  item.querySelector(".useJsonLdTitle").checked = setting.useJsonLdTitle !== false;
  item.querySelector(".useOpenGraphTitle").checked = setting.useOpenGraphTitle !== false;
  item.querySelector(".useDocumentTitle").checked = setting.useDocumentTitle !== false;
  item.querySelector(".trimmingRules").value = setting.trimmingRules || "";

  const domainInput = item.querySelector(".siteDomain");
  const deleteButton = item.querySelector(".deleteSite");
  domainInput.readOnly = setting.locked === true;
  deleteButton.disabled = setting.locked === true;

  deleteButton.addEventListener("click", () => item.remove());
  sitesList.appendChild(item);
}

function readSites() {
  return Array.from(sitesList.querySelectorAll(".siteItem"))
    .map((item) => ({
      id: item.dataset.id || createId("site"),
      enabled: item.querySelector(".siteEnabled").checked,
      locked: item.dataset.locked === "true",
      domain: item.dataset.locked === "true" ? "*" : item.querySelector(".siteDomain").value.trim(),
      titleSelectors: item.querySelector(".titleSelectors").value,
      useJsonLdTitle: item.querySelector(".useJsonLdTitle").checked,
      useOpenGraphTitle: item.querySelector(".useOpenGraphTitle").checked,
      useDocumentTitle: item.querySelector(".useDocumentTitle").checked,
      trimmingRules: item.querySelector(".trimmingRules").value
    }));
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
    locked: template.locked === true
  }));
  const custom = Array.isArray(storedTemplates)
    ? storedTemplates.filter((template) => template?.id && !defaultTemplates.some((defaultTemplate) => defaultTemplate.id === template.id))
    : [];

  return [...merged, ...custom];
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
  const custom = Array.isArray(storedSettings)
    ? storedSettings.filter((setting) => setting?.id && !defaultSettings.some((defaultSetting) => defaultSetting.id === setting.id))
    : [];

  return [...merged, ...custom];
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

function isValidRegex(pattern, flags) {
  try {
    new RegExp(pattern, sanitizeRegexFlags(flags));
    return true;
  } catch (_error) {
    return false;
  }
}

function sanitizeRegexFlags(flags = "") {
  return Array.from(new Set(String(flags).replace(/[^dgimsuvy]/g, "").split(""))).join("");
}

function createId(prefix) {
  return crypto.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showMessage(text) {
  message.textContent = text;

  window.setTimeout(() => {
    if (message.textContent === text) {
      message.textContent = "";
    }
  }, 2400);
}
