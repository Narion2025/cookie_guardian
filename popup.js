// popup.js
(async () => {
  const $ = (sel) => document.querySelector(sel);

  const domainEl = $("#current-domain");
  const statBlocked = $("#stat-blocked");
  const statEssential = $("#stat-essential");
  const statAccepted = $("#stat-accepted");
  const domainControls = $("#domain-controls");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = tab?.url ? new URL(tab.url).hostname : null;
  if (domain) {
    domainEl.textContent = domain;
    domainControls.hidden = false;
    updateDomainState();
  }

  // Load stats
  chrome.runtime.sendMessage({ action: "getStats" }, ({ stats }) => {
    if (stats) {
      statBlocked.textContent = stats.blocked || 0;
      statEssential.textContent = stats.essential || 0;
      statAccepted.textContent = stats.accepted || 0;
    }
  });

  // Button actions
  domainControls.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    if (action) {
      chrome.runtime.sendMessage({ action: "saveDomainSetting", domain, setting: action }, () => {
        window.close();
      });
    }
  });

  $("#clear-setting").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "clearDomainSetting", domain }, () => window.close());
  });

  function updateDomainState() {
    chrome.runtime.sendMessage({ action: "getDomainSetting", domain }, ({ setting }) => {
      domainControls.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.disabled = setting && btn.dataset.action === (setting.action || setting);
      });
    });
  }
})();