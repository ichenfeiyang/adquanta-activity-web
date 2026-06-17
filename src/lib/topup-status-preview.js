const STORAGE_KEY = "topup_status_preview_v1";
const TTL_MS = 30 * 60_000;

function readStore() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function pruneStore(store) {
  const now = Date.now();
  for (const key of Object.keys(store)) {
    const entry = store[key];
    if (!entry?.storedAt || now - Number(entry.storedAt) > TTL_MS) {
      delete store[key];
    }
  }
  return store;
}

function normalizeDistributorRef(distributorRef) {
  return String(distributorRef || "").trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value);
    if (text !== "") return text;
  }
  return "";
}

function pickField(source, ...keys) {
  if (!source) return "";
  return firstNonEmpty(...keys.map((key) => source[key]));
}

export function getRecordBusinessId(record) {
  return pickField(record, "business_id", "businessId", "distributor_ref", "distributorRef");
}

export function getRecordOperator(record) {
  return pickField(
    record,
    "provider_name",
    "providerName",
    "operator_name",
    "operatorName",
    "operator",
    "carrier_name",
    "carrierName",
  );
}

export function getRecordPhone(record) {
  return pickField(record, "phone_number", "phone");
}

export function buildAmountLabel(record) {
  const amountText = pickField(
    record,
    "amount_text",
    "amountText",
    "amount_label",
    "amountLabel",
    "send_value_text",
    "sendValueText",
  );
  if (amountText) return amountText;

  const sendValue = pickField(record, "send_value", "sendValue", "receive_value", "receiveValue");
  const currency = pickField(
    record,
    "receive_currency",
    "receiveCurrency",
    "currency",
    "amount_currency",
    "amountCurrency",
  );
  if (sendValue && currency) return `${sendValue} ${currency}`.trim();
  return sendValue;
}

export function saveTopupStatusPreview(distributorRef, preview = {}) {
  const ref = normalizeDistributorRef(distributorRef);
  if (!ref) return;

  try {
    const store = pruneStore(readStore());
    store[ref] = {
      phone_number: String(preview.phone_number || ""),
      operator: String(preview.operator || ""),
      amount_label: String(preview.amount_label || ""),
      send_value: String(preview.send_value || ""),
      storedAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (_) {}
}

export function getTopupStatusPreview(distributorRef) {
  const ref = normalizeDistributorRef(distributorRef);
  if (!ref) return null;

  const entry = readStore()[ref];
  if (!entry) return null;
  if (Date.now() - Number(entry.storedAt || 0) > TTL_MS) return null;
  return entry;
}

function pickPreviewOrQuery(preview, readQueryValue, key, fallback = "") {
  return firstNonEmpty(preview?.[key], readQueryValue(key)) || fallback;
}

function getTopupStatusPreviewWithFallback(primaryRef, alternateRef = "") {
  const preview = getTopupStatusPreview(primaryRef);
  if (preview) return preview;

  const alternate = normalizeDistributorRef(alternateRef);
  const primary = normalizeDistributorRef(primaryRef);
  if (!alternate || alternate === primary) return null;
  return getTopupStatusPreview(alternate);
}

export function resolveTopupStatusDetails(distributorRef, readQueryValue, alternateLookupRef = "") {
  const preview = getTopupStatusPreviewWithFallback(distributorRef, alternateLookupRef);

  return {
    amountLabel:
      pickPreviewOrQuery(preview, readQueryValue, "amount_label") ||
      pickPreviewOrQuery(preview, readQueryValue, "send_value") ||
      "-",
    phoneNumber: pickPreviewOrQuery(preview, readQueryValue, "phone_number"),
    operator: pickPreviewOrQuery(preview, readQueryValue, "operator") || "-",
  };
}

export function extractTopupStatusFromApi(data) {
  if (!data) return null;

  return {
    phone_number: getRecordPhone(data),
    operator: getRecordOperator(data),
    amount_label: buildAmountLabel(data),
    send_value: pickField(data, "send_value", "sendValue", "receive_value", "receiveValue"),
    status: pickField(data, "status", "processing_state"),
  };
}

export function mergeTopupStatusDetails(local, api) {
  if (!api) return local;

  return {
    amountLabel: firstNonEmpty(api.amount_label, api.send_value, local.amountLabel) || local.amountLabel || "-",
    phoneNumber: firstNonEmpty(api.phone_number, local.phoneNumber),
    operator: firstNonEmpty(api.operator, local.operator) || local.operator || "-",
  };
}

export function __resetTopupStatusPreviewForTests() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}
