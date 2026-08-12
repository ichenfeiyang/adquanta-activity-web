export const ACTIVITY_LOG_REDACTED = "[REDACTED]";

function normalizedKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key) {
  const normalized = normalizedKey(key);
  if (!normalized) return false;
  return (
    normalized === "authorization" ||
    normalized === "xgaclientid" ||
    normalized.includes("bearer") ||
    normalized.endsWith("token") ||
    normalized.endsWith("appkey") ||
    normalized.endsWith("apikey") ||
    normalized.includes("phone") ||
    normalized.includes("email") ||
    normalized.includes("accountnumber") ||
    normalized.startsWith("recipient") ||
    normalized.includes("address") ||
    normalized === "content" ||
    normalized === "feedback" ||
    normalized === "feedbackcontent"
  );
}

export function redactActivityLogValue(value, seen = new WeakSet()) {
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    const result = value.map((item) => redactActivityLogValue(item, seen));
    seen.delete(value);
    return result;
  }
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? ACTIVITY_LOG_REDACTED : redactActivityLogValue(child, seen);
  }
  seen.delete(value);
  return result;
}

export function redactActivityLogBody(body, { redactPlainText = true } = {}) {
  if (body == null) return null;
  if (typeof body !== "string") return redactActivityLogValue(body);
  try {
    return redactActivityLogValue(JSON.parse(body));
  } catch (_) {
    // Request bodies are opaque and potentially user-authored; response text
    // such as a generic gateway message may be retained by opting out.
    return redactPlainText ? ACTIVITY_LOG_REDACTED : body;
  }
}
