const DISMISSED_DATE_KEY = "activity_checkin_prompt_dismissed_date_v1";

export function normalizeCheckinPrompt(prompt) {
  const serverDate = String(prompt?.server_date || "").trim();
  return {
    show: prompt?.show === true,
    serverDate: /^\d{4}-\d{2}-\d{2}$/.test(serverDate) ? serverDate : "",
  };
}

export function isCheckinPromptDismissed(serverDate) {
  if (!serverDate) return false;
  try {
    return localStorage.getItem(DISMISSED_DATE_KEY) === serverDate;
  } catch (_) {
    return false;
  }
}

export function dismissCheckinPrompt(serverDate) {
  if (!serverDate) return;
  try {
    localStorage.setItem(DISMISSED_DATE_KEY, serverDate);
  } catch (_) {}
}

export function shouldShowCheckinPrompt(prompt) {
  const normalized = normalizeCheckinPrompt(prompt);
  return normalized.show && !!normalized.serverDate && !isCheckinPromptDismissed(normalized.serverDate);
}
