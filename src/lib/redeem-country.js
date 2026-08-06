export const DEFAULT_REDEEM_COUNTRY = {
  iso: "IN",
  dialCode: "+91",
  // English fallback; UI should prefer nameKey via i18n.
  name: "India",
  nameKey: "redeem.countryIN",
  flag: "🇮🇳",
};

export const SUPPORTED_REDEEM_COUNTRIES = [
  DEFAULT_REDEEM_COUNTRY,
  { iso: "US", dialCode: "+1", name: "United States", nameKey: "redeem.countryUS", flag: "🇺🇸" },
  { iso: "CA", dialCode: "+1", name: "Canada", nameKey: "redeem.countryCA", flag: "🇨🇦" },
  { iso: "ID", dialCode: "+62", name: "Indonesia", nameKey: "redeem.countryID", flag: "🇮🇩" },
  { iso: "PH", dialCode: "+63", name: "Philippines", nameKey: "redeem.countryPH", flag: "🇵🇭" },
  { iso: "PK", dialCode: "+92", name: "Pakistan", nameKey: "redeem.countryPK", flag: "🇵🇰" },
  { iso: "BD", dialCode: "+880", name: "Bangladesh", nameKey: "redeem.countryBD", flag: "🇧🇩" },
  { iso: "NP", dialCode: "+977", name: "Nepal", nameKey: "redeem.countryNP", flag: "🇳🇵" },
];

const USER_SELECTION_KEY = "redeem_country_user_v1";

export function resolveRedeemCountry(iso) {
  const code = String(iso || "")
    .trim()
    .toUpperCase();
  return SUPPORTED_REDEEM_COUNTRIES.find((c) => c.iso === code) || DEFAULT_REDEEM_COUNTRY;
}

export function getSavedRedeemCountry() {
  try {
    const iso = sessionStorage.getItem(USER_SELECTION_KEY);
    if (!iso) return null;
    return findSupportedRedeemCountry(iso);
  } catch (_) {
    return null;
  }
}

/** Returns a supported country or null (does not fall back to India). */
export function findSupportedRedeemCountry(iso) {
  const code = String(iso || "")
    .trim()
    .toUpperCase();
  if (!code) return null;
  return SUPPORTED_REDEEM_COUNTRIES.find((c) => c.iso === code) || null;
}

/**
 * Explicit user-selected ISO from sessionStorage, or "" when unset/unknown.
 * Unlike getInitialRedeemCountry, never defaults to India.
 */
export function getSavedRedeemCountryIso() {
  return getSavedRedeemCountry()?.iso || "";
}

export function saveRedeemCountry(iso) {
  const country = resolveRedeemCountry(iso);
  try {
    sessionStorage.setItem(USER_SELECTION_KEY, country.iso);
  } catch (_) { }
  return country;
}

export function getInitialRedeemCountry() {
  return getSavedRedeemCountry() ?? DEFAULT_REDEEM_COUNTRY;
}

/** ISO 3166-1 alpha-2 → Tremendous currency + display symbol */
export const REDEEM_COUNTRY_CURRENCIES = {
  IN: { code: "INR", symbol: "₹" },
  US: { code: "USD", symbol: "$" },
  CA: { code: "CAD", symbol: "C$" },
  ID: { code: "IDR", symbol: "Rp" },
  PH: { code: "PHP", symbol: "₱" },
  PK: { code: "PKR", symbol: "Rs" },
  BD: { code: "BDT", symbol: "৳" },
  NP: { code: "NPR", symbol: "Rs" },
};

const GIFT_CURRENCY_CODES_BY_COUNTRY = {
  IN: ["INR", "USD"],
  US: ["USD"],
  CA: ["CAD", "USD"],
  ID: ["IDR", "USD"],
  PH: ["PHP", "USD"],
  // USD is first where the current activity catalog has no local-currency products.
  PK: ["USD", "PKR"],
  BD: ["BDT", "USD"],
  NP: ["USD", "NPR"],
};

const GIFT_CURRENCY_LABEL_KEYS = {
  INR: "redeem.currencyINR",
  IDR: "redeem.currencyIDR",
  PHP: "redeem.currencyPHP",
  PKR: "redeem.currencyPKR",
  BDT: "redeem.currencyBDT",
  NPR: "redeem.currencyNPR",
  CAD: "redeem.currencyCAD",
  USD: "redeem.currencyUSD",
};

export function getRedeemCurrencyForCountry(iso) {
  const code = String(iso || "")
    .trim()
    .toUpperCase();
  return REDEEM_COUNTRY_CURRENCIES[code] || REDEEM_COUNTRY_CURRENCIES.IN;
}

export function getGiftCurrenciesForCountry(iso) {
  const countryCode = String(iso || "").trim().toUpperCase();
  const codes = GIFT_CURRENCY_CODES_BY_COUNTRY[countryCode] || [getRedeemCurrencyForCountry(countryCode).code, "USD"];
  return [...new Set(codes)].map((code) => ({
    code,
    labelKey: GIFT_CURRENCY_LABEL_KEYS[code] || "",
    ...getCurrencyDisplayByCode(code),
  }));
}

export function getInitialGiftCurrencyForCountry(iso) {
  return getGiftCurrenciesForCountry(iso)[0] || REDEEM_COUNTRY_CURRENCIES.USD;
}

export function getCurrencyDisplayByCode(currencyCode) {
  const code = String(currencyCode || "").toUpperCase();
  const entry = Object.values(REDEEM_COUNTRY_CURRENCIES).find((item) => item.code === code);
  return entry || { code, symbol: code ? `${code} ` : "" };
}

export function formatRedeemDenomination(amount, currencyCode = "") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount ?? "");
  const { code, symbol } = getCurrencyDisplayByCode(currencyCode);
  if (code === "IDR") {
    return `${symbol}${Math.round(value).toLocaleString("en-US")}`;
  }
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${symbol}${formatted}`;
}

export function formatPhoneDisplay(phoneRaw = "") {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (!digits) return "-";

  // US and Canada share +1; display formatting only needs the common dial-code prefix.
  for (const country of SUPPORTED_REDEEM_COUNTRIES) {
    const cc = country.dialCode.replace(/\D/g, "");
    if (digits.startsWith(cc) && digits.length > cc.length) {
      return `${country.dialCode} ${digits.slice(cc.length)}`;
    }
  }

  return `+${digits}`;
}

export function __resetRedeemCountryStorageForTests() {
  try {
    sessionStorage.removeItem(USER_SELECTION_KEY);
  } catch (_) { }
}
