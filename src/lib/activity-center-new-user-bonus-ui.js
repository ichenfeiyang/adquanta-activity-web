import { assetUrl } from "./asset-url.js";
import { loadDeferredImage } from "./activity-center-ui-helpers.js";
import { t } from "./i18n/activity-locale.js";

function setText(el, value) {
  if (el) el.textContent = value;
}

export const newUserBonusUiMixin = {
  updateNewUserBonusDialog(bonus) {
    this._newUserBonus = bonus || null;
    const baseCoin = Number(bonus?.base_coin ?? 50) || 50;
    const videoCoin = Number(bonus?.video_coin ?? 100) || 100;

    setText(this.elements.newUserBonusAmount, String(baseCoin));
    setText(this.elements.newUserBonusHeadlineCoin, String(baseCoin));
    setText(this.elements.newUserBonusVideoCoin, String(videoCoin));
    setText(this.elements.newUserBonusDoubleBtnLabel, t("center.newUserBonusDouble"));
    setText(this.elements.newUserBonusMaybeLater, t("center.newUserBonusMaybeLater"));

    if (this.elements.newUserBonusTitle) {
      this.elements.newUserBonusTitle.textContent = t("center.newUserBonusTitle");
    }
    if (this.elements.newUserBonusHeadline) {
      this.elements.newUserBonusHeadline.innerHTML = t("center.newUserBonusHeadlineHtml", { baseCoin });
    }
    if (this.elements.newUserBonusDesc) {
      this.elements.newUserBonusDesc.innerHTML = t("center.newUserBonusDescHtml", { videoCoin });
    }
    setText(this.elements.newUserBonusFoot, t("center.newUserBonusFoot"));
  },

  showNewUserBonusDialog(bonus) {
    this.updateNewUserBonusDialog(bonus);
    if (!this.elements.newUserBonusModal) return;
    loadDeferredImage(this.elements.newUserBonusHero);
    this.elements.newUserBonusModal.style.display = "flex";
    this.syncBodyScrollLock();
  },

  hideNewUserBonusDialog() {
    if (!this.elements.newUserBonusModal) return;
    this.elements.newUserBonusModal.style.display = "none";
    this.setNewUserBonusLoading(false);
    this.syncBodyScrollLock();
  },

  isNewUserBonusVisible() {
    return this.elements.newUserBonusModal?.style.display === "flex";
  },

  setNewUserBonusLoading(loading, action = "") {
    const disabled = !!loading;
    if (this.elements.newUserBonusDoubleBtn) {
      this.elements.newUserBonusDoubleBtn.disabled = disabled;
      this.elements.newUserBonusDoubleBtn.classList.toggle("is-loading", disabled && action === "video");
    }
    if (this.elements.newUserBonusMaybeLater) {
      this.elements.newUserBonusMaybeLater.disabled = disabled;
      this.elements.newUserBonusMaybeLater.classList.toggle("is-loading", disabled && action === "dismiss");
    }
  },

  restoreNewUserBonusVideoButton() {
    const btn = this.elements.newUserBonusDoubleBtn;
    if (!btn) return;
    btn.classList.remove("is-loading");
    btn.disabled = false;
    btn.innerHTML = `
      <img src="${assetUrl("icons/video_outline.svg")}" alt="" class="new-user-bonus-btn-icon" width="28" height="28">
      <span id="newUserBonusDoubleBtnLabel">${t("center.newUserBonusDouble")}</span>
    `;
    this.elements.newUserBonusDoubleBtnLabel = document.getElementById("newUserBonusDoubleBtnLabel");
  },
};
