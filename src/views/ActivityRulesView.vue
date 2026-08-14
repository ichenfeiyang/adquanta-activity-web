<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ActivityRulesModal from "../components/ActivityRulesModal.vue";
import RewardsCenterHideDialog from "../components/RewardsCenterHideDialog.vue";
import { useI18n } from "../composables/useI18n.js";
import { getActivityInfo, postHideRewardsCenter } from "../lib/activity-api.js";
import { showToast } from "../lib/activity-alert-ui.js";
import {
  getActivityInfoCache,
  invalidateActivityInfoCache,
  loadActivityInfoWithSWR,
} from "../lib/activity-page-cache.js";
import { goToActivityCenter } from "../lib/activity-navigation.js";
import { requireActivitySession } from "../lib/activity-session.js";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = requireActivitySession(route, { router });
const hideAvailable = ref(false);
const hideDialogOpen = ref(false);
const hiding = ref(false);
const hideError = ref("");

function backToActivityCenter() {
  void goToActivityCenter(router, String(route.query.activity_id || ""));
}

function applyRewardsCenterHideInfo(data) {
  hideAvailable.value = data?.rewards_center_hide?.show === true;
}

async function loadRewardsCenterHideInfo() {
  if (!session) return;
  applyRewardsCenterHideInfo(getActivityInfoCache(session.token));
  await loadActivityInfoWithSWR(session.token, {
    fetcher: () => getActivityInfo(session.apiOptions),
    onData: applyRewardsCenterHideInfo,
  });
}

function openHideDialog() {
  hideError.value = "";
  hideDialogOpen.value = true;
}

function keepRewardsCenter() {
  if (hiding.value) return;
  hideDialogOpen.value = false;
  hideError.value = "";
}

async function removeRewardsCenter() {
  if (!session || hiding.value) return;
  hiding.value = true;
  hideError.value = "";
  try {
    const result = await postHideRewardsCenter(session.apiOptions);
    if (result?.code !== 200 || result?.data?.success !== true) {
      throw new Error(result?.message || t("feedback.hideRemoveFailed"));
    }
    hideAvailable.value = false;
    hideDialogOpen.value = false;
    invalidateActivityInfoCache(session.token);
    showToast(t("feedback.hideRemoveSuccess"), "success");
  } catch (error) {
    hideError.value = error?.message || t("feedback.hideRemoveFailed");
  } finally {
    hiding.value = false;
  }
}

onMounted(() => {
  void loadRewardsCenterHideInfo();
});
</script>

<template>
  <div class="activity-rules-page">
    <ActivityRulesModal
      visible
      standalone
      :hide-available="hideAvailable"
      @close="backToActivityCenter"
      @hide="openHideDialog"
    />
    <RewardsCenterHideDialog
      :visible="hideDialogOpen"
      :busy="hiding"
      :error="hideError"
      @cancel="keepRewardsCenter"
      @confirm="removeRewardsCenter"
    />
  </div>
</template>

<style scoped>
.activity-rules-page {
  min-height: 100dvh;
  background: #fffaf6;
}
</style>
