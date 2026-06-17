import { getChargeRecords } from "./activity-api.js";
import {
  getChargeRecordsCache,
  loadChargeRecordsWithSWR,
} from "./activity-page-cache.js";
import { goToTopupStatus } from "./activity-navigation.js";
import { assetUrl } from "./asset-url.js";
import { escapeHtml } from "./escape-html.js";
import { formatPhoneDisplay } from "./redeem-country.js";
import {
  buildAmountLabel,
  getRecordBusinessId,
  getRecordOperator,
  getRecordPhone,
} from "./topup-status-preview.js";
import * as logger from "./activity-logger.js";

function getHistoryStatusPresentation(statusRaw) {
  const status = String(statusRaw || "success").toLowerCase();
  if (status === "processing" || status === "pending") {
    return {
      iconClass: "redeem-history-icon--processing",
      iconText: "⏳",
      statusLabel: "Processing",
    };
  }
  if (status === "fail" || status === "failed" || status === "error") {
    return {
      iconClass: "redeem-history-icon--fail",
      iconText: "✕",
      statusLabel: "Failed",
    };
  }
  return {
    iconClass: "redeem-history-icon--success",
    iconText: "✓",
    statusLabel: "Success",
  };
}

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

  buildTopupPayloadFromRecord(record) {
    if (!record) return null;

    const business_id = getRecordBusinessId(record);
    if (!business_id) return null;

    return {
      business_id,
      distributor_ref: record.distributor_ref ?? record.distributorRef ?? business_id,
      status: String(record.status || record.processing_state || "pending"),
      amount_label: buildAmountLabel(record),
      send_value: record.send_value ?? record.sendValue ?? "",
      phone_number: getRecordPhone(record),
      operator: getRecordOperator(record),
    };
  },

  findHistoryRecord(businessId, distributorRef = "") {
    const list = Array.isArray(this.records) ? this.records : [];
    return (
      list.find((record) => {
        const id = getRecordBusinessId(record);
        if (businessId && id === businessId) return true;
        const ref = record.distributor_ref ?? record.distributorRef ?? "";
        return distributorRef && ref === distributorRef;
      }) ?? null
    );
  },

  renderRecords(records, showAll = false) {
    if (!this.$.historyList) return;
    const redeemOnly = Array.isArray(records) ? records : [];
    const sorted = redeemOnly
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const list = showAll ? sorted : sorted.slice(0, 2);

    this.$.historyList.innerHTML = list
      .map((record) => {
        const coinNum = Math.abs(Number(record.coin_cost ?? record.coin ?? 0) || 0);
        const { iconClass, iconText, statusLabel } = getHistoryStatusPresentation(
          record.status || record.processing_state,
        );
        const businessId = getRecordBusinessId(record);
        const phoneNumber = getRecordPhone(record);
        const skuCode = record.sku_code ?? "";
        const phoneHtml = phoneNumber
          ? `<div class="redeem-history-phone">${escapeHtml(formatPhoneDisplay(phoneNumber))}</div>`
          : "";

        return `
        <div class="redeem-history-item redeem-history-item--clickable"
             data-open-status="1"
             data-business-id="${escapeHtml(businessId)}"
             data-distributor-ref="${escapeHtml(record.distributor_ref || record.distributorRef || "")}">
          <div class="redeem-history-icon ${iconClass}">${iconText}</div>
          <div class="redeem-history-main">
            <div class="redeem-history-title">${escapeHtml(skuCode ? `Top-up ${skuCode}` : "Redeem")}</div>
            ${phoneHtml}
            <div class="redeem-history-subtitle">
              ${escapeHtml(this.formatRecordDate(record.created_at))} • ${escapeHtml(statusLabel)}
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
      this._addDomListener(this.$.viewAllRecordsBtn, "click", () => {
        this.showAllRecords = !this.showAllRecords;
        this.renderRecords(this.records, this.showAllRecords);
      });
    }

    if (this.$.historyList) {
      this._addDomListener(this.$.historyList, "click", (e) => {
        const row = e.target.closest(".redeem-history-item");
        if (!row || row.getAttribute("data-open-status") !== "1") return;

        const businessId = row.getAttribute("data-business-id") || "";
        if (!businessId) return;

        const payload = this.buildTopupPayloadFromRecord(
          this.findHistoryRecord(businessId, row.getAttribute("data-distributor-ref") || ""),
        );
        if (payload) this.openTopupStatusPage(payload);
      });
    }
  },
};
