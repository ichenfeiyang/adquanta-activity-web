/** Lightweight cache equality checks for SWR background revalidation. */

function fingerprintChargeProduct(product) {
  return [
    product.sku_code ?? product.charges_id ?? "",
    product.product_type ?? "",
    product.display_text ?? "",
    product.validity_period ?? "",
    product.receive_value ?? product.amount ?? "",
    product.receive_currency ?? "",
    product.send_value ?? "",
    product.spend_coin ?? "",
    product.available === true ? 1 : 0,
  ].join(":");
}

export function fingerprintActivityInfo(data) {
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  const checkin = tasks.find((task) => task.type === "checkin")?.detail ?? null;
  const video = tasks.find((task) => task.type === "video")?.detail ?? null;
  return JSON.stringify({
    coin: data?.wallet_info?.coin ?? null,
    userId: data?.user_info?.user_id ?? null,
    checkin,
    video,
  });
}

function normalizeRecordsForFingerprint(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export function fingerprintChargeRecords(data) {
  return normalizeRecordsForFingerprint(data)
    .map(
      (record) =>
        `${record.business_id ?? record.distributor_ref ?? ""}:${record.status ?? record.processing_state ?? ""}:${record.amount ?? record.coin_cost ?? ""}`,
    )
    .join("|");
}

export function fingerprintCharges(data) {
  const providers = Array.isArray(data?.providers) ? data.providers : [];
  if (providers.length > 0) {
    return providers
      .map((provider) => {
        const code = String(provider.provider_code ?? provider.provider_name ?? "");
        const products = Array.isArray(provider.products) ? provider.products : [];
        const productKey = products.map(fingerprintChargeProduct).join(",");
        return `${code}[${productKey}]`;
      })
      .join("|");
  }

  const options = Array.isArray(data?.options)
    ? data.options
    : Array.isArray(data?.charge_options)
      ? data.charge_options
      : [];
  return options
    .map((option) => `${option.charges_id ?? ""}:${option.amount ?? ""}:${option.spend_coin ?? ""}`)
    .join("|");
}
