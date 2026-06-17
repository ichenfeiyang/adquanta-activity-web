import { getActivityInfo, getCharges, postChargeRedeem } from "./activity-api.js";
import {
  getActivityInfoCache,
  getChargeRecordsCache,
  invalidateActivityInfoCache,
  invalidateChargeRecordsCache,
  loadActivityInfoWithSWR,
  loadChargesWithSWR,
  patchActivityInfoWalletCoin,
  setActivityInfoCache,
} from "./activity-page-cache.js";
import * as logger from "./activity-logger.js";
import { assetUrl } from "./asset-url.js";
import { escapeHtml } from "./escape-html.js";
import { REDEEM_SUMMARY_DEFAULT } from "./activity-messages.js";
import { redeemHistoryMethods } from "./redeem-history.js";
import { bindPageElements } from "./bind-page-elements.js";
import {
  DEFAULT_REDEEM_COUNTRY,
  getInitialRedeemCountry,
  resolveRedeemCountry,
  saveRedeemCountry,
  SUPPORTED_REDEEM_COUNTRIES,
} from "./redeem-country.js";

/**
 * 金币兑换页面
 */
export class GoldCoinsExchange {
  constructor(config = {}) {
    this.config = {
      router: config.router || null,
      onExchangeFailed: config.onExchangeFailed || (() => {}),
      apiOptions: config.apiOptions || {},
    };

    // 当前用户金币（未获取到服务端数据前缺省 0）
    this.userGoldCoins = 0;

    // 话费选项（来自 /api/v1/ops/activity/charges）
    /** @type {Array<{ provider_code: string, provider_name: string, logo_url?: string, products: Array<object> }> | null} */
    this.chargesProviders = null;
    /** 当前选中的运营商 key（优先 provider_code） */
    this.selectedProviderCode = null;
    /** 当前运营商下的面额列表（与原先 flattened 单项结构一致） */
    this.chargesOptions = null;
    this.chargesLoaded = false;
    this.chargesLoading = false;
    this.lastChargesMobile = "";
    this._chargesDebounceTimer = null;

    // Redeem request lock (prevent multi-click / multi-request)
    this.exchangeLoading = false;
    this.lastSubmitAt = 0;
    this.submitDebounceMs = 800;

    // 基础信息接口返回的 records（用于兑换记录列表与「查看全部」）
    this.records = [];
    this.showAllRecords = false;

    // 兑换状态
    this.state = {
      mobile: "",
      countryCode: DEFAULT_REDEEM_COUNTRY.dialCode,
      countryCodeEnum: DEFAULT_REDEEM_COUNTRY.iso,
      operator: "-",
      /** 是否已明确选中运营商（与 state.operator 展示名配合） */
      operatorSelected: false,
      amount: null,
      // Flattened product selected from /charges
      // { charges_id(sku_code), amount, amount_text, spend_coin, provider_name, receive_currency }
      selectedCharge: null,
    };

    // 无接口时的默认比例（1 元 = 100 金币）
    this.goldCoinsPerYuan = 100;

    this.$ = bindPageElements({
      userGoldCoins: "userGoldCoins",
      inputMobile: "inputMobile",
      countryCodeBtn: "countryCodeBtn",
      countryCodeDropdown: "countryCodeDropdown",
      operatorGrid: "operatorGrid",
      operatorSection: "operatorSection",
      amountSection: "amountSection",
      amountGrid: "amountGrid",
      btnRedeem: "btnRedeem",
      redeemSummary: "redeemSummary",
      historyList: "historyList",
      viewAllRecordsBtn: "viewAllRecords",
      historySection: { selector: ".redeem-history-section" },
    });

    this._domDisposers = [];
    this._countryDropdownOpen = false;
  }

  _addDomListener(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    this._domDisposers.push(() => target.removeEventListener(type, handler, options));
  }

  destroy() {
    if (this._chargesDebounceTimer) {
      clearTimeout(this._chargesDebounceTimer);
      this._chargesDebounceTimer = null;
    }
    this.closeCountryCodeDropdown();
    for (const dispose of this._domDisposers) {
      dispose();
    }
    this._domDisposers = [];
  }

  /**
   * 初始化页面
   */
  async init() {
    this.destroy();
    this.setCountryState(getInitialRedeemCountry());
    this.refreshCountryCodeUI();
    this.closeCountryCodeDropdown();
    this.hydrateFromCache();
    this.initHistory();
    this.bindEvents();
    await Promise.all([this.loadActivityInfo(), this.loadRecords()]);
    this.setChargesUIVisible(false);
  }

  setCountryState(country) {
    this.state.countryCode = country.dialCode;
    this.state.countryCodeEnum = country.iso;
  }

  refreshCountryCodeUI() {
    this.updateCountryCodeBtnView();
    this.renderCountryCodeDropdown();
  }

  getChargesLookupKey(mobile) {
    return `${this.state.countryCodeEnum}:${String(mobile || "")}`;
  }

  setCountryDropdownOpen(isOpen) {
    this._countryDropdownOpen = isOpen;
    if (this.$.countryCodeDropdown) {
      this.$.countryCodeDropdown.hidden = !isOpen;
    }
    if (this.$.countryCodeBtn) {
      this.$.countryCodeBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  renderCountryCodeButton(country) {
    const btn = this.$.countryCodeBtn;
    if (!btn) return;
    btn.innerHTML = `
      <span class="redeem-countrycode-flag" aria-hidden="true">${country.flag}</span>
      <span class="redeem-countrycode-dial">${escapeHtml(country.dialCode)}</span>
      <span class="redeem-countrycode-chevron" aria-hidden="true">▾</span>
    `;
  }

  updateCountryCodeBtnView() {
    this.renderCountryCodeButton(resolveRedeemCountry(this.state.countryCodeEnum));
    if (this.$.countryCodeBtn) {
      this.$.countryCodeBtn.setAttribute("aria-expanded", this._countryDropdownOpen ? "true" : "false");
    }
  }

  renderCountryCodeDropdown() {
    if (!this.$.countryCodeDropdown) return;
    this.$.countryCodeDropdown.innerHTML = SUPPORTED_REDEEM_COUNTRIES.map((country) => {
      const active = country.iso === this.state.countryCodeEnum ? " redeem-countrycode-item--active" : "";
      return `<button
        type="button"
        class="redeem-countrycode-item${active}"
        role="option"
        data-country-iso="${escapeHtml(country.iso)}"
        aria-selected="${country.iso === this.state.countryCodeEnum ? "true" : "false"}"
      >
        <span class="redeem-countrycode-item-flag" aria-hidden="true">${country.flag}</span>
        <span class="redeem-countrycode-item-main">
          <span class="redeem-countrycode-item-name">${escapeHtml(country.name)}</span>
          <span class="redeem-countrycode-item-dial">${escapeHtml(country.dialCode)}</span>
        </span>
      </button>`;
    }).join("");
  }

  toggleCountryCodeDropdown() {
    this.setCountryDropdownOpen(!this._countryDropdownOpen);
  }

  closeCountryCodeDropdown() {
    this.setCountryDropdownOpen(false);
  }

  selectCountry(iso) {
    this.setCountryState(saveRedeemCountry(iso));
    this.closeCountryCodeDropdown();
    this.refreshCountryCodeUI();
    this.resetChargesUI();
    this.maybeLoadChargesForMobile(this.state.mobile);
    this.updateRedeemState();
  }

  hydrateFromCache() {
    const token = this.config.apiOptions?.token || "";
    const cachedInfo = getActivityInfoCache(token);
    if (cachedInfo?.wallet_info != null && typeof cachedInfo.wallet_info.coin === "number") {
      this.userGoldCoins = cachedInfo.wallet_info.coin;
    }
    this.updateUserGoldCoinsView();

    const cachedRecords = getChargeRecordsCache(token);
    if (cachedRecords != null) {
      this.records = this.normalizeRecordsPayload(cachedRecords);
      this.renderRecords(this.records, this.showAllRecords);
    }
  }

  setChargesUIVisible(visible) {
    if (this.$.operatorSection) this.$.operatorSection.style.display = visible ? "" : "none";
    if (this.$.amountSection) this.$.amountSection.style.display = visible ? "" : "none";
  }

  resetChargesUI() {
    this.chargesProviders = null;
    this.selectedProviderCode = null;
    this.chargesOptions = null;
    this.chargesLoaded = false;
    this.chargesLoading = false;
    this.lastChargesMobile = "";
    this.state.amount = null;
    this.state.selectedCharge = null;
    this.state.operator = "-";
    this.state.operatorSelected = false;
    if (this.$.operatorGrid) this.$.operatorGrid.innerHTML = "";
    if (this.$.amountGrid) this.$.amountGrid.innerHTML = "";
    this.setChargesUIVisible(false);
    this.updateRedeemState();
  }

  getFullPhoneNumber() {
    const countryCode = String(this.state.countryCode || "").replace(/\D/g, "");
    const phone = String(this.state.mobile || "").replace(/\D/g, "");
    return `${countryCode}${phone}`;
  }

  maybeLoadChargesForMobile(mobile) {
    const m = String(mobile || "");
    if (!/^\d{6,15}$/.test(m)) {
      this.resetChargesUI();
      return;
    }
    // debounce to avoid spamming while typing
    if (this._chargesDebounceTimer) clearTimeout(this._chargesDebounceTimer);
    this._chargesDebounceTimer = setTimeout(() => {
      const lookupKey = this.getChargesLookupKey(m);
      if (this.chargesLoading) return;
      if (this.lastChargesMobile === lookupKey && this.chargesLoaded) return;
      this.lastChargesMobile = lookupKey;
      this.loadCharges();
    }, 350);
  }

  applyWalletFromActivityInfo(d) {
    if (d?.wallet_info != null && typeof d.wallet_info.coin === "number") {
      this.userGoldCoins = d.wallet_info.coin;
      this.updateUserGoldCoinsView();
    }
  }

  /**
   * 加载活动基础数据：wallet_info.coin 更新金币
   */
  async loadActivityInfo(options = {}) {
    const { force = false } = options;
    const token = this.config.apiOptions?.token || "";

    try {
      if (force) {
        invalidateActivityInfoCache(token);
      }

      await loadActivityInfoWithSWR(token, {
        force,
        fetcher: () => getActivityInfo(this.config.apiOptions),
        onData: (data) => this.applyWalletFromActivityInfo(data),
      });
    } catch (e) {
      logger.warn("[Activity API] Exchange page fetch failed", e?.message || e);
    }
  }

  /**
   * 解析 records 返回的列表（兼容 data 为数组或 { records: [] } 等形态）
   */




  /**
   * 加载兑换记录（/api/v1/ops/activity/charges/records）
   */


  /**
   * 格式化记录时间用于展示，如 "Mar 14, 2025 • 08:30"
   */


  /**
   * 用基础信息接口返回的 records 渲染兑换记录（仅兑换类型）
   * 默认只展示 2 条；点击「查看全部」后展示全部兑换数据，按钮变为「收起」
   * @param {Array} records - 接口 data.records
   * @param {boolean} [showAll=false] - true 时展示全部兑换记录，false 时只展示前 2 条
   */




  applyChargesData(data) {
    const providers = data?.providers;
    if (!Array.isArray(providers) || providers.length === 0) {
      this.resetChargesUI();
      return;
    }

    const chargesProviders = providers
      .map((p) => {
        const providerName = String(p?.provider_name ?? "").trim();
        const providerCode = String(p?.provider_code ?? providerName ?? "").trim() || providerName;
        const products = Array.isArray(p?.products) ? p.products : [];
        const items = products
          .filter((prod) => prod && prod.available === true)
          .map((prod) => ({
            charges_id: prod.sku_code ?? "",
            amount: Number(prod.receive_value ?? 0),
            amount_text: `${prod.receive_value ?? 0} ${prod.receive_currency ?? ""}`.trim(),
            spend_coin: Number(prod.spend_coin ?? 0),
            provider_name: providerName,
            provider_code: providerCode,
            receive_currency: prod.receive_currency ?? "",
            send_value: prod.send_value ?? "",
          }))
          .filter((x) => x.charges_id && Number.isFinite(x.amount))
          .sort((a, b) => a.amount - b.amount);
        return {
          provider_code: providerCode,
          provider_name: providerName || providerCode,
          logo_url: p?.logo_url,
          products: items,
        };
      })
      .filter((row) => row.products.length > 0);

    if (!chargesProviders.length) {
      this.resetChargesUI();
      return;
    }

    this.chargesProviders = chargesProviders;
    this.selectedProviderCode = null;
    this.chargesOptions = null;
    this.state.amount = null;
    this.state.selectedCharge = null;
    this.state.operator = "-";
    this.state.operatorSelected = false;

    this.renderOperatorGrid(chargesProviders);
    this.renderAmountGrid([]);
    this.chargesLoaded = true;
    this.setChargesUIVisible(true);
    logger.log("[Top-up] Render operators and amounts from API\n" + JSON.stringify(data, null, 2));
  }

  /**
   * 加载话费选项（/api/v1/ops/activity/charges），成功则用接口数据渲染面额
   */
  async loadCharges(options = {}) {
    const { force = false } = options;
    const token = this.config.apiOptions?.token || "";
    const phoneNumber = this.getFullPhoneNumber();

    try {
      this.chargesLoading = true;
      const result = await loadChargesWithSWR(token, phoneNumber, {
        force,
        fetcher: () =>
          getCharges(this.config.apiOptions, {
            country_code: this.state.countryCodeEnum,
            phone_number: phoneNumber,
          }),
        onData: (data) => this.applyChargesData(data),
      });

      if (!result.ok) {
        if (!force) {
          await this.loadCharges({ force: true });
          return;
        }
        this.resetChargesUI();
      }
    } catch (e) {
      logger.warn("[Top-up] Request failed", e?.message || e);
      this.resetChargesUI();
    } finally {
      this.chargesLoading = false;
    }
  }

  /**
   * 用接口返回的 options 渲染面额按钮
   */
  renderAmountGrid(options) {
    if (!this.$.amountGrid) return;
    const list = Array.isArray(options) ? options : [];
    this.$.amountGrid.innerHTML = list
      .map(
        (o) =>
          `<button class="redeem-amount-btn" data-amount="${o.amount}" data-spend-coin="${o.spend_coin}" data-charges-id="${escapeHtml(
            o.charges_id
          )}">
            <span class="redeem-amount-main">${escapeHtml(o.amount_text || String(o.amount))}</span>
            <span class="redeem-amount-cost">
              <img src="${assetUrl("icons/gold_coin.svg")}" alt="" class="redeem-amount-coin-icon" />
              <span>${Number(o.spend_coin ?? 0)}</span>
            </span>
          </button>`
      )
      .join("");
    this.state.amount = null;
    this.state.selectedCharge = null;
    this.updateRedeemState();
  }

  /**
   * 渲染全部运营商；选中态由 selectedProviderCode 决定
   * @param {Array<{ provider_code: string, provider_name: string }>} providers
   */
  renderOperatorGrid(providers) {
    if (!this.$.operatorGrid) return;
    const list = Array.isArray(providers) ? providers : [];
    this.$.operatorGrid.innerHTML = list
      .map((p) => {
        const code = String(p.provider_code ?? "");
        const name = String(p.provider_name ?? code ?? "-");
        const active = code && code === this.selectedProviderCode ? " redeem-operator-btn--active" : "";
        return `<button type="button" class="redeem-operator-btn${active}" data-provider-code="${escapeHtml(code)}">${escapeHtml(
          name
        )}</button>`;
      })
      .join("");
  }

  /**
   * 选中运营商：更新该运营商对应的面额列表（切换运营商会清空已选面额）
   * @param {string} providerCode
   */
  selectProvider(providerCode) {
    const code = String(providerCode || "");
    if (!code || !Array.isArray(this.chargesProviders)) return;
    const row = this.chargesProviders.find((x) => String(x.provider_code) === code);
    if (!row || !row.products?.length) return;

    this.selectedProviderCode = code;
    this.state.operator = row.provider_name || code;
    this.state.operatorSelected = true;
    this.chargesOptions = row.products;
    this.state.amount = null;
    this.state.selectedCharge = null;

    this.renderOperatorGrid(this.chargesProviders);
    this.renderAmountGrid(row.products);
  }

  /**
   * 更新金币显示
   */
  updateUserGoldCoinsView() {
    if (this.$.userGoldCoins) {
      this.$.userGoldCoins.textContent = this.userGoldCoins;
    }
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * After redeem submit succeeds, poll base info to refresh wallet coin.
   * Rules:
   * - Poll every 3 seconds
   * - Maximum 4 requests
   * - Stop early once coin decreases
   */
  async pollWalletAfterRedeem(previousCoins) {
    const before = Number(previousCoins ?? this.userGoldCoins ?? 0);
    for (let i = 0; i < 4; i++) {
      await this.sleep(3000);
      try {
        const res = await getActivityInfo(this.config.apiOptions);
        const nextCoin = Number(res?.data?.wallet_info?.coin);
        if (!Number.isFinite(nextCoin)) continue;
        this.userGoldCoins = nextCoin;
        this.updateUserGoldCoinsView();
        this.updateRedeemState();
        const token = this.config.apiOptions?.token || "";
        if (res?.code === 200 && res?.data) {
          setActivityInfoCache(token, res.data);
        } else {
          patchActivityInfoWalletCoin(token, nextCoin);
        }
        if (nextCoin < before) {
          break;
        }
      } catch (e) {
        logger.warn("[Wallet refresh after redeem] Request failed", e?.message || e);
      }
    }
  }

  /**
   * 清空兑换记录列表（加载前占位，实际数据由 loadActivityInfo 拉取 data.records 后 renderRecords 渲染）
   */


  /**
   * 计算本次所需金币（优先用接口选项的 spend_coin，否则用金额×比例）
   */
  getRequiredGoldCoins() {
    if (this.state.selectedCharge && typeof this.state.selectedCharge.spend_coin === "number") {
      return this.state.selectedCharge.spend_coin;
    }
    if (!this.state.amount) return 0;
    return this.state.amount * this.goldCoinsPerYuan;
  }

  /**
   * 更新兑换按钮与摘要
   */
  updateRedeemState() {
    if (!this.$.btnRedeem || !this.$.redeemSummary) return;

    const goldCoins = this.getRequiredGoldCoins();
    const validMobile = typeof this.state.mobile === "string" && /^\d{6,15}$/.test(this.state.mobile);
    const hasOperator = !!this.selectedProviderCode && this.state.operatorSelected === true;
    const hasAmount = !!this.state.amount;
    const canAfford = goldCoins > 0 && this.userGoldCoins >= goldCoins;

    if (this.exchangeLoading) {
      this.$.btnRedeem.disabled = true;
      this.$.btnRedeem.classList.add("redeem-primary-btn--disabled");
      this.$.redeemSummary.textContent = "Processing...";
      return;
    }

    if (validMobile && !this.chargesLoaded) {
      this.$.redeemSummary.textContent = "Loading top-up options...";
      this.$.btnRedeem.disabled = true;
      this.$.btnRedeem.classList.add("redeem-primary-btn--disabled");
      return;
    }

    if (validMobile && this.chargesLoaded && !hasOperator) {
      this.$.redeemSummary.textContent = "Select an operator";
      this.$.btnRedeem.disabled = true;
      this.$.btnRedeem.classList.add("redeem-primary-btn--disabled");
      return;
    }

    if (validMobile && hasOperator && !hasAmount) {
      this.$.redeemSummary.textContent = "Select top-up amount";
      this.$.btnRedeem.disabled = true;
      this.$.btnRedeem.classList.add("redeem-primary-btn--disabled");
      return;
    }

    if (validMobile && hasOperator && hasAmount) {
      const label = this.state.selectedCharge?.amount_text || String(this.state.amount ?? "");
      this.$.redeemSummary.textContent = `Use ${goldCoins} coins to top up ${label} (${this.state.operator}) for ${this.state.countryCode} ${this.state.mobile}`;
    } else {
      this.$.redeemSummary.textContent = REDEEM_SUMMARY_DEFAULT;
    }

    const canRedeem = validMobile && hasOperator && hasAmount && canAfford;
    this.$.btnRedeem.disabled = !canRedeem;
    if (canRedeem) {
      this.$.btnRedeem.classList.remove("redeem-primary-btn--disabled");
    } else {
      this.$.btnRedeem.classList.add("redeem-primary-btn--disabled");
    }
  }

  /**
   * 组装本次兑换商品信息（用于回调展示）
   */
  buildRedeemProduct() {
    const coins = this.getRequiredGoldCoins();
    if (!coins) return null;

    const label = this.state.selectedCharge?.amount_text || String(this.state.amount ?? "");
    return {
      name: `Top-up ${label}`,
      icon: "📱",
      points: coins,
      mobile: `${this.state.countryCode} ${this.state.mobile}`,
      operator: this.state.operator,
    };
  }

  /**
   * 执行兑换
   */
  showExchangeConfirmModal({ coins, amountLabel }) {
    const modal = document.getElementById("exchangeModal");
    if (!modal) {
      // Fallback: keep behavior safe if modal markup missing.
      return Promise.resolve(
        window.confirm(`Use ${coins} Gold Coins to redeem ${amountLabel || "-"} top-up?`)
      );
    }

    const previewName = document.getElementById("previewName");
    const previewPoints = document.getElementById("previewPoints");
    const confirmPoints = document.getElementById("confirmPoints");
    const confirmName = document.getElementById("confirmName");

    const closeBtn = document.getElementById("modalCloseBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const confirmBtn = document.getElementById("confirmBtn");

    if (previewName) previewName.textContent = `Top-up ${amountLabel || "-"}`;
    if (previewPoints) previewPoints.textContent = `${coins} coins`;
    if (confirmPoints) confirmPoints.textContent = String(coins ?? 0);
    if (confirmName) confirmName.textContent = String(amountLabel || "-");

    // Show modal.
    modal.style.display = "flex";

    let resetOverflow = () => {};
    const cleanup = () => {
      modal.style.display = "none";
      if (closeBtn) closeBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (confirmBtn) confirmBtn.onclick = null;
      try {
        resetOverflow();
      } catch (_) {}
    };

    return new Promise((resolve) => {
      if (closeBtn)
        closeBtn.onclick = () => {
          cleanup();
          resolve(false);
        };

      if (cancelBtn)
        cancelBtn.onclick = () => {
          cleanup();
          resolve(false);
        };

      if (confirmBtn)
        confirmBtn.onclick = () => {
          cleanup();
          resolve(true);
        };

      // Prevent background scroll when modal open.
      try {
        document.body.style.overflow = "hidden";
        resetOverflow = () => {
          document.body.style.overflow = "";
        };
      } catch (_) {}
    });
  }

  async performExchange() {
    const now = Date.now();
    if (this.exchangeLoading) return;
    if (now - this.lastSubmitAt < this.submitDebounceMs) return;
    this.lastSubmitAt = now;

    const product = this.buildRedeemProduct();
    if (!product) return;
    const coins = product.points;

    // 检查金币是否足够
    if (this.userGoldCoins < coins) {
      this.config.onExchangeFailed("Not enough coins to redeem");
      return;
    }

    const amountLabelRaw = this.state.selectedCharge?.amount_text;
    let amountLabel = "";
    if (typeof amountLabelRaw === "string") {
      amountLabel = amountLabelRaw;
    } else if (amountLabelRaw && typeof amountLabelRaw === "object") {
      // Avoid "[object Object]" when backend sends an object unexpectedly.
      const v = amountLabelRaw.receive_value ?? amountLabelRaw.value ?? amountLabelRaw.amount ?? "";
      const c =
        amountLabelRaw.receive_currency ?? amountLabelRaw.currency ?? amountLabelRaw.unit ?? amountLabelRaw.amount_currency ?? "";
      amountLabel = `${v} ${c}`.trim();
    }
    if (!amountLabel || amountLabel === "[object Object]") {
      // Fallback to current selection amount.
      const selected = this.state.selectedCharge || {};
      const currency = selected.receive_currency ?? selected.currency ?? "";
      amountLabel = (typeof this.state.amount === "number" ? String(this.state.amount) : String(this.state.amount ?? "")).trim();
      if (currency && amountLabel) amountLabel = `${amountLabel} ${currency}`.trim();
    }
    const confirmed = await this.showExchangeConfirmModal({
      coins,
      amountLabel,
    });
    if (!confirmed) return;

    try {
      this.exchangeLoading = true;
      if (this.$.btnRedeem) {
        if (!this.$.btnRedeem.dataset.originalText) {
          this.$.btnRedeem.dataset.originalText = this.$.btnRedeem.textContent || "Redeem Now";
        }
        this.$.btnRedeem.textContent = "Processing...";
        this.$.btnRedeem.disabled = true;
        this.$.btnRedeem.classList.add("redeem-primary-btn--disabled");
      }

      const chargesId = this.state.selectedCharge?.charges_id || this.state.selectedCharge?.chargesId || "";
      if (!chargesId) {
        this.config.onExchangeFailed("Missing charges_id");
        return;
      }
      const sendValue = this.state.selectedCharge?.send_value ?? this.state.selectedCharge?.sendValue ?? "";
      if (sendValue === "" || sendValue === null || sendValue === undefined) {
        this.config.onExchangeFailed("Missing send_value");
        return;
      }
      const phone_number = this.getFullPhoneNumber();
      if (!/^\d{6,20}$/.test(phone_number)) {
        this.config.onExchangeFailed("Invalid phone number");
        return;
      }

      // Backend requires sku_code + send_value (instead of charges_id).
      const res = await postChargeRedeem(this.config.apiOptions, {
        sku_code: String(chargesId),
        send_value: sendValue,
        phone_number,
      });
      const msg = res?.data?.message || res?.message || "";
      if (res?.code !== 200) {
        this.config.onExchangeFailed(msg || "Redemption failed, please try again");
        return;
      }
      if (res?.data?.success !== true) {
        this.config.onExchangeFailed(msg || "Submit failed, please try again");
        return;
      }

      const distributorRef = String(res?.data?.distributor_ref || "").trim();
      if (!distributorRef) {
        this.config.onExchangeFailed("Missing distributor_ref");
        return;
      }

      invalidateChargeRecordsCache(this.config.apiOptions?.token || "");

      // Refresh wallet coin after redeem submit:
      // poll every 3 seconds, max 4 times, stop once coin decreases.
      await this.pollWalletAfterRedeem(this.userGoldCoins);

      // Submit succeeded and order created: jump to detail page.
      this.openTopupStatusPage({
        distributor_ref: distributorRef,
        status: String(res?.data?.status || "pending").toLowerCase(),
        amount_label: this.state.selectedCharge?.amount_text || String(this.state.amount ?? ""),
        send_value: sendValue,
        phone_number,
        operator: this.state.operator || "",
      });
      return;
    } catch (error) {
      logger.error("Redeem top-up failed", error);
      this.config.onExchangeFailed(error?.message || "Redemption failed, please try again");
    } finally {
      this.exchangeLoading = false;
      if (this.$.btnRedeem) {
        this.$.btnRedeem.textContent = this.$.btnRedeem.dataset.originalText || "Redeem Now";
      }
      this.updateRedeemState();
    }
  }

  // 兑换记录由 /activity/info 的 data.records 渲染，不在前端本地造记录

  /**
   * 绑定事件
   */
  bindCountryCodeEvents() {
    if (this.$.countryCodeBtn) {
      this._addDomListener(this.$.countryCodeBtn, "click", (e) => {
        e.stopPropagation();
        this.toggleCountryCodeDropdown();
      });
    }

    if (this.$.countryCodeDropdown) {
      this._addDomListener(this.$.countryCodeDropdown, "click", (e) => {
        const item = e.target.closest("[data-country-iso]");
        if (!item) return;
        e.stopPropagation();
        this.selectCountry(item.getAttribute("data-country-iso"));
      });
    }

    this._addDomListener(document, "click", () => this.closeCountryCodeDropdown());
    this._addDomListener(document, "keydown", (e) => {
      if (e.key === "Escape") this.closeCountryCodeDropdown();
    });
  }

  bindEvents() {
    this.bindCountryCodeEvents();
    this.bindHistoryEvents();

    // Redeem confirmation modal is disabled by design (direct redeem).

    // 手机号输入
    if (this.$.inputMobile) {
      this._onMobileInput = (e) => {
        this.state.mobile = String(e.target.value || "").replace(/\D/g, "").trim();
        this.maybeLoadChargesForMobile(this.state.mobile);
        this.updateRedeemState();
      };
      this._addDomListener(this.$.inputMobile, "input", this._onMobileInput);
    }

    // 运营商：展示全部，选中后只更新当前运营商的面额列表（不再随面额切换运营商）
    if (this.$.operatorGrid) {
      this._onOperatorGridClick = (e) => {
        const btn = e.target.closest(".redeem-operator-btn");
        if (!btn) return;
        const code = btn.getAttribute("data-provider-code");
        if (!code) return;
        this.selectProvider(code);
      };
      this._addDomListener(this.$.operatorGrid, "click", this._onOperatorGridClick);
    }

    // 面额选择
    if (this.$.amountGrid) {
      this._onAmountGridClick = (e) => {
        const btn = e.target.closest(".redeem-amount-btn");
        if (!btn) return;
        const amount = Number(btn.getAttribute("data-amount"));
        const spendCoin = Number(btn.getAttribute("data-spend-coin"));
        const chargesId = btn.getAttribute("data-charges-id");
        this.state.amount = amount;
        this.state.selectedCharge =
          this.chargesOptions && chargesId
            ? this.chargesOptions.find((o) => o.charges_id === chargesId) || null
            : null;
        if (!this.state.selectedCharge && spendCoin) {
          this.state.selectedCharge = {
            charges_id: chargesId,
            amount,
            spend_coin: spendCoin,
            amount_text: `${amount}`,
            provider_name: this.state.operator || "-",
            provider_code: this.selectedProviderCode || "",
            send_value: "",
          };
        }

        this.$.amountGrid
          .querySelectorAll(".redeem-amount-btn")
          .forEach((el) => el.classList.remove("redeem-amount-btn--active"));
        btn.classList.add("redeem-amount-btn--active");

        this.updateRedeemState();
      };
      this._addDomListener(this.$.amountGrid, "click", this._onAmountGridClick);
    }

    // 立即兑换按钮
    if (this.$.btnRedeem) {
      this._onRedeemClick = () => {
        this.performExchange();
      };
      this._addDomListener(this.$.btnRedeem, "click", this._onRedeemClick);
    }
  }

}

Object.assign(GoldCoinsExchange.prototype, redeemHistoryMethods);
