# Cookie Guardian

Eine schlanke Chrome‑Extension, die Cookie‑Banner automatisch erkennt, das Datenschutz‑Risiko per Ampel einstuft und deine Wahl (Blockieren / Essentiell / Akzeptieren) **nur lokal** speichert.

## Installation (Entwicklermodus)
1. Repo/Ordner `cookie-guardian` klonen oder Dateien speichern.
2. Browser: `chrome://extensions` öffnen.
3. „Entwicklermodus“ aktivieren → „Entpackte Erweiterung laden“.
4. Ordner auswählen, fertig!

## Anpassung
- **Selektoren & Sprachmuster** in `content-script.js` (`bannerSelectors`, `buttonPatterns`) bequem erweiterbar.
- **Default‑Verhalten** (silentMode, defaultAction) in `background.js` → `cookieGuardianSettings`.

## Datenschutz
Alle Einstellungen & Statistiken liegen in `chrome.storage.local`. Keine Cloud‑Sync, keine externen Server.# cookie_guardian
