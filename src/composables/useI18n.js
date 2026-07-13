import { computed, ref } from "vue";
import {
  t as translate,
  getActivityLocale,
  subscribeLocaleChange,
} from "../lib/i18n/activity-locale.js";

const localeVersion = ref(0);

subscribeLocaleChange(() => {
  localeVersion.value += 1;
});

export function useI18n() {
  const locale = computed(() => {
    localeVersion.value;
    return getActivityLocale();
  });

  function t(key, params) {
    localeVersion.value;
    return translate(key, params);
  }

  return { t, locale };
}
