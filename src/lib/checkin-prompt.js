const DISMISSED_DATE_KEY = "activity_checkin_prompt_dismissed_date_v2";

function dismissedDateKey(scope = "") {
  const normalized = String(scope || "").trim();
  return normalized ? `${DISMISSED_DATE_KEY}:${encodeURIComponent(normalized)}` : DISMISSED_DATE_KEY;
}

export function normalizeCheckinPrompt(prompt) {
  const serverDate = String(prompt?.server_date || "").trim();
  return {
    show: prompt?.show === true,
    serverDate: /^\d{4}-\d{2}-\d{2}$/.test(serverDate) ? serverDate : "",
  };
}

export function isCheckinPromptDismissed(serverDate, scope = "") {
  if (!serverDate) return false;
  try {
    return localStorage.getItem(dismissedDateKey(scope)) === serverDate;
  } catch (_) {
    return false;
  }
}

export function dismissCheckinPrompt(serverDate, scope = "") {
  if (!serverDate) return;
  try {
    localStorage.setItem(dismissedDateKey(scope), serverDate);
  } catch (_) {}
}

export function shouldShowCheckinPrompt(prompt, scope = "") {
  const normalized = normalizeCheckinPrompt(prompt);
  return normalized.show && !!normalized.serverDate && !isCheckinPromptDismissed(normalized.serverDate, scope);
}
