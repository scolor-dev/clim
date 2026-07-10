const SHORTCUTS_URL = "chrome://extensions/shortcuts";
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
const BASE_VARIABLE_NAMES = new Set([
  "url",
  "title",
  "canonicalUrl",
  "description",
  "siteName",
  "ogTitle",
  "ogDescription",
  "ogImage",
  "publishedTime",
  "modifiedTime",
  "author",
  "lang",
  "selectedText",
  "domain",
  "date",
  "datetime"
]);
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
const COMMAND_LABELS = {
  "copy-slot-1": "スロット1",
  "copy-slot-2": "スロット2",
  "copy-slot-3": "スロット3",
  "copy-slot-4": "スロット4"
};

let climOptions = DEFAULT_CLIM_OPTIONS;
let editingTemplateId = "";
let editingRuleId = "";
let editingTransformId = "";

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupShortcutButtons();
  setupToastToggle();
  setupTemplateForm();
  setupRuleForm();
  setupTransformForm();

  climOptions = await getClimOptions();
  renderOptions();
  refreshShortcuts();
});

window.addEventListener("focus", refreshShortcuts);

function setupTabs() {
  document.querySelectorAll("[data-tab-button]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetPanelId = button.dataset.tabButton;

      document.querySelectorAll("[data-tab-button]").forEach((tabButton) => {
        tabButton.classList.toggle("isActive", tabButton === button);
      });

      document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
        panel.hidden = panel.id !== targetPanelId;
      });
    });
  });
}

function setupShortcutButtons() {
  document.querySelectorAll("[data-shortcut-button]").forEach((button) => {
    button.addEventListener("click", openShortcutSettings);
  });
}

function setupToastToggle() {
  document.getElementById("toastEnabled")?.addEventListener("change", async (event) => {
    climOptions = {
      ...climOptions,
      toastEnabled: event.currentTarget.checked
    };
    await saveClimOptions(climOptions);
  });
}

function setupTemplateForm() {
  document.getElementById("addTemplate")?.addEventListener("click", () => {
    showTemplateForm();
  });

  document.getElementById("cancelTemplate")?.addEventListener("click", () => {
    hideTemplateForm();
  });

  document.getElementById("templateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveTemplateFromForm();
  });
}

function setupRuleForm() {
  document.getElementById("addRule")?.addEventListener("click", () => {
    showRuleForm();
  });

  document.getElementById("cancelRule")?.addEventListener("click", () => {
    hideRuleForm();
  });

  document.getElementById("ruleForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveRuleFromForm();
  });
}

function setupTransformForm() {
  document.getElementById("addTransform")?.addEventListener("click", () => {
    showTransformForm();
  });

  document.getElementById("cancelTransform")?.addEventListener("click", () => {
    hideTransformForm();
  });

  document.getElementById("transformForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveTransformFromForm();
  });
}

async function refreshShortcuts() {
  let commands = [];

  try {
    commands = await chrome.commands.getAll();
  } catch (error) {
    console.warn("[Clim] ショートカット設定の取得に失敗しました。", error);
  }

  const commandByName = new Map(commands.map((command) => [command.name, command]));

  document.querySelectorAll("[data-command-name]").forEach((slotElement) => {
    const commandName = slotElement.dataset.commandName;
    const command = commandByName.get(commandName);
    const shortcut = command?.shortcut || "";
    const label = COMMAND_LABELS[commandName] || commandName;
    const button = slotElement.querySelector("[data-shortcut-button]");

    if (!button) {
      return;
    }

    button.classList.toggle("isUnset", !shortcut);
    button.textContent = shortcut || "未割り当て";
    button.setAttribute(
      "aria-label",
      `${label}のショートカットをChrome設定で変更する`
    );
  });

  renderSlotNotes();
}

function renderOptions() {
  const toastToggle = document.getElementById("toastEnabled");

  if (toastToggle) {
    toastToggle.checked = climOptions.toastEnabled;
  }

  renderTemplates();
  renderRules();
  renderTransforms();
  renderSlotNotes();
}

function renderTemplates() {
  const list = document.getElementById("templateList");

  if (!list) {
    return;
  }

  list.replaceChildren(...climOptions.templates.map(createTemplateCard));
}

function renderRules() {
  const list = document.getElementById("ruleList");

  if (!list) {
    return;
  }

  list.replaceChildren(...climOptions.variableRules.map(createRuleCard));
}

function renderTransforms() {
  const list = document.getElementById("transformList");

  if (!list) {
    return;
  }

  list.replaceChildren(...climOptions.transformRules.map(createTransformCard));
  renderTransformChoices();
}

function createTemplateCard(template) {
  const card = document.createElement("article");
  card.className = "templateCard";
  card.dataset.templateId = template.id;

  card.innerHTML = `
    <div class="templateHeader">
      <div>
        <h3></h3>
        <p></p>
      </div>
      <span class="lockedBadge"></span>
    </div>
    <pre class="templatePreview"><code></code></pre>
    <fieldset class="slotAssignment">
      <legend>割り当てショートカット</legend>
      ${[1, 2, 3, 4].map((slot) => `
        <label>
          <input type="checkbox" value="${slot}" data-slot-assignment>
          スロット${slot}
        </label>
      `).join("")}
    </fieldset>
    <div class="templateActions" aria-label="テンプレート操作">
      <button type="button" data-edit-template></button>
      <button type="button" data-delete-template></button>
    </div>
  `;

  card.querySelector("h3").textContent = template.name;
  card.querySelector(".templateHeader p").textContent = template.readonly
    ? "現在のページURLを加工せずそのままコピーします。"
    : template.seeded
      ? "初期テンプレートです。編集・削除できます。"
      : "ユーザー追加テンプレートです。";
  card.querySelector(".lockedBadge").textContent = template.readonly
    ? "初期テンプレート"
    : template.seeded
      ? "編集可"
      : "カスタム";
  card.querySelector("code").textContent = template.body;

  card.querySelectorAll("[data-slot-assignment]").forEach((checkbox) => {
    checkbox.checked = Object.values(climOptions.shortcutSlots).includes(template.id)
      && climOptions.shortcutSlots[checkbox.value] === template.id;
    checkbox.addEventListener("change", async () => {
      await assignTemplateToSlot(template.id, checkbox.value, checkbox.checked);
    });
  });

  const editButton = card.querySelector("[data-edit-template]");
  editButton.textContent = template.readonly ? "編集不可" : "編集";
  editButton.disabled = template.readonly;
  editButton.addEventListener("click", () => {
    showTemplateForm(template);
  });

  const deleteButton = card.querySelector("[data-delete-template]");
  deleteButton.textContent = template.deletable === false ? "削除不可" : "削除";
  deleteButton.disabled = template.deletable === false;
  deleteButton.addEventListener("click", async () => {
    await deleteTemplate(template.id);
  });

  return card;
}

function createRuleCard(rule) {
  const card = document.createElement("article");
  card.className = "templateCard";
  card.dataset.ruleId = rule.id;

  card.innerHTML = `
    <div class="templateHeader">
      <div>
        <h3></h3>
        <p></p>
      </div>
      <span class="lockedBadge"></span>
    </div>
    <div class="ruleMeta">
      <code></code>
      <code></code>
      <code></code>
    </div>
    <div class="templateActions" aria-label="差し込み項目操作">
      <button type="button" data-edit-rule></button>
      <button type="button" data-delete-rule></button>
    </div>
  `;

  card.querySelector("h3").textContent = rule.name;
  card.querySelector(".templateHeader p").textContent = rule.readonly
    ? "初期項目です。テンプレートでそのまま使えます。"
    : "ユーザー追加の差し込み項目です。";
  card.querySelector(".lockedBadge").textContent = rule.readonly ? "初期項目" : "カスタム";

  const [variableCode, sourceCode, transformCode] = card.querySelectorAll("code");
  variableCode.textContent = `{{${rule.variable}}}`;
  sourceCode.textContent = `取得元: ${getRuleSourceLabel(rule.source)}${rule.pattern ? ` / ${rule.pattern}` : ""}`;
  transformCode.textContent = `整形: ${rule.transforms?.length ? rule.transforms.join(", ") : "なし"}`;

  const editButton = card.querySelector("[data-edit-rule]");
  editButton.textContent = rule.readonly ? "編集不可" : "編集";
  editButton.disabled = rule.readonly;
  editButton.addEventListener("click", () => {
    showRuleForm(rule);
  });

  const deleteButton = card.querySelector("[data-delete-rule]");
  deleteButton.textContent = rule.deletable === false ? "削除不可" : "削除";
  deleteButton.disabled = rule.deletable === false;
  deleteButton.addEventListener("click", async () => {
    await deleteRule(rule.id);
  });

  return card;
}

function createTransformCard(transform) {
  const card = document.createElement("article");
  card.className = "templateCard";
  card.dataset.transformId = transform.id;

  card.innerHTML = `
    <div class="templateHeader">
      <div>
        <h3></h3>
        <p></p>
      </div>
      <span class="lockedBadge"></span>
    </div>
    <div class="ruleMeta">
      <code></code>
      <code></code>
    </div>
    <div class="templateActions" aria-label="整形ルール操作">
      <button type="button" data-edit-transform></button>
      <button type="button" data-delete-transform></button>
    </div>
  `;

  card.querySelector("h3").textContent = transform.name;
  card.querySelector(".templateHeader p").textContent = transform.readonly
    ? "組み込みの整形ルールです。差し込み項目から利用できます。"
    : "ユーザー追加の整形ルールです。";
  card.querySelector(".lockedBadge").textContent = transform.readonly ? "組み込み" : "カスタム";

  const [idCode, detailCode] = card.querySelectorAll("code");
  idCode.textContent = transform.id;
  detailCode.textContent = getTransformDescription(transform);

  const editButton = card.querySelector("[data-edit-transform]");
  editButton.textContent = transform.readonly ? "編集不可" : "編集";
  editButton.disabled = transform.readonly;
  editButton.addEventListener("click", () => {
    showTransformForm(transform);
  });

  const deleteButton = card.querySelector("[data-delete-transform]");
  deleteButton.textContent = transform.deletable === false ? "削除不可" : "削除";
  deleteButton.disabled = transform.deletable === false;
  deleteButton.addEventListener("click", async () => {
    await deleteTransform(transform.id);
  });

  return card;
}

function renderTransformChoices() {
  const choices = document.getElementById("ruleTransformChoices");

  if (!choices) {
    return;
  }

  choices.replaceChildren(...climOptions.transformRules.map((transform) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = transform.id;
    checkbox.dataset.ruleTransform = "";
    label.append(checkbox, transform.name);
    return label;
  }));
}

async function assignTemplateToSlot(templateId, slot, assigned) {
  const shortcutSlots = { ...climOptions.shortcutSlots };

  shortcutSlots[slot] = assigned ? templateId : "";
  climOptions = {
    ...climOptions,
    shortcutSlots
  };

  await saveClimOptions(climOptions);
  renderTemplates();
  renderSlotNotes();
}

function renderSlotNotes() {
  document.querySelectorAll("[data-command-name]").forEach((slotElement) => {
    const slot = slotElement.dataset.commandName?.replace("copy-slot-", "");
    const note = slotElement.querySelector("[data-shortcut-note]");
    const template = findTemplate(climOptions.shortcutSlots[slot]);

    if (!note) {
      return;
    }

    note.textContent = template
      ? `${template.name} テンプレートが割り当てられています。`
      : "テンプレート未割り当てです。テンプレート画面から変更できます。";
  });
}

function showTemplateForm(template = null) {
  const form = document.getElementById("templateForm");
  const nameInput = document.getElementById("templateName");
  const bodyInput = document.getElementById("templateBody");

  if (!form || !nameInput || !bodyInput) {
    return;
  }

  editingTemplateId = template?.id || "";
  nameInput.value = template?.name || "";
  bodyInput.value = template?.body || "[{{title}}]({{url}})";
  form.hidden = false;
  nameInput.focus();
}

function hideTemplateForm() {
  const form = document.getElementById("templateForm");

  if (!form) {
    return;
  }

  editingTemplateId = "";
  form.reset();
  form.hidden = true;
}

async function saveTemplateFromForm() {
  const name = document.getElementById("templateName")?.value.trim();
  const body = document.getElementById("templateBody")?.value.trim();

  if (!name || !body) {
    return;
  }

  if (editingTemplateId) {
    climOptions = {
      ...climOptions,
      templates: climOptions.templates.map((template) => {
        if (template.id !== editingTemplateId || template.readonly) {
          return template;
        }

        return {
          ...template,
          name,
          body
        };
      })
    };
  } else {
    climOptions = {
      ...climOptions,
      templates: [
        ...climOptions.templates,
        {
          id: crypto.randomUUID(),
          name,
          body,
          readonly: false,
          deletable: true
        }
      ]
    };
  }

  await saveClimOptions(climOptions);
  hideTemplateForm();
  renderTemplates();
  renderSlotNotes();
}

async function deleteTemplate(templateId) {
  const template = findTemplate(templateId);

  if (!template || template.deletable === false) {
    return;
  }

  climOptions = {
    ...climOptions,
    templates: climOptions.templates.filter((item) => item.id !== templateId),
    shortcutSlots: Object.fromEntries(
      Object.entries(climOptions.shortcutSlots).map(([slot, assignedTemplateId]) => [
        slot,
        assignedTemplateId === templateId ? "" : assignedTemplateId
      ])
    )
  };

  await saveClimOptions(climOptions);
  renderTemplates();
  renderSlotNotes();
}

function showRuleForm(rule = null) {
  const form = document.getElementById("ruleForm");
  const nameInput = document.getElementById("ruleName");
  const variableInput = document.getElementById("ruleVariable");
  const sourceInput = document.getElementById("ruleSource");
  const patternInput = document.getElementById("rulePattern");

  if (!form || !nameInput || !variableInput || !sourceInput || !patternInput) {
    return;
  }

  editingRuleId = rule?.id || "";
  nameInput.value = rule?.name || "";
  variableInput.value = rule?.variable || "";
  sourceInput.value = rule?.source || "title";
  patternInput.value = rule?.pattern || "";
  document.querySelectorAll("[data-rule-transform]").forEach((checkbox) => {
    checkbox.checked = rule?.transforms?.includes(checkbox.value) || false;
  });
  setRuleError("");
  form.hidden = false;
  nameInput.focus();
}

function hideRuleForm() {
  const form = document.getElementById("ruleForm");

  if (!form) {
    return;
  }

  editingRuleId = "";
  form.reset();
  setRuleError("");
  form.hidden = true;
}

function showTransformForm(transform = null) {
  const form = document.getElementById("transformForm");
  const nameInput = document.getElementById("transformName");
  const idInput = document.getElementById("transformId");
  const typeInput = document.getElementById("transformType");
  const patternInput = document.getElementById("transformPattern");
  const valueInput = document.getElementById("transformValue");

  if (!form || !nameInput || !idInput || !typeInput || !patternInput || !valueInput) {
    return;
  }

  editingTransformId = transform?.id || "";
  nameInput.value = transform?.name || "";
  idInput.value = transform?.id || "";
  idInput.disabled = Boolean(transform);
  typeInput.value = transform?.type === "builtin" ? "replace" : transform?.type || "replace";
  patternInput.value = transform?.pattern || "";
  valueInput.value = transform?.replacement ?? transform?.value ?? "";
  setTransformError("");
  form.hidden = false;
  nameInput.focus();
}

function hideTransformForm() {
  const form = document.getElementById("transformForm");
  const idInput = document.getElementById("transformId");

  if (!form) {
    return;
  }

  editingTransformId = "";
  form.reset();
  if (idInput) {
    idInput.disabled = false;
  }
  setTransformError("");
  form.hidden = true;
}

async function saveRuleFromForm() {
  const name = document.getElementById("ruleName")?.value.trim();
  const variable = document.getElementById("ruleVariable")?.value.trim();
  const source = document.getElementById("ruleSource")?.value;
  const pattern = document.getElementById("rulePattern")?.value.trim();
  const transforms = Array.from(document.querySelectorAll("[data-rule-transform]:checked"))
    .map((checkbox) => checkbox.value);

  if (!name || !variable || !source) {
    return;
  }

  const validationError = validateRuleVariable(variable, editingRuleId);

  if (validationError) {
    setRuleError(validationError);
    return;
  }

  if (editingRuleId) {
    climOptions = {
      ...climOptions,
      variableRules: climOptions.variableRules.map((rule) => {
        if (rule.id !== editingRuleId || rule.readonly) {
          return rule;
        }

        return {
          ...rule,
          name,
          variable,
          source,
          pattern,
          transforms
        };
      })
    };
  } else {
    climOptions = {
      ...climOptions,
      variableRules: [
        ...climOptions.variableRules,
        {
          id: crypto.randomUUID(),
          name,
          variable,
          source,
          pattern,
          transforms,
          readonly: false,
          deletable: true
        }
      ]
    };
  }

  await saveClimOptions(climOptions);
  hideRuleForm();
  renderRules();
}

async function saveTransformFromForm() {
  const name = document.getElementById("transformName")?.value.trim();
  const id = document.getElementById("transformId")?.value.trim();
  const type = document.getElementById("transformType")?.value;
  const pattern = document.getElementById("transformPattern")?.value;
  const value = document.getElementById("transformValue")?.value;

  if (!name || !id || !type) {
    return;
  }

  const validationError = validateTransformRule({ id, type, pattern }, editingTransformId);

  if (validationError) {
    setTransformError(validationError);
    return;
  }

  const nextTransform = {
    id,
    name,
    type,
    pattern,
    replacement: type === "replace" ? value : "",
    value: type === "replace" ? "" : value,
    readonly: false,
    deletable: true
  };

  climOptions = {
    ...climOptions,
    transformRules: editingTransformId
      ? climOptions.transformRules.map((transform) =>
          transform.id === editingTransformId && !transform.readonly
            ? { ...transform, ...nextTransform, id: transform.id }
            : transform
        )
      : [...climOptions.transformRules, nextTransform]
  };

  await saveClimOptions(climOptions);
  hideTransformForm();
  renderTransforms();
  renderRules();
}

async function deleteRule(ruleId) {
  const rule = climOptions.variableRules.find((item) => item.id === ruleId);

  if (!rule || rule.deletable === false) {
    return;
  }

  climOptions = {
    ...climOptions,
    variableRules: climOptions.variableRules.filter((item) => item.id !== ruleId)
  };

  await saveClimOptions(climOptions);
  renderRules();
}

async function deleteTransform(transformId) {
  const transform = climOptions.transformRules.find((item) => item.id === transformId);

  if (!transform || transform.deletable === false) {
    return;
  }

  climOptions = {
    ...climOptions,
    transformRules: climOptions.transformRules.filter((item) => item.id !== transformId),
    variableRules: climOptions.variableRules.map((rule) => ({
      ...rule,
      transforms: (rule.transforms || []).filter((id) => id !== transformId)
    }))
  };

  await saveClimOptions(climOptions);
  renderTransforms();
  renderRules();
}

async function getClimOptions() {
  let stored = {};

  try {
    stored = await chrome.storage.sync.get(CLIM_STORAGE_KEY);
  } catch (error) {
    console.warn("[Clim] 設定の取得に失敗しました。", error);
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

async function saveClimOptions(options) {
  try {
    await chrome.storage.sync.set({
      [CLIM_STORAGE_KEY]: options
    });
  } catch (error) {
    console.warn("[Clim] 設定の保存に失敗しました。", error);
  }
}

function findTemplate(templateId) {
  return climOptions.templates.find((template) => template.id === templateId);
}

function validateRuleVariable(variable, currentRuleId = "") {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(variable)) {
    return "差し込み名は半角英字ではじめ、半角英数字のみで入力してください。";
  }

  if (BASE_VARIABLE_NAMES.has(variable)) {
    return "基本セットと同じ差し込み名は使えません。";
  }

  const duplicatedRule = climOptions.variableRules.find((rule) =>
    rule.variable === variable && rule.id !== currentRuleId
  );

  return duplicatedRule ? "同じ差し込み名の項目がすでにあります。" : "";
}

function validateTransformRule(transform, currentTransformId = "") {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(transform.id)) {
    return "整形キーは半角英字ではじめ、半角英数字のみで入力してください。";
  }

  const duplicatedTransform = climOptions.transformRules.find((rule) =>
    rule.id === transform.id && rule.id !== currentTransformId
  );

  if (duplicatedTransform) {
    return "同じ整形キーのルールがすでにあります。";
  }

  if (transform.type === "replace" && !transform.pattern) {
    return "正規表現で置換する場合は、検索パターンを入力してください。";
  }

  return "";
}

function setRuleError(message) {
  const error = document.getElementById("ruleError");

  if (!error) {
    return;
  }

  error.textContent = message;
  error.hidden = !message;
}

function setTransformError(message) {
  const error = document.getElementById("transformError");

  if (!error) {
    return;
  }

  error.textContent = message;
  error.hidden = !message;
}

function getRuleSourceLabel(source) {
  return {
    title: "ページタイトル",
    url: "URL全体",
    pathname: "URLパス",
    hostname: "ホスト名"
  }[source] || source;
}

function getTransformDescription(transform) {
  if (transform.type === "replace") {
    return `正規表現置換: ${transform.pattern || ""} -> ${transform.replacement || ""}`;
  }

  if (transform.type === "prepend") {
    return `先頭に追加: ${transform.value || ""}`;
  }

  if (transform.type === "append") {
    return `末尾に追加: ${transform.value || ""}`;
  }

  return "組み込み整形";
}

function openShortcutSettings() {
  chrome.tabs.create({
    url: SHORTCUTS_URL
  });
}
