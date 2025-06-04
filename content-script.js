// Cookie Guardian – Content Script v1.3
// – Mehrstufige CMP‑Dialoge (z. B. Bild.de, SZ, Amazon) werden jetzt erkannt und automatisch abgeschlossen.
// – Sucht nach „Speichern / Auswahl speichern“‑Buttons und klickt sie.
// – Entfernt übriggebliebene Overlays & setzt body/html overflow zurück, falls Seiten weiß bleiben.

class CookieGuardianContent {
  constructor() {
    console.debug("[Cookie Guardian] injected on", location.hostname);

    this.domain = location.hostname;
    this.banner = null;
    this.overlayShown = false;
    this.domainSetting = null;

    /* ---------- Selektoren ---------- */
    this.bannerSelectors = [
      // Häufige CMP‑IDs / Klassen
      "#onetrust-consent-sdk", ".onetrust-pc-dark-filter", ".ot-sdk-container",
      "#usercentrics-cmp", ".uc-banner", ".usercentrics-dialog",
      "#sp_message_container_", ".sp_message", "[id^='sp_message_id']", // Sourcepoint (Bild, SZ, Amazon)
      "#CybotCookiebotDialog", "#Cookiebot", ".cookiebot-banner",
      // Generisch
      '[id*="cookie" i]', '[class*="cookie" i]', '[id*="consent" i]', '[class*="consent" i]',
      '[role="dialog"]', 'div[aria-modal="true"]',
      '.gdpr-banner', '.privacy-banner', '.cookie-notice', '.cookie-bar'
    ];

    this.buttonPatterns = {
      accept: [
        "alle akzeptieren", "accept", "einverstanden", "zustimmen", "ok weiter", "ok, weiter", "ich bin einverstanden"
      ],
      reject: [
        "alle ablehnen", "ablehnen", "ohne zustimmung", "reject", "nur erforderliche", "continue without", "not consent"
      ],
      settings: [
        "einstellungen", "optionen", "details", "manage preferences", "anpassen", "customize", "weitere optionen"
      ],
      save: [
        "auswahl speichern", "save selection", "confirm choices", "speichern", "save & exit", "bestätigen"
      ]
    };

    // Fallback‑Keywords (für heuristische Erkennung grosser Overlays)
    this.keywordRegex = /(cookies?|tracking|werbung|datenschutz|zustimmen|einwilligung|wahl)/i;

    this.init();
  }

  /* ---------- Initial ---------- */
  async init() {
    this.domainSetting = await this.getDomainSetting();

    // Wenn Nutzer­einstellung existiert → Silent Mode
    if (this.domainSetting) {
      this.applySilentMode();
    } else {
      this.detectBanner();
      this.observeMutations();
    }
    this.updateBadge();
  }

  /* ---------- Kommunikation mit Background ---------- */
  async getDomainSetting() {
    try {
      const { setting } = await chrome.runtime.sendMessage({ action: "getDomainSetting", domain: this.domain });
      return setting;
    } catch (_) { return null; }
  }
  updateBadge(status = null) { chrome.runtime.sendMessage({ action: "updateBadge", status }); }
  async saveDomainSetting(action) { chrome.runtime.sendMessage({ action: "saveDomainSetting", domain: this.domain, setting: action }); }

  /* ---------- Beobachtung ---------- */
  observeMutations() {
    const mo = new MutationObserver(() => {
      if (!this.overlayShown) this.detectBanner();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 45000);
  }

  detectBanner() {
    // 1) Selektor‑Suche
    for (const sel of this.bannerSelectors) {
      const el = document.querySelector(sel);
      if (el && this.isVisible(el)) { this.setBanner(el); return; }
    }
    // 2) Heuristische Fallback‑Suche (großer Overlay‑Container)
    const candidates = [...document.querySelectorAll("div")].filter(el => this.isVisible(el) && this.coversViewport(el));
    for (const el of candidates) {
      if (this.keywordRegex.test(el.textContent)) { this.setBanner(el); return; }
    }
  }

  setBanner(el) {
    this.banner = el;
    if (!this.overlayShown) this.showOverlay();
  }

  /* ---------- Utility ---------- */
  isVisible(el) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  coversViewport(el) {
    const r = el.getBoundingClientRect();
    return r.width * r.height > (window.innerWidth * window.innerHeight * 0.25);
  }

  /* ---------- Overlay ---------- */
  showOverlay() {
    if (this.overlayShown) return;
    this.overlayShown = true;

    const ov = document.createElement("div");
    ov.className = "cookie-guardian-overlay";
    ov.innerHTML = `
      <div class="guardian-popup" style="max-width:380px">
        <div class="guardian-header"><div class="guardian-logo">🛡️ Cookie Guardian</div></div>
        <div class="guardian-content">
          <p style="margin-top:0">Wie möchtest du auf <strong>${this.domain}</strong> mit Cookies umgehen?</p>
          <div class="guardian-actions" style="gap:10px">
            <button class="guardian-btn block" data-action="block">🔴 Blockieren</button>
            <button class="guardian-btn essential" data-action="essential">🟡 Essenzielle</button>
            <button class="guardian-btn accept" data-action="accept">🟢 Alle akzeptieren</button>
          </div>
          <div class="guardian-footer"><small>Wahl wird lokal gespeichert</small></div>
        </div>
      </div>`;

    ov.addEventListener("click", (e) => {
      const act = e.target.dataset.action;
      if (act) { this.handleUserChoice(act); ov.remove(); }
    });

    document.body.appendChild(ov);
  }

  async handleUserChoice(action) {
    await this.saveDomainSetting(action);
    this.applyBannerAction(action);
    this.updateBadge(action);
  }

  /* ---------- Aktionen ---------- */
  applyBannerAction(action) {
    if (!this.banner) return;

    const performClicks = () => {
      if (action === "accept") {
        if (!this.clickButton("accept")) this.clickGlobalSave();
      } else if (action === "block") {
        if (!this.clickButton("reject")) this.clickGlobalSave();
      } else if (action === "essential") {
        // Schritt 1: Einstellungen öffnen
        if (this.clickButton("settings")) {
          // kurzes Delay → neues Panel abfangen
          setTimeout(() => { this.updateBannerReference(); this.clickGlobalSave(); }, 800);
        } else {
          this.clickButton("reject") || this.clickGlobalSave();
        }
      }
    };

    performClicks();

    // Fallback Cleanup – nach 5 s alle sichtbaren Dialoge entfernen & overflow resetten
    setTimeout(() => this.forceCleanup(), 5000);
  }

  clickButton(kind) {
    const pats = this.buttonPatterns[kind] || [];
    for (const pat of pats) {
      const btn = [...(this.banner?.querySelectorAll("button, a, [role='button']") || [])]
        .find(b => b.textContent.toLowerCase().includes(pat));
      if (btn) { this.humanClick(btn); return true; }
    }
    return false;
  }

  clickGlobalSave() {
    // Sucht im gesamten Dokument nach Save‑Buttons, falls Panel gewechselt hat
    const btn = [...document.querySelectorAll("button, a, [role='button']")]
      .find(b => this.buttonPatterns.save.some(p => b.textContent.toLowerCase().includes(p)) && this.isVisible(b));
    if (btn) { this.humanClick(btn); return true; }
    return false;
  }

  updateBannerReference() {
    // Finde ggf. neues, größeres Dialog‑Element nach Einstellungen‑Klick
    const dialogs = [...document.querySelectorAll('[role="dialog"], div[aria-modal="true"]')]
      .filter(el => this.isVisible(el)).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    if (dialogs.length && dialogs[0] !== this.banner) this.banner = dialogs[0];
  }

  humanClick(el) { setTimeout(() => el?.click(), Math.random() * 120 + 30); }

  forceCleanup() {
    // entferne übriggebliebene Overlays und stelle Scrollbarkeit wieder her
    [...document.querySelectorAll('[role="dialog"], div[aria-modal="true"], .sp_message')]
      .forEach(el => { if (this.isVisible(el)) el.style.display = "none"; });
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
  }

  /* ---------- Silent‑Mode ---------- */
  applySilentMode(fallback = null) {
    const action = this.domainSetting?.action || fallback;
    if (!action) return;
    setTimeout(() => {
      this.detectBanner();
      if (this.banner) this.applyBannerAction(action);
    }, 1200);
  }
}

// Auto‑Start
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new CookieGuardianContent());
} else {
  new CookieGuardianContent();
}