/**
 * ActivityBridgeHelper for Web 辅助库
 * 基于事件系统的统一接口设计
 * 版本：2.0.1
 *
 * 设计理念：
 * - 每个活动对应一个 activityId
 * - 一个 H5 页面
 * - 原生（iOS documentStart / Android JavascriptInterface）先注入同步桥接实现；
 * - 本文件再包装为 Promise；**必须先保存原生函数引用**，不可在包装函数内调用同名
 *   `window.ActivityBridgeHelper.initActivity`，否则会把自身递归压栈（iOS 上必现）。
 */
(function (window) {
    "use strict";

    function isH5DebugEnabled() {
        try {
            var host = location.hostname;
            if (host === "localhost" || host === "127.0.0.1") return true;
            return /(?:^|[?&])debug=1(?:&|$)/.test(location.search || "");
        } catch (_) {
            return false;
        }
    }

    function logBridgeError(message, err) {
        if (!isH5DebugEnabled()) return;
        console.error(message, err);
    }

    function detectPlatform() {
        if (window.Android) {
            return "android";
        }
        if (window.webkit && window.webkit.messageHandlers) {
            return "ios";
        }
        if (window.ios) {
            return "ios";
        }
        return "unknown";
    }

    var bridge = window.ActivityBridgeHelper || {};

    /** 原生在脚本执行前注入的同步方法（prompt / JNI）；勿与下方 Promise 封装混名调用 */
    var nativeInitActivity = typeof bridge.initActivity === "function" ? bridge.initActivity : null;
    var nativeTrackEvent = typeof bridge.trackEvent === "function" ? bridge.trackEvent : null;
    var nativeGetSession = typeof bridge.getSession === "function" ? bridge.getSession : null;
    var nativeTriggerEvent = typeof bridge.triggerEvent === "function" ? bridge.triggerEvent : null;

    window.ActivityBridgeHelper = bridge;

    if (!bridge.getPlatform) {
        bridge.getPlatform = function () {
            return detectPlatform();
        };
    }

    bridge.isAvailable = function () {
        return detectPlatform() !== "unknown";
    };

    if (!bridge.getVersion) {
        bridge.getVersion = function () {
            return "2.0.1";
        };
    }

    /**
     * 初始化活动会话（Promise 封装，内部调用原生同步实现）
     */
    bridge.initActivity = function (activityId, code, token, channelTag) {
        return new Promise(function (resolve, reject) {
            try {
                code = code || "";
                token = token || "";
                channelTag = channelTag || "";
                if (typeof nativeInitActivity !== "function") {
                    reject(new Error("Native initActivity not available"));
                    return;
                }
                var result = nativeInitActivity.call(bridge, activityId, code, token, channelTag);
                var session = typeof result === "string" ? JSON.parse(result) : result;
                resolve(session);
            } catch (e) {
                logBridgeError("[ActivityWeb] ActivityBridgeHelper.initActivity failed:", e);
                reject(e);
            }
        });
    };

    bridge.trackEvent = function (eventType, eventData) {
        return new Promise(function (resolve, reject) {
            try {
                if (typeof nativeTrackEvent !== "function") {
                    reject(new Error("Native trackEvent not available"));
                    return;
                }
                var eventDataStr = typeof eventData === "string" ? eventData : JSON.stringify(eventData || {});
                var result = nativeTrackEvent.call(bridge, eventType, eventDataStr);
                var response = typeof result === "string" ? JSON.parse(result) : result;
                resolve(response);
            } catch (e) {
                logBridgeError("[ActivityWeb] ActivityBridgeHelper.trackEvent failed:", e);
                reject(e);
            }
        });
    };

    bridge.getSession = function () {
        try {
            if (typeof nativeGetSession !== "function") {
                return null;
            }
            var result = nativeGetSession.call(bridge);
            return typeof result === "string" ? JSON.parse(result) : result;
        } catch (e) {
            logBridgeError("[ActivityWeb] ActivityBridgeHelper.getSession failed:", e);
            return null;
        }
    };

    bridge.EventType = {
        REWARD_AD: "reward_ad",
        INTERSTITIAL_AD: "interstitial_ad",
    };

    bridge.triggerEvent = function (eventType, eventData) {
        return new Promise(function (resolve, reject) {
            try {
                if (typeof nativeTriggerEvent !== "function") {
                    reject(new Error("Native triggerEvent not available"));
                    return;
                }
                var eventDataStr = typeof eventData === "string" ? eventData : JSON.stringify(eventData || {});
                var result = nativeTriggerEvent.call(bridge, eventType, eventDataStr);
                var response = typeof result === "string" ? JSON.parse(result) : result;
                resolve(response);
            } catch (e) {
                logBridgeError("[ActivityWeb] ActivityBridgeHelper.triggerEvent failed:", e);
                reject(e);
            }
        });
    };

    var nativeActivityEventCompleted = window.onActivityEventCompleted;
    var h5ActivityEventCompleted = null;

    window.onActivityEventCompleted = function (data) {
        if (typeof nativeActivityEventCompleted === "function") {
            try {
                nativeActivityEventCompleted(data);
            } catch (e) {
                logBridgeError("[ActivityWeb] native onActivityEventCompleted failed:", e);
            }
        }
        if (typeof h5ActivityEventCompleted === "function") {
            try {
                h5ActivityEventCompleted(data);
            } catch (e) {
                logBridgeError("[ActivityWeb] H5 onActivityEventCompleted failed:", e);
            }
        }
    };

    bridge.onActivityEventCompleted = function (callback) {
        if (typeof callback === "function") {
            h5ActivityEventCompleted = callback;
        }
    };

    bridge.clearActivityEventCompleted = function () {
        h5ActivityEventCompleted = null;
    };
})(window);
