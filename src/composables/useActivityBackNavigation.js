import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { goToActivityCenter, goToGoldCoinsExchange } from "../lib/activity-navigation.js";

export function useActivityBackNavigation() {
  const router = useRouter();
  const route = useRoute();
  const activityId = computed(() => String(route.query.activity_id || ""));

  function returnToActivityCenter() {
    goToActivityCenter(router, activityId.value);
  }

  function navigateBackOrActivityCenter() {
    try {
      if (window.history?.length > 1) {
        router.back();
        return;
      }
    } catch (_) {}
    returnToActivityCenter();
  }

  function returnToMobileTopup() {
    return goToGoldCoinsExchange(router, activityId.value, { tab: "topup" });
  }

  return {
    returnToActivityCenter,
    returnToMobileTopup,
    navigateBackOrActivityCenter,
  };
}
