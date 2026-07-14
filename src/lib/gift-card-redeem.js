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
import { shouldApplyLookupResult, trimInputToMax, willInputExceedLimit, setFieldErrorVisible } from "./redeem-request-guard.js";

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
  const logoUrl = String(product?.logo_url || "").trim();
  if (logoUrl) {
    return `<span class="redeem-brand-logo-shell">
      <img src="${escapeHtml(logoUrl)}" alt="" class="redeem-brand-logo">
      <span class="redeem-brand-icon redeem-brand-icon--default redeem-brand-logo-fallback" aria-hidden="true">🎁</span>
    </span>`;
  }
  return `<span class="redeem-brand-icon redeem-brand-icon--default" aria-hidden="true">🎁</span>`;
}

function bindBrandLogoFallbacks(grid) {
  grid.querySelectorAll(".redeem-brand-logo").forEach((logo) => {
    const shell = logo.closest(".redeem-brand-logo-shell");
    if (!shell) return;
    const showFallback = () => {
      shell.classList.add("redeem-brand-logo-shell--fallback");
    };
    const showLogo = () => {
      if (logo.naturalWidth > 0) {
        shell.classList.add("redeem-brand-logo-shell--loaded");
      }
    };
    logo.addEventListener("error", showFallback, { once: true });
    logo.addEventListener("load", showLogo, { once: true });
    if (logo.complete) {
      if (logo.naturalWidth > 0) {
        showLogo();
      } else {
        showFallback();
      }
    }
  });
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

function getRecipientEmail(ctx) {
  return String(ctx.$.inputGiftRecipientEmail?.value || "").trim();
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

function giftCatalogKeyFromQuery(query) {
  return `${query?.country_code || ""}:${query?.currency_code || ""}`;
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
    this._desiredGiftCatalogKey = "";
    this._appliedGiftCatalogKey = "";
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
    setFieldErrorVisible(
      this.$.inputGiftRecipientName,
      this.$.giftRecipientNameError,
      "giftRecipientNameError",
      visible,
    );
  },

  setRecipientEmailErrorVisible(visible) {
    setFieldErrorVisible(
      this.$.inputGiftRecipientEmail,
      this.$.giftRecipientEmailError,
      "giftRecipientEmailError",
      visible,
    );
  },

  hideGiftRecipientSkeleton() {
    if (this.$.giftRecipientSkeleton) {
      this.$.giftRecipientSkeleton.hidden = true;
      this.$.giftRecipientSkeleton.innerHTML = "";
    }
    if (this.$.giftRecipientForm) this.$.giftRecipientForm.hidden = false;
  },

  resetGiftCatalog() {
    this._desiredGiftCatalogKey = "";
    this._appliedGiftCatalogKey = "";
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
        if (willInputExceedLimit(this.$.inputGiftRecipientName, e, GIFT_RECIPIENT_NAME_MAX_LENGTH)) {
          this.setRecipientNameErrorVisible(true);
        }
      });
      this._addDomListener(this.$.inputGiftRecipientName, "input", () => {
        if (this.giftExchangeLoading) return;
        const wasTrimmed = trimInputToMax(this.$.inputGiftRecipientName, GIFT_RECIPIENT_NAME_MAX_LENGTH);
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
        if (willInputExceedLimit(this.$.inputGiftRecipientEmail, e, GIFT_RECIPIENT_EMAIL_MAX_LENGTH)) {
          this.setRecipientEmailErrorVisible(true);
        }
      });
      this._addDomListener(this.$.inputGiftRecipientEmail, "input", () => {
        if (this.giftExchangeLoading) return;
        const wasTrimmed = trimInputToMax(this.$.inputGiftRecipientEmail, GIFT_RECIPIENT_EMAIL_MAX_LENGTH);
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
    const query = this.getTremendousQueryParams();
    const requestKey = giftCatalogKeyFromQuery(query);
    this._desiredGiftCatalogKey = requestKey;

    // Remember the latest country/currency; replay after the in-flight request finishes.
    if (this.giftCatalogLoading) return;

    this.giftCatalogLoading = true;
    this.showGiftCatalogSkeleton();

    const isCurrent = () =>
      shouldApplyLookupResult({
        requestKey,
        desiredKey: this._desiredGiftCatalogKey,
        currentKey: giftCatalogKeyFromQuery(this.getTremendousQueryParams()),
      });

    const applyCatalog = async (data) => {
      if (!isCurrent()) return;
      this.tremendousInfo = {
        countryCode: data?.country_code || query.country_code,
        currencyCode: data?.currency_code || query.currency_code,
        products: Array.isArray(data?.products) ? data.products : [],
      };
      this._appliedGiftCatalogKey = requestKey;
      this.walletLocalCurrency = getRedeemCurrencyForCountry(this.tremendousInfo.countryCode).symbol;
      this.updateWalletLocalHint();
      this.renderGiftBrandGrid(this.tremendousInfo.products);
      await this.ensureGiftProductSelection();
    };

    try {
      const token = this.config.apiOptions?.token || "";
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
      if (!isCurrent()) return;
      if (!result.ok) {
        throw result.error || new Error(t("redeem.giftCatalogFailed"));
      }
      await applyPromise;
    } catch (error) {
      logger.warn("[Tremendous] Failed to load catalog", error?.message || error);
      if (isCurrent() && !this.tremendousInfo.products.length) {
        await applyCatalog({
          country_code: query.country_code,
          currency_code: query.currency_code,
          products: [],
        });
      }
    } finally {
      this.giftCatalogLoading = false;
      const desired = this._desiredGiftCatalogKey;
      if (desired && desired !== requestKey) {
        void this.loadGiftCatalog();
      }
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
    bindBrandLogoFallbacks(grid);
  },

  updateGiftBrandSelection() {
    this.$.giftBrandGrid
      ?.querySelectorAll(".redeem-brand-btn")
      .forEach((button) => {
        const isActive = button.getAttribute("data-product-id") === this.giftState.productId;
        button.classList.toggle("redeem-brand-btn--active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });
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
    this.updateGiftBrandSelection();

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

    const currentCatalogKey = giftCatalogKeyFromQuery(this.getTremendousQueryParams());
    if (
      !this._appliedGiftCatalogKey ||
      this._appliedGiftCatalogKey !== currentCatalogKey ||
      this.tremendousInfo.countryCode !== this.getTremendousQueryParams().country_code
    ) {
      this.config.onExchangeFailed(t("redeem.giftCatalogFailed"));
      void this.loadGiftCatalog();
      return;
    }

    const recipientName = getRecipientName(this);
    if (!recipientName) {
      this.config.onExchangeFailed(t("redeem.recipientNameRequired"));
      return;
    }
    if (recipientName.length > GIFT_RECIPIENT_NAME_MAX_LENGTH) {
      trimInputToMax(this.$.inputGiftRecipientName, GIFT_RECIPIENT_NAME_MAX_LENGTH);
      this.config.onExchangeFailed(
        t("redeem.recipientNameTooLong", { max: GIFT_RECIPIENT_NAME_MAX_LENGTH }),
      );
      return;
    }

    const recipientEmail = getRecipientEmail(this);
    if (recipientEmail.length > GIFT_RECIPIENT_EMAIL_MAX_LENGTH) {
      trimInputToMax(this.$.inputGiftRecipientEmail, GIFT_RECIPIENT_EMAIL_MAX_LENGTH);
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
