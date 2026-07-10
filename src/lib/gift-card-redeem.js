import {
  getTremendousProducts,
  getTremendousRecords,
  postTremendousRedeem,
} from "./activity-api.js";
import {
  loadTremendousCatalogWithSWR,
  patchActivityInfoWalletCoin,
} from "./activity-page-cache.js";
import { escapeHtml } from "./escape-html.js";
import { assetUrl } from "./asset-url.js";
import { formatActivityRecordDate } from "./activity-date-format.js";
import * as logger from "./activity-logger.js";
import { t } from "./i18n/activity-locale.js";
import { showToast } from "./activity-alert-ui.js";
import {
  formatRedeemDenomination,
  getRedeemCurrencyForCountry,
  resolveRedeemCountry,
} from "./redeem-country.js";

const GIFT_TAB = "gift";
const TOPUP_TAB = "topup";
const GIFT_DELIVERY_EMAIL = "EMAIL";
const GIFT_RECIPIENT_NAME_MAX_LENGTH = 80;
const GIFT_RECIPIENT_EMAIL_MAX_LENGTH = 50;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isApiEnvelopeOk(res) {
  return res?.code === 200 || res?.code === 0;
}

function normalizeTremendousRecords(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.records)) return data.records;
  return [];
}

function formatGiftHistoryDate(value) {
  return formatActivityRecordDate(value, "—");
}

function buildBrandIconHtml(product) {
  if (product.logo_url) {
    return `<img src="${escapeHtml(product.logo_url)}" alt="" class="redeem-brand-logo">`;
  }
  return `<span class="redeem-brand-icon redeem-brand-icon--default" aria-hidden="true">🎁</span>`;
}

function buildGiftAmountButtonHtml(item, currencyCode) {
  const label = formatRedeemDenomination(item.denomination, currencyCode);
  return `<button type="button" class="redeem-gift-amount-btn" data-denomination="${Number(item.denomination)}" data-spend-coin="${Number(item.spend_coin ?? 0)}">
      <span class="redeem-gift-amount-main">${escapeHtml(label)}</span>
      <span class="redeem-gift-amount-cost">
        <img src="${assetUrl("icons/gold_coin.svg")}" alt="" class="redeem-amount-coin-icon" />
        <span>${Number(item.spend_coin ?? 0)}</span>
      </span>
    </button>`;
}

const GIFT_BRAND_SKELETON_COUNT = 5;
const GIFT_AMOUNT_SKELETON_COUNT = 6;

function buildBrandSkeletonCardHtml() {
  return `<div class="redeem-brand-btn redeem-skeleton-card" aria-hidden="true">
    <div class="redeem-skeleton-block redeem-skeleton-brand-logo"></div>
    <div class="redeem-skeleton-block redeem-skeleton-brand-name"></div>
  </div>`;
}

function buildGiftAmountSkeletonCardHtml() {
  return `<div class="redeem-gift-amount-btn redeem-skeleton-card" aria-hidden="true">
    <div class="redeem-skeleton-block redeem-skeleton-amount-main"></div>
    <div class="redeem-skeleton-block redeem-skeleton-amount-cost"></div>
  </div>`;
}

function buildRecipientSkeletonHtml() {
  return `<div class="redeem-skeleton-block redeem-skeleton-label"></div>
    <div class="redeem-skeleton-block redeem-skeleton-input"></div>
    <div class="redeem-skeleton-block redeem-skeleton-label redeem-skeleton-label--short"></div>
    <div class="redeem-skeleton-block redeem-skeleton-input"></div>`;
}

function getSelectedProduct(ctx) {
  const productId = ctx.giftState.productId;
  if (!productId) return null;
  return (ctx.tremendousInfo.products || []).find((item) => item.product_id === productId) || null;
}

function getRecipientName(ctx) {
  return String(ctx.$.inputGiftRecipientName?.value || "").trim();
}

function trimRecipientNameInput(input) {
  if (!input) return false;
  const value = String(input.value || "");
  if (value.length > GIFT_RECIPIENT_NAME_MAX_LENGTH) {
    input.value = value.slice(0, GIFT_RECIPIENT_NAME_MAX_LENGTH);
    return true;
  }
  return false;
}

function willRecipientNameExceedLimit(input, event) {
  if (!input || !event || typeof event.data !== "string" || !event.data) return false;
  const value = String(input.value || "");
  const start = Number.isFinite(input.selectionStart) ? input.selectionStart : value.length;
  const end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : start;
  const nextLength = value.length - Math.max(0, end - start) + event.data.length;
  return nextLength > GIFT_RECIPIENT_NAME_MAX_LENGTH;
}

function getRecipientEmail(ctx) {
  return String(ctx.$.inputGiftRecipientEmail?.value || "").trim();
}

function trimRecipientEmailInput(input) {
  if (!input) return false;
  const value = String(input.value || "");
  if (value.length > GIFT_RECIPIENT_EMAIL_MAX_LENGTH) {
    input.value = value.slice(0, GIFT_RECIPIENT_EMAIL_MAX_LENGTH);
    return true;
  }
  return false;
}

function willRecipientEmailExceedLimit(input, event) {
  if (!input || !event || typeof event.data !== "string" || !event.data) return false;
  const value = String(input.value || "");
  const start = Number.isFinite(input.selectionStart) ? input.selectionStart : value.length;
  const end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : start;
  const nextLength = value.length - Math.max(0, end - start) + event.data.length;
  return nextLength > GIFT_RECIPIENT_EMAIL_MAX_LENGTH;
}

function isValidRecipientEmail(email) {
  return !!email && EMAIL_PATTERN.test(email);
}

function hasValidGiftContact(ctx) {
  return isValidRecipientEmail(getRecipientEmail(ctx));
}

function buildGiftRedeemPayload(ctx, denomination) {
  return {
    product_id: ctx.giftState.productId,
    denomination: denomination.denomination,
    currency_code: ctx.tremendousInfo.currencyCode,
    recipient_name: getRecipientName(ctx),
    delivery_method: GIFT_DELIVERY_EMAIL,
    recipient_email: getRecipientEmail(ctx),
    recipient_phone: "",
  };
}

export const giftCardRedeemMethods = {
  initGiftCardRedeem() {
    this.activeRedeemTab = GIFT_TAB;
    this.tremendousInfo = {
      countryCode: "",
      currencyCode: "",
      products: [],
    };
    this.giftRecords = [];
    this.showAllGiftRecords = false;
    this.giftState = {
      productId: null,
      selectedDenomination: null,
      spendCoin: 0,
    };
    this.giftExchangeLoading = false;
    this.giftCatalogLoading = false;
    this.giftRecordsLoading = false;
    this.walletLocalCurrency = getRedeemCurrencyForCountry(this.state?.countryCodeEnum).symbol;
    this.showGiftCatalogSkeleton();
    this.setActiveRedeemTab(GIFT_TAB, { skipLoad: true });
  },

  showGiftCatalogSkeleton() {
    const loadingLabel = t("redeem.loadingGiftCatalog");
    if (this.$.giftBrandGrid) {
      this.$.giftBrandGrid.innerHTML = Array.from({ length: GIFT_BRAND_SKELETON_COUNT }, () =>
        buildBrandSkeletonCardHtml(),
      ).join("");
      this.$.giftBrandGrid.setAttribute("aria-busy", "true");
      this.$.giftBrandGrid.setAttribute("aria-label", loadingLabel);
    }
    if (this.$.giftAmountSection) this.$.giftAmountSection.hidden = false;
    if (this.$.giftAmountGrid) {
      this.$.giftAmountGrid.innerHTML = Array.from({ length: GIFT_AMOUNT_SKELETON_COUNT }, () =>
        buildGiftAmountSkeletonCardHtml(),
      ).join("");
    }
    this.showGiftRecipientSkeleton();
  },

  showGiftRecipientSkeleton() {
    if (this.$.giftRecipientSection) this.$.giftRecipientSection.hidden = false;
    if (this.$.giftRecipientSkeleton) {
      this.$.giftRecipientSkeleton.hidden = false;
      this.$.giftRecipientSkeleton.innerHTML = buildRecipientSkeletonHtml();
    }
    if (this.$.giftRecipientForm) this.$.giftRecipientForm.hidden = true;
  },

  setRecipientNameErrorVisible(visible) {
    if (!this.$.giftRecipientNameError) return;
    this.$.giftRecipientNameError.hidden = !visible;
    if (this.$.inputGiftRecipientName) {
      this.$.inputGiftRecipientName.setAttribute("aria-invalid", visible ? "true" : "false");
      if (visible) {
        this.$.inputGiftRecipientName.setAttribute("aria-describedby", "giftRecipientNameError");
      } else {
        this.$.inputGiftRecipientName.removeAttribute("aria-describedby");
      }
    }
  },

  setRecipientEmailErrorVisible(visible) {
    if (!this.$.giftRecipientEmailError) return;
    this.$.giftRecipientEmailError.hidden = !visible;
    if (this.$.inputGiftRecipientEmail) {
      this.$.inputGiftRecipientEmail.setAttribute("aria-invalid", visible ? "true" : "false");
      if (visible) {
        this.$.inputGiftRecipientEmail.setAttribute("aria-describedby", "giftRecipientEmailError");
      } else {
        this.$.inputGiftRecipientEmail.removeAttribute("aria-describedby");
      }
    }
  },

  hideGiftRecipientSkeleton() {
    if (this.$.giftRecipientSkeleton) {
      this.$.giftRecipientSkeleton.hidden = true;
      this.$.giftRecipientSkeleton.innerHTML = "";
    }
    if (this.$.giftRecipientForm) this.$.giftRecipientForm.hidden = false;
  },

  resetGiftCatalog() {
    this.tremendousInfo = {
      countryCode: "",
      currencyCode: "",
      products: [],
    };
    this.giftState = {
      productId: null,
      selectedDenomination: null,
      spendCoin: 0,
    };
    this.resetGiftAmountUI();
  },

  getTremendousQueryParams() {
    const country = resolveRedeemCountry(this.state?.countryCodeEnum);
    const currency = getRedeemCurrencyForCountry(country.iso);
    return {
      country_code: country.iso,
      currency_code: currency.code,
      currencySymbol: currency.symbol,
    };
  },

  setActiveRedeemTab(tab, options = {}) {
    const nextTab = tab === TOPUP_TAB ? TOPUP_TAB : GIFT_TAB;
    this.activeRedeemTab = nextTab;
    const isGift = nextTab === GIFT_TAB;

    if (this.$.tabGiftCards) {
      this.$.tabGiftCards.classList.toggle("redeem-tab--active", isGift);
      this.$.tabGiftCards.setAttribute("aria-selected", isGift ? "true" : "false");
    }
    if (this.$.tabMobileTopup) {
      this.$.tabMobileTopup.classList.toggle("redeem-tab--active", !isGift);
      this.$.tabMobileTopup.setAttribute("aria-selected", !isGift ? "true" : "false");
    }
    if (this.$.giftCardPanel) {
      this.$.giftCardPanel.hidden = !isGift;
      this.$.giftCardPanel.classList.toggle("redeem-tab-panel--hidden", !isGift);
    }
    if (this.$.mobileTopupPanel) {
      this.$.mobileTopupPanel.hidden = isGift;
      this.$.mobileTopupPanel.classList.toggle("redeem-tab-panel--hidden", isGift);
    }

    if (!options.skipLoad && isGift) {
      void this.loadGiftCatalog();
      void this.loadGiftRecords();
    }
  },

  bindTabEvents() {
    if (this.$.tabGiftCards) {
      this._addDomListener(this.$.tabGiftCards, "click", () => {
        if (this.giftExchangeLoading) return;
        if (this.activeRedeemTab !== GIFT_TAB) {
          this.setActiveRedeemTab(GIFT_TAB);
        }
      });
    }
    if (this.$.tabMobileTopup) {
      this._addDomListener(this.$.tabMobileTopup, "click", () => {
        if (this.giftExchangeLoading) return;
        if (this.activeRedeemTab !== TOPUP_TAB) {
          this.setActiveRedeemTab(TOPUP_TAB);
        }
      });
    }
  },

  bindGiftCardEvents() {
    if (this.$.giftBrandGrid) {
      this._addDomListener(this.$.giftBrandGrid, "click", (e) => {
        if (this.giftExchangeLoading) return;
        const btn = e.target.closest(".redeem-brand-btn");
        if (!btn) return;
        const productId = btn.getAttribute("data-product-id");
        if (!productId) return;
        void this.selectGiftProduct(productId);
      });
    }

    if (this.$.giftAmountGrid) {
      this._addDomListener(this.$.giftAmountGrid, "click", (e) => {
        if (this.giftExchangeLoading) return;
        const btn = e.target.closest(".redeem-gift-amount-btn");
        if (!btn) return;
        const denomination = Number(btn.getAttribute("data-denomination"));
        const spendCoin = Number(btn.getAttribute("data-spend-coin"));
        if (!Number.isFinite(denomination) || denomination <= 0) return;
        void this.selectGiftDenomination({ denomination, spend_coin: spendCoin }, btn);
      });
    }

    const onRecipientInput = () => this.updateGiftRedeemState();
    if (this.$.inputGiftRecipientName) {
      this.$.inputGiftRecipientName.setAttribute("maxlength", String(GIFT_RECIPIENT_NAME_MAX_LENGTH));
      this._addDomListener(this.$.inputGiftRecipientName, "beforeinput", (e) => {
        if (this.giftExchangeLoading) {
          e.preventDefault();
          return;
        }
        if (willRecipientNameExceedLimit(this.$.inputGiftRecipientName, e)) {
          this.setRecipientNameErrorVisible(true);
        }
      });
      this._addDomListener(this.$.inputGiftRecipientName, "input", () => {
        if (this.giftExchangeLoading) return;
        const wasTrimmed = trimRecipientNameInput(this.$.inputGiftRecipientName);
        this.setRecipientNameErrorVisible(wasTrimmed);
        onRecipientInput();
      });
    }
    if (this.$.inputGiftRecipientEmail) {
      this.$.inputGiftRecipientEmail.setAttribute("maxlength", String(GIFT_RECIPIENT_EMAIL_MAX_LENGTH));
      this._addDomListener(this.$.inputGiftRecipientEmail, "beforeinput", (e) => {
        if (this.giftExchangeLoading) {
          e.preventDefault();
          return;
        }
        if (willRecipientEmailExceedLimit(this.$.inputGiftRecipientEmail, e)) {
          this.setRecipientEmailErrorVisible(true);
        }
      });
      this._addDomListener(this.$.inputGiftRecipientEmail, "input", () => {
        if (this.giftExchangeLoading) return;
        const wasTrimmed = trimRecipientEmailInput(this.$.inputGiftRecipientEmail);
        this.setRecipientEmailErrorVisible(wasTrimmed);
        onRecipientInput();
      });
    }

    if (this.$.btnGiftRedeem) {
      this._addDomListener(this.$.btnGiftRedeem, "click", () => {
        void this.performGiftRedeem();
      });
    }

    if (this.$.viewAllGiftRecordsBtn) {
      this._addDomListener(this.$.viewAllGiftRecordsBtn, "click", () => {
        if (this.giftExchangeLoading) return;
        this.showAllGiftRecords = !this.showAllGiftRecords;
        this.renderGiftRecords(this.giftRecords, this.showAllGiftRecords);
      });
    }
  },

  updateWalletLocalHint() {
    if (!this.$.walletLocalHint) return;
    const query = this.getTremendousQueryParams();
    this.walletLocalCurrency = query.currencySymbol;
    const coins = Number(this.userGoldCoins ?? 0);
    const localAmount = (coins / (this.goldCoinsPerYuan || 100)).toFixed(2);
    this.$.walletLocalHint.textContent = t("redeem.localCurrencyHint", {
      amount: `${query.currencySymbol}${localAmount}`,
    });
  },

  async ensureGiftProductSelection() {
    const products = this.tremendousInfo.products || [];
    if (!products.length) {
      this.resetGiftAmountUI();
      return;
    }

    const currentProduct = getSelectedProduct(this);
    const productId = currentProduct?.product_id || products[0]?.product_id;
    if (!productId) {
      this.resetGiftAmountUI();
      return;
    }

    await this.selectGiftProduct(productId, { preserveDenomination: Boolean(currentProduct) });
  },

  async loadGiftCatalog() {
    if (this.giftCatalogLoading) return;
    this.giftCatalogLoading = true;
    this.showGiftCatalogSkeleton();
    const token = this.config.apiOptions?.token || "";
    const query = this.getTremendousQueryParams();

    const applyCatalog = async (data) => {
      this.tremendousInfo = {
        countryCode: data?.country_code || query.country_code,
        currencyCode: data?.currency_code || query.currency_code,
        products: Array.isArray(data?.products) ? data.products : [],
      };
      this.walletLocalCurrency = getRedeemCurrencyForCountry(this.tremendousInfo.countryCode).symbol;
      this.updateWalletLocalHint();
      this.renderGiftBrandGrid(this.tremendousInfo.products);
      await this.ensureGiftProductSelection();
    };

    try {
      let applyPromise = Promise.resolve();
      const result = await loadTremendousCatalogWithSWR(
        token,
        query.country_code,
        query.currency_code,
        {
          fetcher: () =>
            getTremendousProducts(this.config.apiOptions, {
              country_code: query.country_code,
              currency_code: query.currency_code,
            }),
          onData: (data) => {
            applyPromise = applyCatalog(data);
          },
        },
      );
      if (!result.ok) {
        throw result.error || new Error(t("redeem.giftCatalogFailed"));
      }
      await applyPromise;
    } catch (error) {
      logger.warn("[Tremendous] Failed to load catalog", error?.message || error);
      if (!this.tremendousInfo.products.length) {
        await applyCatalog({
          country_code: query.country_code,
          currency_code: query.currency_code,
          products: [],
        });
      }
    } finally {
      this.giftCatalogLoading = false;
    }
  },

  renderGiftBrandGrid(products) {
    const grid = this.$.giftBrandGrid;
    if (!grid) return;
    grid.removeAttribute("aria-busy");
    grid.setAttribute("aria-label", t("redeem.selectBrand"));
    const list = Array.isArray(products) ? products : [];
    if (!list.length) {
      grid.innerHTML = `<div class="redeem-empty-hint">${escapeHtml(t("redeem.giftBrandsEmpty"))}</div>`;
      return;
    }
    grid.innerHTML = list
      .map((product) => {
        const productId = product.product_id || "";
        const active =
          productId && productId === this.giftState.productId ? " redeem-brand-btn--active" : "";
        return `<button type="button" class="redeem-brand-btn${active}" data-product-id="${escapeHtml(productId)}" role="option" aria-selected="${active ? "true" : "false"}">
          ${buildBrandIconHtml(product)}
          <span class="redeem-brand-name">${escapeHtml(product.product_name || productId)}</span>
        </button>`;
      })
      .join("");
  },

  resetGiftAmountUI() {
    this.giftState.selectedDenomination = null;
    this.giftState.spendCoin = 0;
    if (this.$.giftAmountSection) this.$.giftAmountSection.hidden = true;
    if (this.$.giftRecipientSection) this.$.giftRecipientSection.hidden = true;
    if (this.$.giftAmountGrid) this.$.giftAmountGrid.innerHTML = "";
    this.hideGiftRecipientSkeleton();
    this.updateGiftRedeemState();
  },

  async selectGiftProduct(productId, options = {}) {
    const shouldPreserveDenomination =
      options.preserveDenomination && this.giftState.productId === productId;
    const previousDenomination = shouldPreserveDenomination
      ? this.giftState.selectedDenomination
      : null;
    const previousSpendCoin = shouldPreserveDenomination
      ? this.giftState.spendCoin
      : 0;

    this.giftState.productId = productId;
    this.giftState.selectedDenomination = previousDenomination;
    this.giftState.spendCoin = Number(previousSpendCoin ?? 0);
    this.renderGiftBrandGrid(this.tremendousInfo.products);

    const product = getSelectedProduct(this);
    if (!product) {
      this.resetGiftAmountUI();
      return;
    }

    if (this.$.giftAmountSection) this.$.giftAmountSection.hidden = false;
    if (this.$.giftRecipientSection) this.$.giftRecipientSection.hidden = false;
    this.hideGiftRecipientSkeleton();
    this.renderGiftAmountGrid(product.denominations || []);
    if (previousDenomination) {
      const denomination = Number(previousDenomination.denomination);
      const button = Array.from(
        this.$.giftAmountGrid?.querySelectorAll(".redeem-gift-amount-btn") || [],
      ).find((el) => Number(el.getAttribute("data-denomination")) === denomination);
      button?.classList.add("redeem-gift-amount-btn--active");
    }
    this.updateGiftRedeemState();
  },

  renderGiftAmountGrid(denominations) {
    const grid = this.$.giftAmountGrid;
    if (!grid) return;
    const list = Array.isArray(denominations) ? denominations : [];
    const currencyCode = this.tremendousInfo.currencyCode;
    if (!list.length) {
      grid.innerHTML = `<div class="redeem-empty-hint">${escapeHtml(t("redeem.giftProductsEmpty"))}</div>`;
      return;
    }
    grid.innerHTML = list.map((item) => buildGiftAmountButtonHtml(item, currencyCode)).join("");
  },

  selectGiftDenomination(denominationOption, buttonEl) {
    this.$.giftAmountGrid
      ?.querySelectorAll(".redeem-gift-amount-btn")
      .forEach((el) => el.classList.remove("redeem-gift-amount-btn--active"));
    buttonEl?.classList.add("redeem-gift-amount-btn--active");

    this.giftState.selectedDenomination = denominationOption;
    this.giftState.spendCoin = Number(denominationOption.spend_coin ?? 0);
    this.updateGiftRedeemState();
  },

  updateGiftRedeemState() {
    const product = getSelectedProduct(this);
    const denomination = this.giftState.selectedDenomination;
    const summaryEl = this.$.giftRedeemSummary;
    const btn = this.$.btnGiftRedeem;
    const recipientName = getRecipientName(this);

    if (!product || !denomination) {
      if (summaryEl) summaryEl.textContent = t("redeem.giftSummaryDefault");
      if (btn) {
        btn.disabled = true;
        btn.classList.add("redeem-primary-btn--disabled");
      }
      return;
    }

    const coins = Number(this.giftState.spendCoin ?? 0);
    const label = formatRedeemDenomination(denomination.denomination, this.tremendousInfo.currencyCode);
    const contactReady = hasValidGiftContact(this);
    if (summaryEl) {
      if (!recipientName) {
        summaryEl.textContent = t("redeem.giftSummaryNeedRecipient", {
          coins,
          brand: product.product_name || "",
          value: label,
        });
      } else if (!contactReady) {
        summaryEl.textContent = t("redeem.giftSummaryNeedContact", {
          coins,
          brand: product.product_name || "",
          value: label,
        });
      } else {
        summaryEl.textContent = t("redeem.giftSummarySelected", {
          coins,
          brand: product.product_name || "",
          value: label,
        });
      }
    }

    const canAfford = coins > 0 && this.userGoldCoins >= coins;
    const canSubmit =
      canAfford &&
      !!recipientName &&
      contactReady &&
      !this.giftExchangeLoading &&
      !this.giftCatalogLoading;

    if (btn) {
      btn.disabled = !canSubmit;
      btn.classList.toggle("redeem-primary-btn--disabled", btn.disabled);
    }
  },

  async loadGiftRecords(options = {}) {
    const { force = false } = options;
    if (this.giftRecordsLoading && !force) return;
    this.giftRecordsLoading = true;
    try {
      const res = await getTremendousRecords(this.config.apiOptions, { limit: 20, offset: 0 });
      if (!isApiEnvelopeOk(res)) {
        throw new Error(res?.message || t("redeem.giftHistoryFailed"));
      }
      this.giftRecords = normalizeTremendousRecords(res?.data);
    } catch (error) {
      logger.warn("[Tremendous] Failed to load records", error?.message || error);
      this.giftRecords = [];
    } finally {
      this.giftRecordsLoading = false;
      this.renderGiftRecords(this.giftRecords, this.showAllGiftRecords);
    }
  },

  renderGiftRecords(records, showAll = false) {
    const listEl = this.$.giftHistoryList;
    if (!listEl) return;
    const list = Array.isArray(records) ? records : [];
    const visible = showAll ? list : list.slice(0, 2);

    if (!visible.length) {
      listEl.innerHTML = `<div class="redeem-empty-hint">${escapeHtml(t("redeem.giftHistoryEmpty"))}</div>`;
    } else {
      listEl.innerHTML = visible
        .map((record) => {
          const title = record.display_text || t("redeem.tabGiftCards");
          const value = formatRedeemDenomination(record.denomination, record.currency_code);
          const coins = Number(record.coin_cost ?? 0);
          const status = String(record.status || "success").toLowerCase();
          const iconClass =
            status === "processing" || status === "pending"
              ? "redeem-history-icon--processing"
              : status === "fail" || status === "failed" || status === "delivery_failed"
                ? "redeem-history-icon--fail"
                : "redeem-history-icon--success";
          const iconText =
            status === "processing" || status === "pending"
              ? "⏳"
              : status === "fail" || status === "failed" || status === "delivery_failed"
                ? "✕"
                : "✓";
          return `<div class="redeem-history-item">
            <div class="redeem-history-icon ${iconClass}">${iconText}</div>
            <div class="redeem-history-main">
              <div class="redeem-history-title">${escapeHtml(title)}</div>
              <div class="redeem-history-subtitle">${escapeHtml(formatGiftHistoryDate(record.created_at))}</div>
            </div>
            <div class="redeem-history-amount">
              <div>-${escapeHtml(value)}</div>
              <div class="redeem-history-coins">
                <span class="redeem-history-coin-icon"><img src="${assetUrl("icons/gold_coin.svg")}" alt="" /></span>
                <span>${escapeHtml(t("history.coinsAmount", { count: coins }))}</span>
              </div>
            </div>
          </div>`;
        })
        .join("");
    }

    if (this.$.viewAllGiftRecordsBtn) {
      this.$.viewAllGiftRecordsBtn.textContent = showAll ? t("redeem.collapse") : t("redeem.viewAll");
      this.$.viewAllGiftRecordsBtn.style.visibility = list.length > 2 ? "visible" : "hidden";
    }
  },

  applyGiftRedeemWallet(coinSpent) {
    const spent = Number(coinSpent);
    if (!Number.isFinite(spent) || spent <= 0) return;
    this.userGoldCoins = Math.max(0, Number(this.userGoldCoins ?? 0) - spent);
    this.updateUserGoldCoinsView();
    const token = this.config.apiOptions?.token || "";
    patchActivityInfoWalletCoin(token, this.userGoldCoins);
  },

  setGiftRedeemBusy(isBusy) {
    this.$.redeemRoot?.classList.toggle("redeem-root--gift-redeeming", Boolean(isBusy));
    if (this.$.redeemRoot) {
      this.$.redeemRoot.setAttribute("aria-busy", isBusy ? "true" : "false");
    }
    [this.$.inputGiftRecipientName, this.$.inputGiftRecipientEmail].forEach((input) => {
      if (!input) return;
      input.disabled = Boolean(isBusy);
      input.setAttribute("aria-disabled", isBusy ? "true" : "false");
      if (isBusy && document.activeElement === input) {
        input.blur();
      }
    });
  },

  async performGiftRedeem() {
    const product = getSelectedProduct(this);
    const denomination = this.giftState.selectedDenomination;
    if (!product || !denomination || this.giftExchangeLoading) return;

    const recipientName = getRecipientName(this);
    if (!recipientName) {
      this.config.onExchangeFailed(t("redeem.recipientNameRequired"));
      return;
    }
    if (recipientName.length > GIFT_RECIPIENT_NAME_MAX_LENGTH) {
      trimRecipientNameInput(this.$.inputGiftRecipientName);
      this.config.onExchangeFailed(
        t("redeem.recipientNameTooLong", { max: GIFT_RECIPIENT_NAME_MAX_LENGTH }),
      );
      return;
    }

    const recipientEmail = getRecipientEmail(this);
    if (recipientEmail.length > GIFT_RECIPIENT_EMAIL_MAX_LENGTH) {
      trimRecipientEmailInput(this.$.inputGiftRecipientEmail);
      this.config.onExchangeFailed(
        t("redeem.recipientEmailTooLong", { max: GIFT_RECIPIENT_EMAIL_MAX_LENGTH }),
      );
      return;
    }

    if (!hasValidGiftContact(this)) {
      this.config.onExchangeFailed(t("redeem.recipientEmailRequired"));
      return;
    }

    const redeemPayload = buildGiftRedeemPayload(this, denomination);
    const coins = Number(this.giftState.spendCoin ?? 0);
    if (coins > 0 && this.userGoldCoins < coins) {
      this.config.onExchangeFailed(t("redeem.notEnoughCoins"));
      return;
    }

    this.giftExchangeLoading = true;
    this.setGiftRedeemBusy(true);
    this.updateGiftRedeemState();
    if (this.$.btnGiftRedeem) {
      this.$.btnGiftRedeem.dataset.originalText = this.$.btnGiftRedeem.textContent || "";
      this.$.btnGiftRedeem.textContent = t("common.processing");
    }

    try {
      const res = await postTremendousRedeem(this.config.apiOptions, redeemPayload);
      const result = res?.data;
      if (!isApiEnvelopeOk(res) || !result?.success) {
        throw new Error(result?.message || res?.message || t("redeem.redeemFailed"));
      }

      this.applyGiftRedeemWallet(result.coin_spent);
      this.giftState.selectedDenomination = null;
      this.giftState.spendCoin = 0;
      if (this.$.giftAmountGrid) {
        this.$.giftAmountGrid.querySelectorAll(".redeem-gift-amount-btn").forEach((el) => {
          el.classList.remove("redeem-gift-amount-btn--active");
        });
      }
      await Promise.all([
        this.loadGiftRecords({ force: true }),
        this.pollWalletAfterRedeem?.(this.userGoldCoins + Number(result.coin_spent ?? 0)),
      ]);
      showToast(result.message || t("redeem.giftRedeemSuccess"), "success");
      if (result.delivery_link) {
        showToast(t("redeem.giftDeliveryLinkReady"), "info");
        try {
          window.open(result.delivery_link, "_blank", "noopener,noreferrer");
        } catch (_) {
          /* ignore popup blockers */
        }
      }
    } catch (error) {
      logger.error("Tremendous redeem failed", error);
      this.config.onExchangeFailed(error?.message || t("redeem.redeemFailed"));
    } finally {
      this.giftExchangeLoading = false;
      this.setGiftRedeemBusy(false);
      if (this.$.btnGiftRedeem) {
        this.$.btnGiftRedeem.textContent =
          this.$.btnGiftRedeem.dataset.originalText || t("redeem.redeemNow");
      }
      this.updateGiftRedeemState();
    }
  },
};

export { GIFT_TAB, TOPUP_TAB };
