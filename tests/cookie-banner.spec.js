import { test, expect } from "@playwright/test";

// Launch Chromium mit geladenem Extension‑Verzeichnis
// ➜ PW config: use: { contextOptions: { ...chromeExtension(headless=false) } }

test("Cookie‑Banner wird automatisch blockiert", async ({ page }) => {
  await page.goto("https://example‑with‑cookiebanner.com");
  // Warten bis Badge‑Icon auf 🛡️ wechselt
  await page.waitForFunction(() => chrome.action.getBadgeText({ tabId: chrome.devtools.inspectedWindow.tabId }) === "🛡️");
  // Prüfen, ob Banner im DOM nicht mehr sichtbar ist
  const banner = await page.$("[id*='cookie'], [class*='cookie']");
  expect(banner).toBeNull();
});