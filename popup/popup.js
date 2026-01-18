/* global browser, chrome */

const api = typeof browser !== "undefined" ? browser : chrome;

const STORAGE_KEY = "headerModifierState";
const DEFAULT_STATE = {
  enabled: true,
  rules: [],
  urlRegex: ""
};

const BUILD_ID = "0.1.3";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function compileRegexMaybe(pattern) {
  if (!pattern || !pattern.trim()) return { ok: true, re: null, error: "" };
  try {
    return { ok: true, re: new RegExp(pattern), error: "" };
  } catch (e) {
    return { ok: false, re: null, error: e && e.message ? String(e.message) : "Invalid regex" };
  }
}

async function loadState() {
  const stored = await api.storage.local.get(STORAGE_KEY);
  const st = stored[STORAGE_KEY] || DEFAULT_STATE;
  return {
    enabled: !!st.enabled,
    rules: Array.isArray(st.rules) ? st.rules : [],
    urlRegex: typeof st.urlRegex === "string" ? st.urlRegex : ""
  };
}

async function saveState(next) {
  await api.storage.local.set({ [STORAGE_KEY]: next });
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function updateRuleInState(ruleId, patch) {
  currentState.rules = (currentState.rules || []).map((r) => {
    if (!r || r.id !== ruleId) return r;
    return { ...r, ...patch };
  });
}

function deleteRuleFromState(ruleId) {
  currentState.rules = (currentState.rules || []).filter((r) => r && r.id !== ruleId);
}

function renderRules(state) {
  const rulesRoot = document.getElementById("rules");
  rulesRoot.textContent = "";

  if (!state.rules || state.rules.length === 0) {
    rulesRoot.appendChild(
      el("div", { class: "hint", text: "No headers yet. Click “+ Add header” to create one." })
    );
    return;
  }

  for (const rule of state.rules) {
    const enabled = el("input", { class: "checkbox", type: "checkbox" });
    enabled.checked = !!rule.enabled;
    enabled.addEventListener("change", () => {
      updateRuleInState(rule.id, { enabled: enabled.checked });
      scheduleSave();
    });

    const name = el("input", {
      class: "input",
      type: "text",
      placeholder: "Header-Name"
    });
    name.value = rule.name || "";
    name.addEventListener("input", () => {
      updateRuleInState(rule.id, { name: name.value });
      scheduleSave();
    });

    const value = el("input", {
      class: "input",
      type: "text",
      placeholder: "value"
    });
    value.value = rule.value ?? "";
    value.addEventListener("input", () => {
      // Allow empty string values (send empty header value)
      updateRuleInState(rule.id, { value: value.value });
      scheduleSave();
    });

    const del = el("button", { class: "del", title: "Delete", text: "×" });
    del.addEventListener("click", () => {
      deleteRuleFromState(rule.id);
      renderRules(currentState);
      scheduleSave();
    });

    const row = el("div", { class: "ruleRow" }, [enabled, name, value, del]);
    rulesRoot.appendChild(row);
  }
}

let currentState = { ...DEFAULT_STATE };
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveState(currentState).catch(() => {});
  }, 150);
}

function setRegexHint(text, ok) {
  const hint = document.getElementById("regexHint");
  hint.textContent = text || "";
  hint.classList.toggle("bad", !ok);
}

let uiBound = false;

function renderTopControls() {
  const globalEnabled = document.getElementById("globalEnabled");
  const urlRegex = document.getElementById("urlRegex");

  globalEnabled.checked = !!currentState.enabled;
  urlRegex.value = currentState.urlRegex || "";

  const compiled = compileRegexMaybe(urlRegex.value);
  setRegexHint(compiled.ok ? "" : `Invalid regex: ${compiled.error}`, compiled.ok);
}

function wireUIOnce() {
  if (uiBound) return;
  uiBound = true;

  const globalEnabled = document.getElementById("globalEnabled");
  const urlRegex = document.getElementById("urlRegex");
  const addRule = document.getElementById("addRule");
  const reset = document.getElementById("reset");
  const build = document.getElementById("build");

  try {
    const manifest = api.runtime && api.runtime.getManifest ? api.runtime.getManifest() : null;
    const ver = manifest && manifest.version ? manifest.version : BUILD_ID;
    if (build) build.textContent = `build v${ver}`;
  } catch (_e) {
    if (build) build.textContent = `build v${BUILD_ID}`;
  }

  globalEnabled.addEventListener("change", () => {
    currentState.enabled = globalEnabled.checked;
    scheduleSave();
  });

  urlRegex.addEventListener("input", () => {
    currentState.urlRegex = urlRegex.value;
    const c = compileRegexMaybe(urlRegex.value);
    setRegexHint(c.ok ? "" : `Invalid regex: ${c.error}`, c.ok);
    scheduleSave();
  });

  addRule.addEventListener("click", () => {
    currentState.rules = [
      ...(currentState.rules || []),
      { id: uid(), enabled: true, name: "", value: "" }
    ];
    renderRules(currentState);
    scheduleSave();
  });

  reset.addEventListener("click", async () => {
    currentState = { ...DEFAULT_STATE };
    await saveState(currentState);
    renderTopControls();
    renderRules(currentState);
  });
}

async function main() {
  currentState = await loadState();
  wireUIOnce();
  renderTopControls();
  renderRules(currentState);
}

document.addEventListener("DOMContentLoaded", () => {
  main().catch(() => {});
});

