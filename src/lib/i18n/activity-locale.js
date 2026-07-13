/**
 * Locale bundles are loaded on demand so CDN only fetches the active language (+ English fallback).
 * Vite dev/build transforms JSON to JS — do not use import attributes there.
 * Node tests run the source file directly and require `type: "json"`.
 */
import { reloadActivityPage } from "../reload-activity-page.js";

function normalizeLocaleModule(module) {
  if (module && typeof module === "object" && module.default && typeof module.default === "object") {
    return module.default;
  }
  return module;
}

function loadLocaleJson(specifier, viteImport, nodeImport) {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return viteImport().then(normalizeLocaleModule);
  }
  return nodeImport().then(normalizeLocaleModule);
}

const LOCALE_LOADERS = {
  en: () =>
    loadLocaleJson(
      "en",
      () => import("../../locales/en.json"),
      () => import("../../locales/en.json", { with: { type: "json" } }),
    ),
  id: () =>
    loadLocaleJson(
      "id",
      () => import("../../locales/id.json"),
      () => import("../../locales/id.json", { with: { type: "json" } }),
    ),
  ur: () =>
    loadLocaleJson(
      "ur",
      () => import("../../locales/ur.json"),
      () => import("../../locales/ur.json", { with: { type: "json" } }),
    ),
  bn: () =>
    loadLocaleJson(
      "bn",
      () => import("../../locales/bn.json"),
      () => import("../../locales/bn.json", { with: { type: "json" } }),
    ),
  ne: () =>
    loadLocaleJson(
      "ne",
      () => import("../../locales/ne.json"),
      () => import("../../locales/ne.json", { with: { type: "json" } }),
    ),
};

const messages = {};

/** ISO 3166-1 alpha-2 region -> UI locale */
const REGION_LOCALE_MAP = {
  ID: "id",
  PK: "ur",
  BD: "bn",
  NP: "ne",
  IN: "en",
};

const LOCALE_ALIASES = {
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  id: "id",
  "id-id": "id",
  in: "id",
  "in-id": "id",
  ur: "ur",
  "ur-pk": "ur",
  bn: "bn",
  "bn-bd": "bn",
  ne: "ne",
  "ne-np": "ne",
  hi: "en",
  "hi-in": "en",
};

const HTML_LANG_MAP = {
  en: "en",
  id: "id",
  ur: "ur",
  bn: "bn",
  ne: "ne",
};

const RTL_LOCALES = new Set(["ur"]);

export const SUPPORTED_UI_LOCALES = [
  { code: "en", nativeLabel: "English", shortLabel: "EN", flag: "🇺🇸", ariaLabelKey: "common.languageEnglish" },
  { code: "id", nativeLabel: "Bahasa Indonesia", shortLabel: "ID", flag: "🇮🇩", ariaLabelKey: "common.languageIndonesian" },
  { code: "ur", nativeLabel: "اردو", shortLabel: "UR", flag: "🇵🇰", ariaLabelKey: "common.languageUrdu" },
  { code: "bn", nativeLabel: "বাংলা", shortLabel: "BN", flag: "🇧🇩", ariaLabelKey: "common.languageBengali" },
  { code: "ne", nativeLabel: "नेपाली", shortLabel: "NE", flag: "🇳🇵", ariaLabelKey: "common.languageNepali" },
];

const USER_LOCALE_KEY = "activity_ui_locale_v1";
const USER_LOCALE_MANUAL_KEY = "activity_ui_locale_manual_v1";
const SUPPORTED_LOCALE_CODES = new Set(["en", "id", "ur", "bn", "ne"]);

let currentLocale = "en";
let localeInitPromise = null;
const localeChangeListeners = new Set();

export function subscribeLocaleChange(listener) {
  localeChangeListeners.add(listener);
  return () => localeChangeListeners.delete(listener);
}

function notifyLocaleChange() {
  for (const listener of localeChangeListeners) {
    try {
      listener(currentLocale);
    } catch (_) {}
  }
}

function normalizeLocale(locale) {
  const value = String(locale || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (!value) return "en";
  if (LOCALE_ALIASES[value]) return LOCALE_ALIASES[value];
  const base = value.split("-")[0];
  if (LOCALE_ALIASES[base]) return LOCALE_ALIASES[base];
  return "en";
}

async function ensureLocaleMessages(locale) {
  const code = normalizeLocale(locale);
  if (messages[code]) return messages[code];

  const loader = LOCALE_LOADERS[code] || LOCALE_LOADERS.en;
  messages[code] = await loader();
  return messages[code];
}

function lookupMessage(dict, key) {
  const parts = String(key || "").split(".");
  let node = dict;
  for (const part of parts) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, name) => {
    const value = params[name];
    return value == null ? "" : String(value);
  });
}

function readSearchParam(...keys) {
  try {
    const qp = new URLSearchParams(window.location.search);
    for (const key of keys) {
      const value = qp.get(key);
      if (value) return value;
    }
  } catch (_) {}
  return "";
}

export function readSavedUserLocale() {
  try {
    if (localStorage.getItem(USER_LOCALE_MANUAL_KEY) !== "1") {
      return "";
    }
    const value = localStorage.getItem(USER_LOCALE_KEY);
    if (value) return normalizeLocale(value);
  } catch (_) {}
  return "";
}

export function saveUserLocale(locale) {
  const normalized = normalizeLocale(locale);
  try {
    localStorage.setItem(USER_LOCALE_KEY, normalized);
    localStorage.setItem(USER_LOCALE_MANUAL_KEY, "1");
  } catch (_) {}
  return normalized;
}

export function hasSavedUserLocale() {
  return !!readSavedUserLocale();
}

export function readRegionFromUrl() {
  return readSearchParam("region", "country", "country_code", "countryCode");
}

export function readLocaleFromUrl() {
  return readSearchParam(
    "locale",
    "lang",
    "language",
    "system_locale",
    "systemLocale",
    "device_locale",
    "deviceLocale",
  );
}

export function readRegionFromSdkSession(session) {
  const source = session || readSdkSession();
  if (!source || typeof source !== "object") return "";
  return (
    source.region ||
    source.country ||
    source.countryCode ||
    source.country_code ||
    ""
  );
}

export function readLocaleFromSdkSession(session) {
  const source = session || readSdkSession();
  if (!source || typeof source !== "object") return "";
  return (
    source.appLocale ||
    source.app_language ||
    source.appLanguage ||
    source.locale ||
    source.language ||
    source.lang ||
    ""
  );
}

/** Device / OS language from native SDK (WebView navigator is often app English). */
export function readSystemLocaleFromSdkSession(session) {
  const source = session || readSdkSession();
  if (!source || typeof source !== "object") return "";

  const directKeys = [
    "systemLocale",
    "system_language",
    "systemLanguage",
    "deviceLocale",
    "device_language",
    "deviceLanguage",
    "osLocale",
    "os_language",
    "osLanguage",
    "preferredLanguage",
    "preferred_language",
    "localeIdentifier",
    "locale_id",
  ];

  for (const key of directKeys) {
    const value = source[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }

  for (const nestKey of ["user", "userInfo", "device", "app", "client"]) {
    const nested = source[nestKey];
    if (nested && typeof nested === "object") {
      const nestedLocale = readSystemLocaleFromSdkSession(nested);
      if (nestedLocale) return nestedLocale;
    }
  }

  return "";
}

function readSystemLocaleFromNativeBridge() {
  try {
    const bridge = window.ActivityBridgeHelper;
    if (bridge && typeof bridge === "object") {
      const bridgeMethods = [
        "getSystemLocale",
        "getDeviceLocale",
        "getDeviceLanguage",
        "getOsLocale",
        "getPreferredLanguage",
      ];
      for (const name of bridgeMethods) {
        const fn = bridge[name];
        if (typeof fn !== "function") continue;
        const value = fn.call(bridge);
        if (value != null && String(value).trim()) {
          return String(value).trim();
        }
      }
    }

    const android = window.Android;
    if (android && typeof android.getSystemLanguage === "function") {
      const value = android.getSystemLanguage();
      if (value != null && String(value).trim()) {
        return String(value).trim();
      }
    }
  } catch (_) {}
  return "";
}

function pickSupportedLocale(raw) {
  if (!raw) return "";
  const normalized = normalizeLocale(raw);
  return SUPPORTED_LOCALE_CODES.has(normalized) ? normalized : "";
}

function readSdkSession() {
  try {
    return window.ActivityBridgeHelper?.getSession?.() || null;
  } catch (_) {
    return null;
  }
}

export function resolveLocaleFromRegion(region) {
  const code = String(region || "")
    .trim()
    .toUpperCase();
  return REGION_LOCALE_MAP[code] || "en";
}

function resolveLocaleFromNavigator() {
  try {
    const candidates = [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language,
    ].filter(Boolean);

    for (const raw of candidates) {
      const code = normalizeLocale(String(raw));
      if (SUPPORTED_LOCALE_CODES.has(code)) {
        return code;
      }
    }
  } catch (_) {}
  return "en";
}

export function resolveActivityLocale(options = {}) {
  if (!options.ignoreSaved) {
    const saved = readSavedUserLocale();
    if (saved) return saved;
  }

  const session = options.session ?? readSdkSession();

  const urlLocale = options.locale || readLocaleFromUrl();
  if (urlLocale) return normalizeLocale(urlLocale);

  const nativeSystemLocale = readSystemLocaleFromNativeBridge();
  const nativeLocale = pickSupportedLocale(nativeSystemLocale);
  if (nativeLocale) return nativeLocale;

  const sdkSystemLocale = readSystemLocaleFromSdkSession(session);
  const sdkSystem = pickSupportedLocale(sdkSystemLocale);
  if (sdkSystem) return sdkSystem;

  const navigatorLocale = resolveLocaleFromNavigator();
  if (navigatorLocale !== "en") {
    return navigatorLocale;
  }

  const sdkLocale = readLocaleFromSdkSession(session);
  if (sdkLocale) {
    const normalized = normalizeLocale(sdkLocale);
    if (normalized !== "en") {
      return normalized;
    }
  }

  const region = options.region || readRegionFromUrl() || readRegionFromSdkSession(session);
  if (region) return resolveLocaleFromRegion(region);

  return navigatorLocale;
}

function applyDocumentLocale(locale) {
  try {
    const code = normalizeLocale(locale);
    document.documentElement.lang = HTML_LANG_MAP[code] || "en";
    document.documentElement.dir = RTL_LOCALES.has(code) ? "rtl" : "ltr";
  } catch (_) {}
}

export function getActivityLocale() {
  return currentLocale;
}

export function isRtlActivityLocale(locale = currentLocale) {
  return RTL_LOCALES.has(normalizeLocale(locale));
}

/** Debug helper: paste output when reporting locale issues in App WebView. */
export function getActivityLocaleDiagnostics() {
  const session = readSdkSession();
  return {
    currentLocale,
    savedUserLocale: readSavedUserLocale(),
    hasManualUserLocale: hasSavedUserLocale(),
    urlLocale: readLocaleFromUrl(),
    urlRegion: readRegionFromUrl(),
    nativeSystemLocale: readSystemLocaleFromNativeBridge(),
    sdkSystemLocale: readSystemLocaleFromSdkSession(session),
    sdkAppLocale: readLocaleFromSdkSession(session),
    sdkRegion: readRegionFromSdkSession(session),
    navigatorLanguage: typeof navigator !== "undefined" ? navigator.language : "",
    navigatorLanguages:
      typeof navigator !== "undefined" && Array.isArray(navigator.languages)
        ? [...navigator.languages]
        : [],
    resolvedLocale: resolveActivityLocale({ session }),
    sdkSession: session,
  };
}

export function setActivityLocale(locale) {
  const next = normalizeLocale(locale);
  const changed = next !== currentLocale;
  currentLocale = next;
  applyDocumentLocale(currentLocale);
  if (changed) {
    notifyLocaleChange();
  }
  return currentLocale;
}

export async function initActivityLocale(options = {}) {
  if (localeInitPromise && !options.force) {
    return localeInitPromise;
  }

  localeInitPromise = (async () => {
    const session = options.session ?? readSdkSession();
    const locale = resolveActivityLocale({ ...options, session });
    await ensureLocaleMessages("en");
    if (locale !== "en") {
      await ensureLocaleMessages(locale);
    }
    setActivityLocale(locale);
    notifyLocaleChange();
    return currentLocale;
  })();

  return localeInitPromise;
}

/**
 * Re-resolve locale when Native SDK session becomes available.
 * Returns true when locale changed (caller may reload or refresh UI copy).
 */
export function ensureActivityLocaleFromSession(session) {
  if (hasSavedUserLocale()) return false;

  const next = resolveActivityLocale({ session, ignoreSaved: true });
  if (next === currentLocale) return false;
  setActivityLocale(next);
  return true;
}

/**
 * Persist a manual language choice and reload so all Vue/DOM copy refreshes.
 * Reloads via index.html on bucket/CDN so virtual routes like /activity-center do not 404.
 */
export function switchUserActivityLocale(locale) {
  const next = saveUserLocale(locale);
  if (next === currentLocale) return false;
  setActivityLocale(next);
  reloadActivityPage();
  return true;
}

export function t(key, params) {
  const primary = lookupMessage(messages[currentLocale], key);
  const fallback = lookupMessage(messages.en, key);
  const template = primary ?? fallback ?? key;
  return interpolate(template, params);
}

export function __resetUserLocaleStorageForTests() {
  localeInitPromise = null;
  for (const key of Object.keys(messages)) {
    delete messages[key];
  }
  try {
    localStorage.removeItem(USER_LOCALE_KEY);
    localStorage.removeItem(USER_LOCALE_MANUAL_KEY);
  } catch (_) {}
}

export function __resetLocaleMessagesForTests() {
  localeInitPromise = null;
  for (const key of Object.keys(messages)) {
    delete messages[key];
  }
}
