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
  }
];
const DEFAULT_CLIM_OPTIONS = {
  toastEnabled: true,
  templates: DEFAULT_TEMPLATES,
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

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupShortcutButtons();
  setupToastToggle();
  setupTemplateForm();

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
  renderSlotNotes();
}

function renderTemplates() {
  const list = document.getElementById("templateList");

  if (!list) {
    return;
  }

  list.replaceChildren(...climOptions.templates.map(createTemplateCard));
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
    : "ユーザー追加テンプレートです。";
  card.querySelector(".lockedBadge").textContent = template.readonly
    ? "初期テンプレート"
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
    shortcutSlots: {
      ...DEFAULT_CLIM_OPTIONS.shortcutSlots,
      ...options.shortcutSlots
    }
  };
}

function mergeDefaultTemplates(templates = []) {
  const customTemplates = templates.filter((template) => template.id !== URL_COPY_TEMPLATE_ID);
  return [...DEFAULT_TEMPLATES, ...customTemplates];
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

function openShortcutSettings() {
  chrome.tabs.create({
    url: SHORTCUTS_URL
  });
}
