import { t, getActivityLocale } from "../lib/i18n/activity-locale.js";

export function useI18n() {
  return {
    t,
    locale: getActivityLocale(),
  };
}
