import { getActivityInfo, getChargeRecords, getCharges, postChargeRedeem } from "./activity-api.js";
import {
  getActivityInfoCache,
  getChargeRecordsCache,
  invalidateActivityInfoCache,
  invalidateChargeRecordsCache,
  loadActivityInfoWithSWR,
  loadChargeRecordsWithSWR,
  loadChargesWithSWR,
  patchActivityInfoWalletCoin,
  setActivityInfoCache,
} from "./activity-page-cache.js";
import * as logger from "./activity-logger.js";
import { appUrl, assetUrl } from "./asset-url.js";
import { escapeHtml } from "./escape-html.js";

// Full country calling code list (name + dial code)
// Data source: common public ISO calling code datasets (embedded for offline use)
const COUNTRY_CALLING_CODES = [
  { name: "Afghanistan", dial: "+93" },
  { name: "Albania", dial: "+355" },
  { name: "Algeria", dial: "+213" },
  { name: "American Samoa", dial: "+1-684" },
  { name: "Andorra", dial: "+376" },
  { name: "Angola", dial: "+244" },
  { name: "Anguilla", dial: "+1-264" },
  { name: "Antarctica", dial: "+672" },
  { name: "Antigua and Barbuda", dial: "+1-268" },
  { name: "Argentina", dial: "+54" },
  { name: "Armenia", dial: "+374" },
  { name: "Aruba", dial: "+297" },
  { name: "Australia", dial: "+61" },
  { name: "Austria", dial: "+43" },
  { name: "Azerbaijan", dial: "+994" },
  { name: "Bahamas", dial: "+1-242" },
  { name: "Bahrain", dial: "+973" },
  { name: "Bangladesh", dial: "+880" },
  { name: "Barbados", dial: "+1-246" },
  { name: "Belarus", dial: "+375" },
  { name: "Belgium", dial: "+32" },
  { name: "Belize", dial: "+501" },
  { name: "Benin", dial: "+229" },
  { name: "Bermuda", dial: "+1-441" },
  { name: "Bhutan", dial: "+975" },
  { name: "Bolivia", dial: "+591" },
  { name: "Bosnia and Herzegovina", dial: "+387" },
  { name: "Botswana", dial: "+267" },
  { name: "Brazil", dial: "+55" },
  { name: "British Indian Ocean Territory", dial: "+246" },
  { name: "British Virgin Islands", dial: "+1-284" },
  { name: "Brunei", dial: "+673" },
  { name: "Bulgaria", dial: "+359" },
  { name: "Burkina Faso", dial: "+226" },
  { name: "Burundi", dial: "+257" },
  { name: "Cambodia", dial: "+855" },
  { name: "Cameroon", dial: "+237" },
  { name: "Canada", dial: "+1" },
  { name: "Cape Verde", dial: "+238" },
  { name: "Cayman Islands", dial: "+1-345" },
  { name: "Central African Republic", dial: "+236" },
  { name: "Chad", dial: "+235" },
  { name: "Chile", dial: "+56" },
  { name: "China", dial: "+86" },
  { name: "Christmas Island", dial: "+61" },
  { name: "Cocos (Keeling) Islands", dial: "+61" },
  { name: "Colombia", dial: "+57" },
  { name: "Comoros", dial: "+269" },
  { name: "Congo (DRC)", dial: "+243" },
  { name: "Congo (Republic)", dial: "+242" },
  { name: "Cook Islands", dial: "+682" },
  { name: "Costa Rica", dial: "+506" },
  { name: "Cote d’Ivoire", dial: "+225" },
  { name: "Croatia", dial: "+385" },
  { name: "Cuba", dial: "+53" },
  { name: "Curacao", dial: "+599" },
  { name: "Cyprus", dial: "+357" },
  { name: "Czechia", dial: "+420" },
  { name: "Denmark", dial: "+45" },
  { name: "Djibouti", dial: "+253" },
  { name: "Dominica", dial: "+1-767" },
  { name: "Dominican Republic", dial: "+1-809" },
  { name: "Dominican Republic", dial: "+1-829" },
  { name: "Dominican Republic", dial: "+1-849" },
  { name: "Ecuador", dial: "+593" },
  { name: "Egypt", dial: "+20" },
  { name: "El Salvador", dial: "+503" },
  { name: "Equatorial Guinea", dial: "+240" },
  { name: "Eritrea", dial: "+291" },
  { name: "Estonia", dial: "+372" },
  { name: "Eswatini", dial: "+268" },
  { name: "Ethiopia", dial: "+251" },
  { name: "Falkland Islands", dial: "+500" },
  { name: "Faroe Islands", dial: "+298" },
  { name: "Fiji", dial: "+679" },
  { name: "Finland", dial: "+358" },
  { name: "France", dial: "+33" },
  { name: "French Guiana", dial: "+594" },
  { name: "French Polynesia", dial: "+689" },
  { name: "Gabon", dial: "+241" },
  { name: "Gambia", dial: "+220" },
  { name: "Georgia", dial: "+995" },
  { name: "Germany", dial: "+49" },
  { name: "Ghana", dial: "+233" },
  { name: "Gibraltar", dial: "+350" },
  { name: "Greece", dial: "+30" },
  { name: "Greenland", dial: "+299" },
  { name: "Grenada", dial: "+1-473" },
  { name: "Guadeloupe", dial: "+590" },
  { name: "Guam", dial: "+1-671" },
  { name: "Guatemala", dial: "+502" },
  { name: "Guernsey", dial: "+44-1481" },
  { name: "Guinea", dial: "+224" },
  { name: "Guinea-Bissau", dial: "+245" },
  { name: "Guyana", dial: "+592" },
  { name: "Haiti", dial: "+509" },
  { name: "Honduras", dial: "+504" },
  { name: "Hong Kong", dial: "+852" },
  { name: "Hungary", dial: "+36" },
  { name: "Iceland", dial: "+354" },
  { name: "India", dial: "+91" },
  { name: "Indonesia", dial: "+62" },
  { name: "Iran", dial: "+98" },
  { name: "Iraq", dial: "+964" },
  { name: "Ireland", dial: "+353" },
  { name: "Isle of Man", dial: "+44-1624" },
  { name: "Israel", dial: "+972" },
  { name: "Italy", dial: "+39" },
  { name: "Jamaica", dial: "+1-876" },
  { name: "Japan", dial: "+81" },
  { name: "Jersey", dial: "+44-1534" },
  { name: "Jordan", dial: "+962" },
  { name: "Kazakhstan", dial: "+7" },
  { name: "Kenya", dial: "+254" },
  { name: "Kiribati", dial: "+686" },
  { name: "Kosovo", dial: "+383" },
  { name: "Kuwait", dial: "+965" },
  { name: "Kyrgyzstan", dial: "+996" },
  { name: "Laos", dial: "+856" },
  { name: "Latvia", dial: "+371" },
  { name: "Lebanon", dial: "+961" },
  { name: "Lesotho", dial: "+266" },
  { name: "Liberia", dial: "+231" },
  { name: "Libya", dial: "+218" },
  { name: "Liechtenstein", dial: "+423" },
  { name: "Lithuania", dial: "+370" },
  { name: "Luxembourg", dial: "+352" },
  { name: "Macau", dial: "+853" },
  { name: "Madagascar", dial: "+261" },
  { name: "Malawi", dial: "+265" },
  { name: "Malaysia", dial: "+60" },
  { name: "Maldives", dial: "+960" },
  { name: "Mali", dial: "+223" },
  { name: "Malta", dial: "+356" },
  { name: "Marshall Islands", dial: "+692" },
  { name: "Martinique", dial: "+596" },
  { name: "Mauritania", dial: "+222" },
  { name: "Mauritius", dial: "+230" },
  { name: "Mayotte", dial: "+262" },
  { name: "Mexico", dial: "+52" },
  { name: "Micronesia", dial: "+691" },
  { name: "Moldova", dial: "+373" },
  { name: "Monaco", dial: "+377" },
  { name: "Mongolia", dial: "+976" },
  { name: "Montenegro", dial: "+382" },
  { name: "Montserrat", dial: "+1-664" },
  { name: "Morocco", dial: "+212" },
  { name: "Mozambique", dial: "+258" },
  { name: "Myanmar", dial: "+95" },
  { name: "Namibia", dial: "+264" },
  { name: "Nauru", dial: "+674" },
  { name: "Nepal", dial: "+977" },
  { name: "Netherlands", dial: "+31" },
  { name: "New Caledonia", dial: "+687" },
  { name: "New Zealand", dial: "+64" },
  { name: "Nicaragua", dial: "+505" },
  { name: "Niger", dial: "+227" },
  { name: "Nigeria", dial: "+234" },
  { name: "Niue", dial: "+683" },
  { name: "North Korea", dial: "+850" },
  { name: "North Macedonia", dial: "+389" },
  { name: "Northern Mariana Islands", dial: "+1-670" },
  { name: "Norway", dial: "+47" },
  { name: "Oman", dial: "+968" },
  { name: "Pakistan", dial: "+92" },
  { name: "Palau", dial: "+680" },
  { name: "Palestine", dial: "+970" },
  { name: "Panama", dial: "+507" },
  { name: "Papua New Guinea", dial: "+675" },
  { name: "Paraguay", dial: "+595" },
  { name: "Peru", dial: "+51" },
  { name: "Philippines", dial: "+63" },
  { name: "Poland", dial: "+48" },
  { name: "Portugal", dial: "+351" },
  { name: "Puerto Rico", dial: "+1-787" },
  { name: "Puerto Rico", dial: "+1-939" },
  { name: "Qatar", dial: "+974" },
  { name: "Reunion", dial: "+262" },
  { name: "Romania", dial: "+40" },
  { name: "Russia", dial: "+7" },
  { name: "Rwanda", dial: "+250" },
  { name: "Saint Barthelemy", dial: "+590" },
  { name: "Saint Helena", dial: "+290" },
  { name: "Saint Kitts and Nevis", dial: "+1-869" },
  { name: "Saint Lucia", dial: "+1-758" },
  { name: "Saint Martin", dial: "+590" },
  { name: "Saint Pierre and Miquelon", dial: "+508" },
  { name: "Saint Vincent and the Grenadines", dial: "+1-784" },
  { name: "Samoa", dial: "+685" },
  { name: "San Marino", dial: "+378" },
  { name: "Sao Tome and Principe", dial: "+239" },
  { name: "Saudi Arabia", dial: "+966" },
  { name: "Senegal", dial: "+221" },
  { name: "Serbia", dial: "+381" },
  { name: "Seychelles", dial: "+248" },
  { name: "Sierra Leone", dial: "+232" },
  { name: "Singapore", dial: "+65" },
  { name: "Sint Maarten", dial: "+1-721" },
  { name: "Slovakia", dial: "+421" },
  { name: "Slovenia", dial: "+386" },
  { name: "Solomon Islands", dial: "+677" },
  { name: "Somalia", dial: "+252" },
  { name: "South Africa", dial: "+27" },
  { name: "South Korea", dial: "+82" },
  { name: "South Sudan", dial: "+211" },
  { name: "Spain", dial: "+34" },
  { name: "Sri Lanka", dial: "+94" },
  { name: "Sudan", dial: "+249" },
  { name: "Suriname", dial: "+597" },
  { name: "Sweden", dial: "+46" },
  { name: "Switzerland", dial: "+41" },
  { name: "Syria", dial: "+963" },
  { name: "Taiwan", dial: "+886" },
  { name: "Tajikistan", dial: "+992" },
  { name: "Tanzania", dial: "+255" },
  { name: "Thailand", dial: "+66" },
  { name: "Timor-Leste", dial: "+670" },
  { name: "Togo", dial: "+228" },
  { name: "Tokelau", dial: "+690" },
  { name: "Tonga", dial: "+676" },
  { name: "Trinidad and Tobago", dial: "+1-868" },
  { name: "Tunisia", dial: "+216" },
  { name: "Turkey", dial: "+90" },
  { name: "Turkmenistan", dial: "+993" },
  { name: "Turks and Caicos Islands", dial: "+1-649" },
  { name: "Tuvalu", dial: "+688" },
  { name: "U.S. Virgin Islands", dial: "+1-340" },
  { name: "Uganda", dial: "+256" },
  { name: "Ukraine", dial: "+380" },
  { name: "United Arab Emirates", dial: "+971" },
  { name: "United Kingdom", dial: "+44" },
  { name: "United States", dial: "+1" },
  { name: "Uruguay", dial: "+598" },
  { name: "Uzbekistan", dial: "+998" },
  { name: "Vanuatu", dial: "+678" },
  { name: "Vatican City", dial: "+379" },
  { name: "Venezuela", dial: "+58" },
  { name: "Vietnam", dial: "+84" },
  { name: "Wallis and Futuna", dial: "+681" },
  { name: "Yemen", dial: "+967" },
  { name: "Zambia", dial: "+260" },
  { name: "Zimbabwe", dial: "+263" },
];

const COUNTRY_TO_DIAL = {
  CN: "+86",
  IN: "+91",
  US: "+1",
  GB: "+44",
  HK: "+852",
  MO: "+853",
  TW: "+886",
};

function normalizeOperatorLabel(operator, country) {
  const op = String(operator || "").trim();
  if (!op) return "-";
  // Common CN operators returned in Chinese
  if (country === "CN") {
    if (op.includes("移动")) return "China Mobile";
    if (op.includes("联通")) return "China Unicom";
    if (op.includes("电信")) return "China Telecom";
  }
  return op;
}

/**
 * 金币兑换页面
 */
export class GoldCoinsExchange {
  constructor(config = {}) {
    this.config = {
      onExchangeSuccess: config.onExchangeSuccess || (() => {}),
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
      // Fixed default country code (India)
      countryCode: "+91",
      // Backend country enum
      countryCodeEnum: "IN",
      countryCodeUserSelected: true,
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

    // DOM 引用
    this.$ = {
      userGoldCoins: document.getElementById("userGoldCoins"),
      inputMobile: document.getElementById("inputMobile"),
      countryCodeBtn: document.getElementById("countryCodeBtn"),
      countryCodeModal: document.getElementById("countryCodeModal"),
      countryCodeCloseBtn: document.getElementById("countryCodeCloseBtn"),
      countryCodeSearch: document.getElementById("countryCodeSearch"),
      countryCodeList: document.getElementById("countryCodeList"),
      operatorGrid: document.getElementById("operatorGrid"),
      operatorGrid: document.getElementById("operatorGrid"),
      operatorSection: document.getElementById("operatorSection"),
      amountSection: document.getElementById("amountSection"),
      amountGrid: document.getElementById("amountGrid"),
      btnRedeem: document.getElementById("btnRedeem"),
      redeemSummary: document.getElementById("redeemSummary"),
      historyList: document.getElementById("historyList"),
      viewAllRecordsBtn: document.getElementById("viewAllRecords"),
      historySection: document.querySelector(".redeem-history-section"),
    };
  }

  /**
   * 初始化页面
   */
  async init() {
    if (this.$.countryCodeBtn) this.$.countryCodeBtn.textContent = this.state.countryCode;
    this.hydrateFromCache();
    this.initHistory();
    this.bindEvents();
    await Promise.all([this.loadActivityInfo(), this.loadRecords()]);
    this.setChargesUIVisible(false);
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

  resetRedeemPageToInitialState() {
    this.state.mobile = "";
    this.state.operator = "-";
    this.state.operatorSelected = false;
    this.state.amount = null;
    this.state.selectedCharge = null;
    if (this.$.inputMobile) this.$.inputMobile.value = "";
    if (this.$.operatorGrid) this.$.operatorGrid.innerHTML = "";
    if (this.$.amountGrid) this.$.amountGrid.innerHTML = "";
    this.resetChargesUI();
    if (this.$.redeemSummary) {
      this.$.redeemSummary.textContent = "Select amount to see coins required";
    }
    if (this.$.btnRedeem) {
      this.$.btnRedeem.disabled = true;
      this.$.btnRedeem.classList.add("redeem-primary-btn--disabled");
      this.$.btnRedeem.textContent = this.$.btnRedeem.dataset.originalText || "Redeem Now";
    }
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
      if (this.chargesLoading) return;
      if (this.lastChargesMobile === m && this.chargesLoaded) return;
      this.lastChargesMobile = m;
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
  normalizeRecordsPayload(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.records)) return data.records;
    if (data && Array.isArray(data.list)) return data.list;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  /**
   * 是否属于兑换/话费类记录（后端字段名可能不一致）
   */
  isRedeemHistoryRecord(r) {
    if (!r) return false;
    const ty = String(r.type || "").toLowerCase();
    const bt = String(r.business_type || "").toLowerCase();
    const redeemLike = ["redeem", "recharge", "top_up", "topup", "charges"];
    if (redeemLike.includes(bt)) return true;
    if (ty === "redeem") return true;
    if (ty === "spend") {
      if (!r.business_type) return true;
      return redeemLike.includes(bt);
    }
    return false;
  }

  applyChargeRecordsPayload(data) {
    this.records = this.normalizeRecordsPayload(data);
    this.renderRecords(this.records, this.showAllRecords);
  }

  /**
   * 加载兑换记录（/api/v1/ops/activity/charges/records）
   */
  async loadRecords(options = {}) {
    const { force = false } = options;
    const token = this.config.apiOptions?.token || "";

    try {
      const result = await loadChargeRecordsWithSWR(token, {
        force,
        fetcher: () => getChargeRecords(this.config.apiOptions, { limit: 200, offset: 0 }),
        onData: (data) => this.applyChargeRecordsPayload(data),
      });
      if (!result.ok) {
        if (!force) {
          await this.loadRecords({ force: true });
          return;
        }
        this.records = [];
        this.renderRecords(this.records, this.showAllRecords);
      }
    } catch (e) {
      logger.warn("[Redeem records] Request failed, using empty records", e?.message || e);
      this.records = [];
      this.renderRecords(this.records, false);
    }
  }

  /**
   * 格式化记录时间用于展示，如 "Mar 14, 2025 • 08:30"
   */
  formatRecordDate(isoStr) {
    if (!isoStr) return "";
    const date = new Date(isoStr);
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[m]} ${d}, ${y} • ${h}:${min}`;
  }

  /**
   * 用基础信息接口返回的 records 渲染兑换记录（仅兑换类型）
   * 默认只展示 2 条；点击「查看全部」后展示全部兑换数据，按钮变为「收起」
   * @param {Array} records - 接口 data.records
   * @param {boolean} [showAll=false] - true 时展示全部兑换记录，false 时只展示前 2 条
   */
  renderRecords(records, showAll = false) {
    if (!this.$.historyList) return;
    const redeemOnly = Array.isArray(records) ? records : [];
    const sorted = redeemOnly
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const list = showAll ? sorted : sorted.slice(0, 2);

    this.$.historyList.innerHTML = list
      .map((r) => {
        const coinNum = Math.abs(Number(r.coin_cost ?? r.coin ?? 0) || 0);
        const statusRaw = String(r.status || r.processing_state || "success").toLowerCase();
        const isProcessing = statusRaw === "processing" || statusRaw === "pending";
        let iconClass = "redeem-history-icon--success";
        let iconText = "✓";
        let statusLabel = "Success";
        if (isProcessing) {
          iconClass = "redeem-history-icon--processing";
          iconText = "⏳";
          statusLabel = "Processing";
        } else if (statusRaw === "fail" || statusRaw === "failed" || statusRaw === "error") {
          iconClass = "redeem-history-icon--fail";
          iconText = "✕";
          statusLabel = "Failed";
        }
        const sendValue = r.send_value ?? r.sendValue ?? "";
        // Try to build a human-readable amount label (value + currency/unit) if the record provides it.
        const amountText =
          r.amount_text ?? r.amountText ?? r.amount_label ?? r.amountLabel ?? r.send_value_text ?? r.sendValueText ?? "";
        const currency =
          r.receive_currency ??
          r.receiveCurrency ??
          r.currency ??
          r.amount_currency ??
          r.amountCurrency ??
          r.send_value_currency ??
          r.sendValueCurrency ??
          "";
        const amountLabel = amountText
          ? amountText
          : currency
            ? `${sendValue} ${currency}`.trim()
            : sendValue;
        const businessId = r.business_id ?? r.businessId ?? r.distributor_ref ?? r.distributorRef ?? "";
        const phoneNumber = r.phone_number ?? r.phone ?? "";
        const skuCode = r.sku_code ?? "";
        const operatorName =
          r.provider_name ??
          r.providerName ??
          r.operator_name ??
          r.operatorName ??
          r.operator ??
          r.carrier_name ??
          r.carrierName ??
          "";
        const phoneHtml = phoneNumber ? `<div class="redeem-history-phone">${escapeHtml(phoneNumber)}</div>` : "";
        return `
        <div class="redeem-history-item redeem-history-item--clickable"
             data-open-status="1"
             data-business-id="${escapeHtml(businessId)}"
             data-distributor-ref="${escapeHtml(r.distributor_ref || r.distributorRef || "")}"
             data-status="${escapeHtml(String(statusRaw || ""))}"
             data-amount-label="${escapeHtml(String(amountLabel ?? ""))}"
             data-send-value="${escapeHtml(String(sendValue ?? ""))}"
             data-phone-number="${escapeHtml(String(phoneNumber ?? ""))}"
             data-operator="${escapeHtml(String(operatorName ?? ""))}">
          <div class="redeem-history-icon ${iconClass}">${iconText}</div>
          <div class="redeem-history-main">
            <div class="redeem-history-title">${escapeHtml(skuCode ? `Top-up ${skuCode}` : "Redeem")}</div>
            ${phoneHtml}
            <div class="redeem-history-subtitle">
              ${escapeHtml(this.formatRecordDate(r.created_at))} • ${escapeHtml(statusLabel)}
            </div>
          </div>
          <div class="redeem-history-amount">
            -${coinNum}
            <div class="redeem-history-coins">
              <span class="redeem-history-coin-icon">
                <img src="${assetUrl("icons/gold_coin.svg")}" alt="coin" />
              </span>
              ${coinNum} Coins
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    if (this.$.viewAllRecordsBtn) {
      this.$.viewAllRecordsBtn.textContent = showAll ? "Collapse" : "View All";
      this.$.viewAllRecordsBtn.style.visibility = redeemOnly.length > 2 ? "visible" : "hidden";
    }
  }

  openTopupStatusPage(payload = {}) {
    const params = new URLSearchParams();
    const businessId = payload.business_id || payload.businessId || payload.distributor_ref || payload.distributorRef || "";
    const distributorRef = payload.distributor_ref || payload.distributorRef || businessId || "";
    params.set("business_id", String(businessId));
    params.set("distributor_ref", String(distributorRef));
    params.set("status", String(payload.status || "pending"));
    params.set("amount_label", String(payload.amount_label || ""));
    params.set("send_value", String(payload.send_value || ""));
    params.set("phone_number", String(payload.phone_number || ""));
    params.set("operator", String(payload.operator || ""));
    params.set("activity_id", String(this.config.apiOptions?.activityId || ""));
    window.location.href = appUrl("topup-status", params.toString());
  }

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
  initHistory() {
    if (!this.$.historyList) return;
    this.$.historyList.innerHTML = "";
  }

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
      this.$.redeemSummary.textContent = "Enter mobile number, then select operator and amount";
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
  bindEvents() {
    // Country code is fixed (+91). Picker disabled by design.
    // 查看全部 / 收起（仅兑换类型：默认 2 条，展开后全部）
    if (this.$.viewAllRecordsBtn) {
      this.$.viewAllRecordsBtn.addEventListener("click", () => {
        this.showAllRecords = !this.showAllRecords;
        this.renderRecords(this.records, this.showAllRecords);
      });
    }

    if (this.$.historyList) {
      this.$.historyList.addEventListener("click", (e) => {
        const row = e.target.closest(".redeem-history-item");
        if (!row) return;
        if (row.getAttribute("data-open-status") !== "1") return;
        const business_id = row.getAttribute("data-business-id") || "";
        if (!business_id) return;
        const distributor_ref = row.getAttribute("data-distributor-ref") || "";
        const statusRaw = row.getAttribute("data-status") || "";
        this.openTopupStatusPage({
          business_id,
          distributor_ref,
          status: statusRaw || "pending",
          amount_label: row.getAttribute("data-amount-label") || "",
          send_value: row.getAttribute("data-send-value") || "",
          phone_number: row.getAttribute("data-phone-number") || "",
          operator: row.getAttribute("data-operator") || "",
        });
      });
    }

    // Intentionally removed history-section click navigation.
    // Only each history cell (.redeem-history-item) will navigate to topup-status.

    // Redeem confirmation modal is disabled by design (direct redeem).

    // 手机号输入
    if (this.$.inputMobile) {
      this.$.inputMobile.addEventListener("input", (e) => {
        this.state.mobile = String(e.target.value || "").replace(/\D/g, "").trim();
        this.maybeLoadChargesForMobile(this.state.mobile);
        this.updateRedeemState();
      });
    }

    // 运营商：展示全部，选中后只更新当前运营商的面额列表（不再随面额切换运营商）
    if (this.$.operatorGrid) {
      this.$.operatorGrid.addEventListener("click", (e) => {
        const btn = e.target.closest(".redeem-operator-btn");
        if (!btn) return;
        const code = btn.getAttribute("data-provider-code");
        if (!code) return;
        this.selectProvider(code);
      });
    }

    // 面额选择
    if (this.$.amountGrid) {
      this.$.amountGrid.addEventListener("click", (e) => {
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
      });
    }

    // 立即兑换按钮
    if (this.$.btnRedeem) {
      this.$.btnRedeem.addEventListener("click", () => {
        this.performExchange();
      });
    }
  }

  renderCountryCodeList(query = "") {
    if (!this.$.countryCodeList) return;
    const q = String(query || "").trim().toLowerCase();
    const items = COUNTRY_CALLING_CODES.filter((c) => {
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.dial.toLowerCase().includes(q.replace(/\s+/g, ""));
    });
    this.$.countryCodeList.innerHTML = items
      .map((c) => {
        const isActive = c.dial === this.state.countryCode;
        return `
          <button type="button" class="redeem-countrycode-item ${isActive ? "redeem-countrycode-item--active" : ""}" data-dial="${escapeHtml(c.dial)}" style="width:100%;text-align:left;border:none;background:#fff;border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;border:1px solid ${isActive ? "rgba(236,91,19,0.35)" : "#e5e7eb"};margin-bottom:8px;">
            <span style="font-weight:700;color:#111827;">${escapeHtml(c.name)}</span>
            <span style="font-weight:800;color:${isActive ? "#ec5b13" : "#374151"};">${escapeHtml(c.dial)}</span>
          </button>
        `;
      })
      .join("");

    // bind click
    this.$.countryCodeList.querySelectorAll("[data-dial]").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          const dial = btn.getAttribute("data-dial") || "+86";
          this.state.countryCode = dial;
          this.state.countryCodeUserSelected = true;
          if (this.$.countryCodeBtn) this.$.countryCodeBtn.textContent = dial;
          if (this.$.countryCodeModal) this.$.countryCodeModal.style.display = "none";
          this.updateRedeemState();
        },
        { once: true }
      );
    });
  }
}
