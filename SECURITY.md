# Sicherheit

## Eine Schwachstelle melden

Bitte melden Sie Sicherheitsprobleme **nicht** öffentlich (kein Issue),
sondern per E-Mail an **info@corbum.de** mit dem Betreff „SECURITY“.
Hilfreich sind: Fakturum-Version (`/health` zeigt sie), Image
(amd64/arm64), eine kurze Beschreibung und – wenn möglich – ein Dokument
oder Aufruf, der das Problem reproduziert. Bitte keine echten
Rechnungsdaten mitschicken.

Wir bestätigen den Eingang in der Regel innerhalb von **5 Werktagen** und
melden uns mit einer Einschätzung. Das ist ein Richtwert, keine
vertragliche Zusage.

## Unterstützte Versionen

Sicherheitskorrekturen erscheinen als **Patch-Release** der aktuellen
Version (z. B. 1.0.x) – inklusive und mit derselben Lizenzdatei. Bitte
prüfen Sie zuerst, ob das Problem in der neuesten Patch-Version Ihrer
Linie noch auftritt.

## Wichtig für den Betrieb

- **Fakturum hat keine eingebaute Authentifizierung.** Betreiben Sie den
  Container in einem privaten Netz hinter Ihrem eigenen Reverse-Proxy
  oder API-Gateway (TLS, Zugriffskontrolle), und geben Sie den Port nicht
  ins Internet frei. Auch `/license/status` (zeigt die E-Mail-Adresse des
  Lizenznehmers) gehört nicht ins öffentliche Netz.
- Der Container braucht **keinen** Internetzugang. Ausgehende
  Verbindungen können Sie vollständig sperren.
- Ab Version 1.0.10 liegen jeder Release `RUNNING.md` (gehärteter Start,
  Speicher- und Grenzwert-Empfehlungen), `SHA256SUMS` und eine SBOM
  (CycloneDX) bei. Prüfen Sie Ihren Download mit
  `sha256sum -c SHA256SUMS --ignore-missing`.

---

# Security

## Reporting a vulnerability

Please do **not** report security problems publicly (no issues). Email
**info@corbum.de** with the subject "SECURITY". It helps to include the
Fakturum version (shown by `/health`), the image (amd64/arm64), a short
description and — if you can — a document or request that reproduces the
problem. Please don't send real invoice data.

We normally acknowledge a report within **5 business days** and reply with
an assessment. That is a target, not a contractual commitment.

## Supported versions

Security fixes ship as a **patch release** of the current version line
(e.g. 1.0.x) — included, and with the same license file. Please check
first whether the problem still occurs in the latest patch release of
your line.

## Operating it safely

- **Fakturum has no built-in authentication.** Run the container on a
  private network behind your own reverse proxy or API gateway (TLS,
  access control) and don't publish the port to the internet. Keep
  `/license/status` (it shows the licensee's e-mail address) off the
  public network too.
- The container needs **no** internet access. You can block all outbound
  connections.
- From version 1.0.10 on, every release includes `RUNNING.md` (hardened
  start, memory and limit recommendations), `SHA256SUMS` and an SBOM
  (CycloneDX). Verify your download with
  `sha256sum -c SHA256SUMS --ignore-missing`.
