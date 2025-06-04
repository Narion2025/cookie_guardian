// background code placeholder
// Cookie Guardian – Hintergrund‑Service‑Worker (Manifest V3)
// Speichert **ausschließlich lokal**.

class CookieGuardianService {
  constructor() {
    this.init();
  }

  async init() {
    await this.initializeStorage();
    this.setupEventListeners();
  }

  /* ---------------- Initial Storage ---------------- */
  async initializeStorage() {
    const { cookieGuardianSettings } = await chrome.storage.local.get("cookieGuardianSettings");
    if (!cookieGuardianSettings) {
      await chrome.storage.local.set({
        cookieGuardianSettings: {
          silentMode: true,      // Popup nur beim ersten Besuch anzeigen
          showNotifications: true,
          defaultAction: "block" // Blockieren als sichere Voreinstellung
        }
      });
    }
  }

  /* ---------------- Event Listener ---------------- */
  setupEventListeners() {
    // Install / Update
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        // ggf. weitere Installationslogik
        console.info("Cookie Guardian installiert ✨");
      }
    });

    // Nachrichten von Content‑Script / Popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // async
    });

    // Badge bei Tab-Wechsel
    chrome.tabs.onActivated.addListener(({ tabId }) => this.updateBadge(tabId));

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) this.updateBadge(tabId);
    });
  }

  /* ---------------- Nachrichtenrouting ---------------- */
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case "saveDomainSetting":
          await this.saveDomainSetting(request.domain, request.setting);
          sendResponse({ success: true });
          break;

        case "getDomainSetting":
          sendResponse({ setting: await this.getDomainSetting(request.domain) });
          break;

        case "clearDomainSetting":
          await this.clearDomainSetting(request.domain);
          sendResponse({ success: true });
          break;

        case "getStats":
          sendResponse({ stats: await this.getStats() });
          break;

        case "updateBadge":
          await this.updateBadge(sender.tab.id, request.status);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: "Unknown action" });
      }
    } catch (err) {
      console.error("[Cookie Guardian] Background Error:", err);
      sendResponse({ error: err.message });
    }
  }

  /* ---------------- Domain‑Einstellungen ---------------- */
  async saveDomainSetting(domain, action) {
    const { domainSettings = {} } = await chrome.storage.local.get("domainSettings");
    domainSettings[domain] = { action, timestamp: Date.now() };
    await chrome.storage.local.set({ domainSettings });
    await this.updateStats(action);
  }

  async getDomainSetting(domain) {
    const { domainSettings = {} } = await chrome.storage.local.get("domainSettings");
    return domainSettings[domain] || null;
  }

  async clearDomainSetting(domain) {
    const { domainSettings = {} } = await chrome.storage.local.get("domainSettings");
    if (domain in domainSettings) {
      delete domainSettings[domain];
      await chrome.storage.local.set({ domainSettings });
    }
  }

  /* ---------------- Statistik ---------------- */
  async updateStats(action) {
    const { stats = { blocked: 0, essential: 0, accepted: 0, lastUpdated: Date.now() } } = await chrome.storage.local.get("stats");
    if (action in stats) stats[action]++;
    stats.lastUpdated = Date.now();
    await chrome.storage.local.set({ stats });
  }

  async getStats() {
    const { stats } = await chrome.storage.local.get("stats");
    return stats || { blocked: 0, essential: 0, accepted: 0, lastUpdated: Date.now() };
  }

  /* ---------------- Badge ---------------- */
  async updateBadge(tabId, explicitStatus = null) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || tab.url.startsWith("chrome://")) return;

      const domain = new URL(tab.url).hostname;
      const setting = explicitStatus || (await this.getDomainSetting(domain));
      let badgeText = "";
      let badgeColor = "#9e9e9e"; // grau

      if (setting) {
        const action = setting.action || setting; // explicitStatus ist string
        switch (action) {
          case "block":
            badgeText = "🛡️";
            badgeColor = "#e53935";
            break;
          case "essential":
            badgeText = "⚠️";
            badgeColor = "#fb8c00";
            break;
          case "accept":
            badgeText = "✓";
            badgeColor = "#43a047";
            break;
        }
      }
      await chrome.action.setBadgeText({ tabId, text: badgeText });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: badgeColor });
    } catch (err) {
      console.error("[Cookie Guardian] Badge Error:", err);
    }
  }
}

// Initialisieren
new CookieGuardianService();