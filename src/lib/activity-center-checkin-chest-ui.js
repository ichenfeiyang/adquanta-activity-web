export const checkinChestUiMixin = {
  showCheckinChestDialog(chest) {
    this._checkinChest = chest || null;
    if (!chest || !this.elements.checkinChestModal) return;
    this.elements.checkinChestModal.style.display = "flex";
  },

  hideCheckinChestDialog() {
    if (this.elements.checkinChestModal) this.elements.checkinChestModal.style.display = "none";
    this.setCheckinChestLoading(false);
  },

  setCheckinChestLoading(loading) {
    for (const element of [this.elements.checkinChestWatchBtn, this.elements.checkinChestDismissBtn]) {
      if (element) element.disabled = !!loading;
    }
  },
};
