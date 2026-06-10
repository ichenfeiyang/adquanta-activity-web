import { getChargeRecords } from "./activity-api.js";
import {
  getChargeRecordsCache,
  invalidateChargeRecordsCache,
  loadChargeRecordsWithSWR,
} from "./activity-page-cache.js";
import { goToTopupStatus } from "./activity-navigation.js";
import { assetUrl } from "./asset-url.js";
import { escapeHtml } from "./escape-html.js";
import * as logger from "./activity-logger.js";

export const redeemHistoryMethods = {
  normalizeRecordsPayload(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.records)) return data.records;
    if (data && Array.isArray(data.list)) return data.list;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  },

  applyChargeRecordsPayload(data) {
    this.records = this.normalizeRecordsPayload(data);
    this.renderRecords(this.records, this.showAllRecords);
  },

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
  },

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
  },

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
  },

  openTopupStatusPage(payload = {}) {
    const router = this.config.router;
    if (!router) return;
    goToTopupStatus(router, {
      ...payload,
      activity_id: this.config.apiOptions?.activityId || "",
    });
  },

  initHistory() {
    if (!this.$.historyList) return;
    this.$.historyList.innerHTML = "";
  },


  bindHistoryEvents() {
    if (this.$.viewAllRecordsBtn) {
      this._onViewAllRecordsClick = () => {
        this.showAllRecords = !this.showAllRecords;
        this.renderRecords(this.records, this.showAllRecords);
      };
      this._addDomListener(this.$.viewAllRecordsBtn, "click", this._onViewAllRecordsClick);
    }

    if (this.$.historyList) {
      this._onHistoryListClick = (e) => {
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
      };
      this._addDomListener(this.$.historyList, "click", this._onHistoryListClick);
    }
  },
};
