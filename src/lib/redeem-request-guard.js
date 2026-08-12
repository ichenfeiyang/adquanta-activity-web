/**
 * Shared stale-response guards and form helpers for redeem async flows.
 */

export function shouldApplyLookupResult({ requestKey, desiredKey, currentKey }) {
  return Boolean(requestKey) && requestKey === desiredKey && requestKey === currentKey;
}

export function findCurrentDenomination(denominations, selectedDenomination) {
  const selectedValue = Number(selectedDenomination?.denomination);
  if (!Number.isFinite(selectedValue) || selectedValue <= 0) return null;
  const list = Array.isArray(denominations) ? denominations : [];
  const selectedPrizeId = String(selectedDenomination?.prize_id || "").trim();
  if (selectedPrizeId) {
    return list.find((item) => String(item?.prize_id || "").trim() === selectedPrizeId) || null;
  }
  return list.find((item) => Number(item?.denomination) === selectedValue) || null;
}

export function isInsufficientCoinMessage(message) {
  const normalized = String(message || "").trim().toLowerCase();
  return normalized.includes("余额不足") || normalized.includes("insufficient coin");
}

/** @returns {boolean} true when the value was truncated */
export function trimInputToMax(input, maxLength) {
  if (!input) return false;
  const value = String(input.value || "");
  if (value.length > maxLength) {
    input.value = value.slice(0, maxLength);
    return true;
  }
  return false;
}

export function willInputExceedLimit(input, event, maxLength) {
  if (!input || !event || typeof event.data !== "string" || !event.data) return false;
  const value = String(input.value || "");
  const start = Number.isFinite(input.selectionStart) ? input.selectionStart : value.length;
  const end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : start;
  const nextLength = value.length - Math.max(0, end - start) + event.data.length;
  return nextLength > maxLength;
}

export function setFieldErrorVisible(input, errorEl, describedById, visible) {
  if (!errorEl) return;
  errorEl.hidden = !visible;
  if (!input) return;
  input.setAttribute("aria-invalid", visible ? "true" : "false");
  if (visible) {
    input.setAttribute("aria-describedby", describedById);
  } else {
    input.removeAttribute("aria-describedby");
  }
}
