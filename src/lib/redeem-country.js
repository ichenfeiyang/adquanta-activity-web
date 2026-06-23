export const DEFAULT_REDEEM_COUNTRY = {
  iso: "IN",
  dialCode: "+91",
  name: "India",
  flag: "🇮🇳",
};

export const SUPPORTED_REDEEM_COUNTRIES = [
  DEFAULT_REDEEM_COUNTRY,
  { iso: "ID", dialCode: "+62", name: "Indonesia", flag: "🇮🇩" },
  { iso: "PH", dialCode: "+63", name: "Philippines", flag: "🇵🇭" },
  { iso: "PK", dialCode: "+92", name: "Pakistan", flag: "🇵🇰" },
  { iso: "BD", dialCode: "+880", name: "Bangladesh", flag: "🇧🇩" },
  { iso: "NP", dialCode: "+977", name: "Nepal", flag: "🇳🇵" },
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
    return resolveRedeemCountry(iso);
  } catch (_) {
    return null;
  }
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

export function formatPhoneDisplay(phoneRaw = "") {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (!digits) return "-";

  // Current countries have no nested dial-code prefixes; if that changes, match longest prefix first.
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
