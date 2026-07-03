import { t } from "./i18n/activity-locale.js";

export function authFailedTitle() {
  return t("auth.failedTitle");
}

export function authFailedMessage() {
  return t("auth.failedMessage");
}

export function alreadyCheckedInTitle() {
  return t("center.alreadyCheckedInTitle");
}

export function alreadyCheckedInMessage() {
  return t("messages.alreadyCheckedIn");
}

export function videoCheckinAlreadyMessage() {
  return t("messages.videoCheckinAlready");
}

export function initializationFailedTitle() {
  return t("messages.initFailedTitle");
}

export function initializationFailedMessage() {
  return t("messages.initFailed");
}

export function pageLoadFailedTitle() {
  return t("messages.pageLoadFailedTitle");
}

export function pageLoadFailedMessage(pageLabel) {
  return t("messages.pageLoadFailed", { page: pageLabel });
}

export function redeemSummaryDefault() {
  return t("redeem.summaryDefault");
}

export function activityLoadFailedMessage() {
  return t("messages.activityLoadFailed");
}

export function checkinFailedMessage() {
  return t("messages.checkinFailed");
}

export function checkinFailedRetryMessage() {
  return t("messages.checkinFailedRetry");
}

export function videoCheckinSuccessMessage() {
  return t("messages.videoCheckinSuccess");
}

export function claimFailedMessage() {
  return t("messages.claimFailed");
}

export function claimFailedRetryMessage() {
  return t("messages.claimFailedRetry");
}

export function noCoinsReceivedMessage() {
  return t("messages.noCoinsReceived");
}

export function dailyAdLimitMessage() {
  return t("messages.dailyAdLimit");
}

export function adFailedMessage() {
  return t("messages.adFailed");
}

export function adNotCompletedMessage() {
  return t("messages.adNotCompleted");
}

export function adNotAvailableMessage() {
  return t("messages.adNotAvailable");
}

export function videoCompletedRewardMessage() {
  return t("messages.videoCompletedReward");
}

export function resolveAlertTitleByMessage(message, type = "error") {
  const pairs = [
    [authFailedMessage(), authFailedTitle()],
    [alreadyCheckedInMessage(), alreadyCheckedInTitle()],
    [initializationFailedMessage(), initializationFailedTitle()],
  ];
  for (const [msg, title] of pairs) {
    if (message === msg) return title;
  }
  return null;
}
