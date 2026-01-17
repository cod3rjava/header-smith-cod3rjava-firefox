/* global browser, chrome */

const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_STATE = {
  enabled: true,
  rules: [],
  urlRegex: ""
};

let state = { ...DEFAULT_STATE };
let compiledUrlRegex = null;

function compileRegexMaybe(pattern) {
  if (!pattern || !pattern.trim()) return null;
  try {
    return new RegExp(pattern);
  } catch (_e) {
    return null;
  }
}

function normalizeName(name) {
  return (name || "").trim();
}

function refreshCompiled() {
  compiledUrlRegex = compileRegexMaybe(state.urlRegex);
}

async function loadState() {
  const stored = await api.storage.local.get("headerModifierState");
  const next = stored.headerModifierState || DEFAULT_STATE;

  state = {
    enabled: !!next.enabled,
    rules: Array.isArray(next.rules) ? next.rules : [],
    urlRegex: typeof next.urlRegex === "string" ? next.urlRegex : ""
  };
  refreshCompiled();
}

function urlMatches(url) {
  if (!compiledUrlRegex) return true; // no filter -> apply to all
  try {
    return compiledUrlRegex.test(url);
  } catch (_e) {
    return true;
  }
}

function applyRules(requestHeaders) {
  const headers = Array.isArray(requestHeaders) ? [...requestHeaders] : [];

  // Some headers are controlled by the browser/caching layer and may not accept being set
  // to an empty value. For those, we treat empty as "remove" to achieve the practical effect.
  const REMOVE_WHEN_EMPTY = new Set([
    "if-none-match",
    "if-modified-since",
    "if-match",
    "if-unmodified-since",
    "if-range"
  ]);

  const enabledRules = (state.rules || [])
    .filter((r) => r && r.enabled)
    .map((r) => ({
      name: normalizeName(r.name),
      value: r.value ?? ""
    }))
    .filter((r) => r.name.length > 0);

  if (enabledRules.length === 0) return headers;

  for (const rule of enabledRules) {
    const targetLower = rule.name.toLowerCase();
    const idx = headers.findIndex((h) => (h.name || "").toLowerCase() === targetLower);

    const valueStr = String(rule.value);
    const isEmpty = valueStr.length === 0;

    if (isEmpty && REMOVE_WHEN_EMPTY.has(targetLower)) {
      // Remove header completely
      if (idx >= 0) headers.splice(idx, 1);
      continue;
    }

    // Firefox may omit headers with truly empty values; use a single space to force emission.
    const valueToSend = isEmpty ? " " : valueStr;

    if (idx >= 0) {
      headers[idx].value = valueToSend;
    } else {
      headers.push({ name: rule.name, value: valueToSend });
    }
  }

  return headers;
}

function onBeforeSendHeaders(details) {
  try {
    if (!state.enabled) return {};
    if (!urlMatches(details.url)) return {};
    const nextHeaders = applyRules(details.requestHeaders);
    return { requestHeaders: nextHeaders };
  } catch (_e) {
    return {};
  }
}

api.webRequest.onBeforeSendHeaders.addListener(
  onBeforeSendHeaders,
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);

api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!changes.headerModifierState) return;

  const next = changes.headerModifierState.newValue || DEFAULT_STATE;
  state = {
    enabled: !!next.enabled,
    rules: Array.isArray(next.rules) ? next.rules : [],
    urlRegex: typeof next.urlRegex === "string" ? next.urlRegex : ""
  };
  refreshCompiled();
});

// Initialize
loadState().catch(() => {
  state = { ...DEFAULT_STATE };
  refreshCompiled();
});

