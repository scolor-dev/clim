const DEFAULT_TRIMMING_RULES = globalThis.CLIM_DEFAULT_TRIMMING_RULES || [];

const rulesBody = document.getElementById("rulesBody");
const rulesForm = document.getElementById("rulesForm");
const rowTemplate = document.getElementById("ruleRowTemplate");
const addRuleButton = document.getElementById("addRule");
const resetRulesButton = document.getElementById("resetRules");
const message = document.getElementById("message");

const stored = await chrome.storage.sync.get({
  trimmingRules: DEFAULT_TRIMMING_RULES
});

renderRules(Array.isArray(stored.trimmingRules) ? stored.trimmingRules : DEFAULT_TRIMMING_RULES);

addRuleButton.addEventListener("click", () => {
  appendRuleRow({
    id: createRuleId(),
    enabled: true,
    domain: "*",
    type: "text",
    pattern: "",
    flags: "",
    description: ""
  });
});

resetRulesButton.addEventListener("click", () => {
  renderRules(DEFAULT_TRIMMING_RULES);
  showMessage("初期ルールを読み込みました。保存すると反映されます。");
});

rulesForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const rules = readRulesFromForm();
  const invalidRule = rules.find((rule) => rule.type === "regex" && !isValidRegex(rule.pattern, rule.flags));

  if (invalidRule) {
    showMessage(`正規表現が無効です: ${invalidRule.description || invalidRule.pattern}`);
    return;
  }

  await chrome.storage.sync.set({ trimmingRules: rules });
  showMessage("保存しました");
});

function renderRules(rules) {
  rulesBody.replaceChildren();
  rules.forEach((rule) => appendRuleRow(rule));
}

function appendRuleRow(rule) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.id = rule.id || createRuleId();
  row.querySelector(".enabled").checked = rule.enabled !== false;
  row.querySelector(".domain").value = rule.domain || "*";
  row.querySelector(".type").value = rule.type === "text" ? "text" : "regex";
  row.querySelector(".pattern").value = rule.pattern || "";
  row.querySelector(".flags").value = rule.flags || "";
  row.querySelector(".description").value = rule.description || "";

  row.querySelector(".deleteRule").addEventListener("click", () => {
    row.remove();
  });

  rulesBody.appendChild(row);
}

function readRulesFromForm() {
  return Array.from(rulesBody.querySelectorAll("tr"))
    .map((row) => ({
      id: row.dataset.id || createRuleId(),
      enabled: row.querySelector(".enabled").checked,
      domain: row.querySelector(".domain").value.trim() || "*",
      type: row.querySelector(".type").value,
      pattern: row.querySelector(".pattern").value,
      flags: row.querySelector(".flags").value.trim(),
      description: row.querySelector(".description").value.trim()
    }))
    .filter((rule) => rule.pattern.trim());
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

function createRuleId() {
  return crypto.randomUUID?.() || `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showMessage(text) {
  message.textContent = text;

  window.setTimeout(() => {
    if (message.textContent === text) {
      message.textContent = "";
    }
  }, 2400);
}
