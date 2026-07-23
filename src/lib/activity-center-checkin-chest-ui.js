export const checkinChestUiMixin = {
  isCheckinChestVisible() {
    return this.elements.checkinChestModal?.style.display === "flex";
  },

  isCheckinChestRewardVisible() {
    return this.elements.checkinChestRewardModal?.style.display === "flex";
  },

  showCheckinChestDialog(chest) {
    this._checkinChest = chest || null;
    if (!chest || !this.elements.checkinChestModal) return;
    this.elements.checkinChestModal.style.display = "flex";
    this.syncBodyScrollLock?.();
  },

  hideCheckinChestDialog() {
    if (this.elements.checkinChestModal) this.elements.checkinChestModal.style.display = "none";
    this.setCheckinChestLoading(false);
    this.syncBodyScrollLock?.();
  },

  showCheckinChestRewardDialog(coin) {
    if (this.elements.checkinChestRewardCoins) {
      this.elements.checkinChestRewardCoins.textContent = `+${Math.max(0, Number(coin) || 0)}`;
    }
    if (this.elements.checkinChestRewardModal) this.elements.checkinChestRewardModal.style.display = "flex";
    this.syncBodyScrollLock?.();
  },

  hideCheckinChestRewardDialog() {
    if (this.elements.checkinChestRewardModal) this.elements.checkinChestRewardModal.style.display = "none";
    this.syncBodyScrollLock?.();
  },

  setCheckinChestLoading(loading) {
    for (const element of [this.elements.checkinChestWatchBtn, this.elements.checkinChestDismissBtn]) {
      if (element) element.setAttribute("aria-busy", String(!!loading));
    }
  },
};
