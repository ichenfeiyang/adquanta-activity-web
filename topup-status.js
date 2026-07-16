import { getChargeStatus, getActivityInfo } from "/activity-api.js";

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  const containsCJK = /[\u4e00-\u9fff]/.test(String(message || ""));
  toast.textContent = containsCJK ? "Something went wrong. Please try again." : String(message ?? "");
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 2000);
}

function normalizePhone(phoneRaw = "") {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (!digits) return "-";
  if (digits.startsWith("91") && digits.length > 10) {
    return `+91 ${digits.slice(2)}`;
  }
  return `+${digits}`;
}

function normalizeStatus(statusRaw = "pending") {
  const s = String(statusRaw || "").toLowerCase();
  // Some backends use numeric codes in query / API response.
  // 0=pending, 1=success, 2=failed
  if (s === "1") return "success";
  if (s === "2" || s === "-1") return "failed";
  if (s === "0") return "pending";
  if (s === "success") return "success";
  // Backend may return: failed / fail / error / rejected / cancelled, etc.
  if (s === "failed" || s === "fail" || s === "error" || s === "rejected" || s === "canceled" || s === "cancelled")
    return "failed";
  if (s === "pending") return "pending";
  return "pending";
}

function statusView(status) {
  if (status === "success") {
    return {
      title: "Recharge Successful!",
      desc: "Your request has been processed.",
      icon: "✓",
    };
  }
  if (status === "failed") {
    return {
      title: "Recharge Failed",
      desc: "The recharge did not complete. Please try again later.",
      icon: "✕",
    };
  }
  return {
    title: "Processing Recharge",
    desc: "We are processing your top-up. This may take a few minutes.",
    icon: "↻",
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MARTECH_MNG_BASE_URL = "https://service.aiwriter.today/martechmng";
const AI_RECORDS_APP_ID = "com.adquanta.auraro";
const MODEL_TYPE_CONTACT_US = "ModelTypeContactUs";

function getSystemTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (_) {
    return "UTC";
  }
}

async function createContactUsRecord({ token, userId, name, email, message }) {
  const contentData = { name: name || "", email: email || "", message: message || "" };
  const contentJson = JSON.stringify(contentData);

  const tokenMasked = token ? `${String(token).slice(0, 6)}...${String(token).slice(-4)}` : "";
  console.log(
    "[topup-status] Help submit -> createModel",
    JSON.stringify(
      {
        url: `${MARTECH_MNG_BASE_URL}/api/v1/ai_records`,
        hasToken: !!token,
        tokenMasked,
        userId,
        nameLen: String(name || "").length,
        emailLen: String(email || "").length,
        messageLen: String(message || "").length,
        timezone: getSystemTimezone(),
      },
      null,
      2
    )
  );

  const form = new URLSearchParams();
  form.set("app_id", AI_RECORDS_APP_ID);
  form.set("user_id", userId);
  form.set("type", MODEL_TYPE_CONTACT_US);
  form.set("timezone", getSystemTimezone());
  form.set("content", contentJson);

  const res = await fetch(`${MARTECH_MNG_BASE_URL}/api/v1/ai_records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form.toString(),
  });

  console.log(
    "[topup-status] Help submit -> HTTP response",
    JSON.stringify({ status: res.status, ok: res.ok }, null, 2)
  );
  let json = null;
  try {
    json = await res.json();
    console.log(
      "[topup-status] Help submit -> response json",
      JSON.stringify(json, null, 2)
    );
  } catch (_) {}

  return json;
}

async function main() {
  const qp = new URLSearchParams(window.location.search);
  const businessId = qp.get("business_id") || qp.get("distributor_ref") || "";
  const distributorRef = businessId;
  const status = qp.get("status") || "pending";
  const amountLabel = qp.get("amount_label") || qp.get("send_value") || "-";
  const phoneNumber = qp.get("phone_number") || "";
  const operator = qp.get("operator") || "-";
  const token = qp.get("token") || qp.get("access_token") || "";
  const baseUrl = qp.get("base_url") || "";
  const activityId = qp.get("activity_id") || "";

  const titleEl = document.getElementById("tsStatusTitle");
  const descEl = document.getElementById("tsStatusDesc");
  const iconEl = document.getElementById("tsStatusIcon");
  const rootEl = document.querySelector(".ts-root");
  const txEl = document.getElementById("tsTransactionId");
  const amountEl = document.getElementById("tsAmount");
  const phoneEl = document.getElementById("tsPhone");
  const operatorEl = document.getElementById("tsOperator");
  const helpBtn = document.getElementById("tsHelpBtn");
  const backBtn = document.getElementById("tsBackBtn");
  const returnBtn = document.getElementById("tsReturnBtn");
  const primaryActionIcon = document.getElementById("tsPrimaryActionIcon");
  const primaryActionLabel = document.getElementById("tsPrimaryActionLabel");
  const secondaryActionLabel = document.getElementById("tsSecondaryActionLabel");
  const helpModal = document.getElementById("tsHelpModal");
  const helpCloseBtn = document.getElementById("tsHelpCloseBtn");
  const helpCancelBtn = document.getElementById("tsHelpCancelBtn");
  const helpSubmitBtn = document.getElementById("tsHelpSubmitBtn");
  const helpNameInput = document.getElementById("tsHelpName");
  const helpEmailInput = document.getElementById("tsHelpEmail");
  const helpMessageInput = document.getElementById("tsHelpMessage");
  const helpMessageCount = document.getElementById("tsHelpMessageCount");

  const openHelpModal = () => {
    if (!helpModal) return;
    // Reset basic fields.
    if (helpNameInput) helpNameInput.value = "";
    if (helpEmailInput) helpEmailInput.value = "";
    if (helpMessageInput) helpMessageInput.value = "";
    if (helpMessageCount) helpMessageCount.textContent = "0";
    helpModal.classList.add("is-open");
  };

  const closeHelpModal = () => {
    if (!helpModal) return;
    helpModal.classList.remove("is-open");
  };

  const updateMessageCount = () => {
    if (!helpMessageInput) return;
    const len = String(helpMessageInput.value || "").length;
    if (helpMessageCount) helpMessageCount.textContent = String(len);
  };

  const renderPendingState = () => {
    const ui = statusView("pending");
    if (rootEl) rootEl.setAttribute("data-status", "pending");
    if (titleEl) titleEl.textContent = ui.title;
    if (descEl) descEl.textContent = ui.desc;
    if (iconEl) iconEl.textContent = ui.icon;
    if (primaryActionIcon) primaryActionIcon.hidden = true;
    if (primaryActionLabel) primaryActionLabel.textContent = "Need Help?";
    if (secondaryActionLabel) secondaryActionLabel.textContent = "Return to Tasks";
    if (helpBtn) helpBtn.onclick = () => openHelpModal();
    if (returnBtn) {
      returnBtn.hidden = false;
      returnBtn.onclick = () => goBack();
    }
  };

  const renderSuccessState = () => {
    const ui = statusView("success");
    if (rootEl) rootEl.setAttribute("data-status", "success");
    if (titleEl) titleEl.textContent = ui.title;
    if (descEl) descEl.textContent = ui.desc;
    if (iconEl) iconEl.textContent = ui.icon;
    if (primaryActionIcon) primaryActionIcon.hidden = false;
    if (primaryActionLabel) primaryActionLabel.textContent = "Back to Tasks";
    if (helpBtn) helpBtn.onclick = () => goBack();
    if (returnBtn) {
      returnBtn.hidden = true;
      returnBtn.onclick = null;
    }
  };

  const renderFailedState = () => {
    const ui = statusView("failed");
    if (rootEl) rootEl.setAttribute("data-status", "failed");
    if (titleEl) titleEl.textContent = ui.title;
    if (descEl) descEl.textContent = ui.desc;
    if (iconEl) iconEl.textContent = ui.icon;
    if (primaryActionIcon) primaryActionIcon.hidden = false;
    if (primaryActionLabel) primaryActionLabel.textContent = "Back to Tasks";
    if (helpBtn) helpBtn.onclick = () => goBack();
    if (returnBtn) {
      returnBtn.hidden = true;
      returnBtn.onclick = null;
    }
  };

  const renderByStatus = (s) => {
    const normalized = normalizeStatus(s);
    if (normalized === "success") {
      renderSuccessState();
      return;
    }
    if (normalized === "failed") {
      renderFailedState();
      return;
    }
    renderPendingState();
  };

  const mainEl = document.querySelector(".ts-main");
  const statusFromQuery = normalizeStatus(status);
  // Prevent the initial pending UI "flash" before the first status API returns.
  if (mainEl) {
    mainEl.style.transition = "opacity 200ms ease";
    mainEl.style.opacity = "0";
    mainEl.style.pointerEvents = "none";
  }
  if (txEl) txEl.textContent = distributorRef ? `#${distributorRef}` : "-";
  if (amountEl) amountEl.textContent = amountLabel;
  if (phoneEl) phoneEl.textContent = normalizePhone(phoneNumber);
  if (operatorEl) {
    const op = String(operator || "").trim();
    if (!op || op === "-") {
      operatorEl.textContent = "-";
    } else {
      const initial = op.charAt(0).toUpperCase();
      operatorEl.innerHTML = `<span class="ts-operator-badge">${initial}</span> ${op}`;
    }
  }

  const goBack = () => {
    const p = new URLSearchParams();
    if (token) p.set("token", token);
    if (activityId) p.set("activity_id", activityId);
    // "Back to Tasks" should return to the activity center page (not the redeem page).
    window.location.href = `/index.html?${p.toString()}`;
  };

  // Left-top back arrow should behave like a normal back navigation (previous page).
  const backToPrevPage = () => {
    try {
      if (window.history && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch (_) {}
    // Fallback if history is not available (or length too short).
    goBack();
  };

  if (backBtn) backBtn.addEventListener("click", backToPrevPage);

  if (helpCloseBtn) helpCloseBtn.addEventListener("click", () => closeHelpModal());
  if (helpCancelBtn) helpCancelBtn.addEventListener("click", () => closeHelpModal());
  if (helpSubmitBtn) {
    let submitting = false;
    helpSubmitBtn.addEventListener("click", async () => {
      if (submitting) return;
      const msg = String(helpMessageInput?.value || "").trim();
      if (!msg) {
        showToast("Please input your message.");
        return;
      }

      if (helpSubmitBtn) {
        submitting = true;
        helpSubmitBtn.disabled = true;
        const originalText = helpSubmitBtn.textContent;
        helpSubmitBtn.textContent = "Submitting...";

        try {
          if (!token) {
            showToast("Authorization is missing.");
            return;
          }

          // Fetch user_id for /ai_records createModel.
          const infoRes = await getActivityInfo({ baseUrl, token });
          const userId = infoRes?.data?.user_info?.user_id;
          if (!userId) {
            showToast("Failed to get user id.");
            return;
          }

          const name = String(helpNameInput?.value || "").trim();
          const email = String(helpEmailInput?.value || "").trim();

          const payload = {
            token,
            userId: String(userId),
            name,
            email,
            message: msg,
          };

          const apiJson = await createContactUsRecord(payload);

          const ok =
            apiJson?.success === true ||
            apiJson?.code === 200 ||
            apiJson?.data != null;

          if (ok) {
            // Success: clear message and close.
            if (helpMessageInput) helpMessageInput.value = "";
            if (helpMessageCount) helpMessageCount.textContent = "0";
            closeHelpModal();
            showToast("Submitted! We will contact you soon.");
          } else {
            showToast(apiJson?.message || "Submit failed.");
          }
        } catch (e) {
          showToast(String(e?.message || e || "Submit failed."));
        } finally {
          submitting = false;
          if (helpSubmitBtn) {
            helpSubmitBtn.disabled = false;
            helpSubmitBtn.textContent = originalText || "Submit";
          }
        }
      }
    });
  }

  if (helpModal) {
    helpModal.addEventListener("click", (e) => {
      if (e.target === helpModal) closeHelpModal();
    });
  }

  if (helpMessageInput) {
    helpMessageInput.addEventListener("input", () => updateMessageCount());
  }

  const showMain = () => {
    if (!mainEl) return;
    mainEl.style.opacity = "1";
    mainEl.style.pointerEvents = "auto";
  };

  // If the status is already terminal from the list page (success/failed),
  // do not call status API again to avoid noisy error toasts.
  if (statusFromQuery === "success" || statusFromQuery === "failed") {
    renderByStatus(statusFromQuery);
    showMain();
    return;
  }

  if (!distributorRef) {
    // No business identifier -> fall back to whatever the URL indicates.
    renderByStatus(statusFromQuery);
    showMain();
    return;
  }

  const apiOptions = { baseUrl, token };

  // 1) First request: decide status then render UI.
  let res;
  try {
    res = await getChargeStatus(apiOptions, distributorRef);
  } catch (_) {
    showToast("Failed to query order status");
    renderByStatus(statusFromQuery);
    showMain();
    return;
  }

  if (res?.code !== 200 || res?.data?.success !== true) {
    showToast(res?.data?.message || res?.message || "Status query failed");
    renderByStatus(statusFromQuery);
    showMain();
    return;
  }

  let currentStatus = normalizeStatus(res?.data?.status || "");
  renderByStatus(currentStatus);
  showMain();

  if (currentStatus === "success") {
    return;
  }
  if (currentStatus === "failed") {
    return;
  }

  // 2) Pending: keep polling until it becomes success/failed.
  let lastRenderedStatus = currentStatus;
  while (currentStatus === "pending") {
    await sleep(4000);
    try {
      res = await getChargeStatus(apiOptions, distributorRef);
    } catch (_) {
      showToast("Failed to query order status");
      break;
    }

    if (res?.code !== 200 || res?.data?.success !== true) {
      showToast(res?.data?.message || res?.message || "Status query failed");
      break;
    }

    const nextStatus = normalizeStatus(res?.data?.status || "");
    if (nextStatus !== lastRenderedStatus) {
      renderByStatus(nextStatus);
      lastRenderedStatus = nextStatus;
    }

    currentStatus = nextStatus;
    if (currentStatus === "success") {
      break;
    }
    if (currentStatus === "failed") {
      break;
    }
  }
}

main().catch(() => {});
