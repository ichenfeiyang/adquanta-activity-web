import { t } from "./i18n/activity-locale.js";

export function normalizeProductType(productType) {
  const type = String(productType || "")
    .trim()
    .toLowerCase();
  if (type === "data") return "data";
  return "topup";
}

export function isDataProduct(productType) {
  return normalizeProductType(productType) === "data";
}

function formatDurationUnit(count, singular, plural) {
  if (!Number.isFinite(count) || count <= 0) return "";
  return count === 1 ? t("product.dayValid") : t("product.daysValid", { count });
}

export function formatValidityPeriod(periodRaw = "") {
  const period = String(periodRaw || "").trim().toUpperCase();
  if (!period) return "";

  const dayMatch = period.match(/^P(\d+)D$/);
  if (dayMatch) return formatDurationUnit(Number(dayMatch[1]), "day", "days");

  const weekMatch = period.match(/^P(\d+)W$/);
  if (weekMatch) {
    const count = Number(weekMatch[1]);
    return count === 1 ? t("product.weekValid") : t("product.weeksValid", { count });
  }

  return "";
}

function parseReceiveValue(prod) {
  const raw = prod?.receive_value ?? prod?.amount;
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function isValidMappedChargeProduct(item) {
  if (!item?.charges_id) return false;

  const spendCoin = Number(item.spend_coin);
  if (!Number.isFinite(spendCoin) || spendCoin <= 0) return false;

  const sendValue = item.send_value;
  if (sendValue === "" || sendValue == null) return false;

  if (isDataProduct(item.product_type)) {
    return Boolean(String(item.display_text || item.amount_text || "").trim()) || item.amount > 0;
  }

  const amount = parseReceiveValue(item);
  return amount != null && amount > 0;
}

export function mapChargeProduct(prod, providerContext = {}) {
  const productType = normalizeProductType(prod?.product_type);
  const isData = productType === "data";
  const providerName = String(providerContext.provider_name ?? prod?.provider_name ?? "").trim();
  const providerCode = String(
    providerContext.provider_code ?? prod?.provider_code ?? providerName ?? "",
  ).trim();
  const amount = parseReceiveValue(prod);
  const receiveCurrency = String(prod?.receive_currency ?? "").trim();
  const displayText = String(prod?.display_text ?? "").trim();
  const validityLabel = formatValidityPeriod(prod?.validity_period);
  const topupAmountText = amount != null ? `${amount} ${receiveCurrency}`.trim() : "";

  return {
    charges_id: String(prod?.sku_code ?? prod?.charges_id ?? "").trim(),
    prize_id: String(prod?.prize_id ?? prod?.sku_code ?? prod?.charges_id ?? "").trim(),
    amount: amount ?? 0,
    amount_text: isData ? displayText || topupAmountText : topupAmountText,
    amount_subtitle: isData ? validityLabel : "",
    product_type: productType,
    display_text: displayText,
    validity_period: String(prod?.validity_period ?? "").trim(),
    validity_label: validityLabel,
    spend_coin: Number(prod.spend_coin ?? 0),
    provider_name: providerName,
    provider_code: providerCode || providerName,
    receive_currency: receiveCurrency,
    send_value: prod?.send_value ?? "",
  };
}

export function hasMixedProductTypes(products = []) {
  const list = Array.isArray(products) ? products : [];
  const types = new Set(list.map((product) => normalizeProductType(product?.product_type)));
  return types.has("topup") && types.has("data");
}

export function sortChargeProducts(products = []) {
  const list = Array.isArray(products) ? products.slice() : [];
  return list.sort((a, b) => {
    const typeA = normalizeProductType(a?.product_type) === "data" ? 1 : 0;
    const typeB = normalizeProductType(b?.product_type) === "data" ? 1 : 0;
    if (typeA !== typeB) return typeA - typeB;
    return (a.amount - b.amount) || (Number(a.spend_coin) - Number(b.spend_coin));
  });
}

export function getProductTypeLabel(productType) {
  return isDataProduct(productType) ? t("product.data") : t("product.topup");
}

export function getRedeemSummaryLabel(product = {}) {
  if (!product) return "";
  if (isDataProduct(product.product_type)) {
    return String(product.display_text || product.amount_text || "").trim();
  }
  return String(product.amount_text || product.amount || "").trim();
}

export function getRedeemActionVerb(productType) {
  return isDataProduct(productType) ? t("product.redeemData") : t("product.topUpVerb");
}

export function buildSelectedRedeemSummary({ coins, product = {}, operator, countryCode, mobile }) {
  const label = getRedeemSummaryLabel(product);
  const action = getRedeemActionVerb(product.product_type);
  return t("redeem.summarySelected", {
    coins,
    action,
    label,
    operator,
    countryCode,
    mobile,
  });
}

export function formatRedeemProductName(product = {}) {
  const label = getRedeemSummaryLabel(product);
  const prefix = getProductTypeLabel(product.product_type);
  if (!label) return prefix;
  return `${prefix} ${label}`;
}

export function getHistoryRecordTitle(record = {}) {
  const displayText = String(record?.display_text ?? "").trim();
  if (displayText) return displayText;

  const skuCode = String(record?.sku_code ?? "").trim();
  const prefix = getProductTypeLabel(record?.product_type);
  if (skuCode) return isDataProduct(record?.product_type) ? t("product.historyData", { sku: skuCode }) : t("product.historyTopup", { sku: skuCode });
  return prefix;
}

function pickRecordField(record, ...keys) {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text !== "") return text;
  }
  return "";
}

function hasMappedChargeAmount(record = {}) {
  const receiveValue = record.receive_value ?? record.receiveValue;
  if (receiveValue == null || receiveValue === "") return false;
  return Number.isFinite(Number(receiveValue));
}

function isPlaceholderAmountLabel(label) {
  const text = String(label || "").trim();
  return text === "0" || /^0(\s|$)/.test(text);
}

export function getRecordAmountLabel(record = {}) {
  const historyLabel = pickRecordField(
    record,
    "display_text",
    "amount_text",
    "amountText",
    "amount_label",
    "amountLabel",
  );
  if (historyLabel) return historyLabel;

  if (!hasMappedChargeAmount(record)) return "";

  const mappedLabel = getRedeemSummaryLabel(mapChargeProduct(record));
  if (isPlaceholderAmountLabel(mappedLabel)) return "";
  return mappedLabel;
}
