<p align="center">
  <img src="assets/logo.svg" alt="Corbum" width="96">
</p>

<h1 align="center">Fakturum by Corbum</h1>

<p align="center">
  <strong>E-Rechnung. Selbst gehostet. Einfach.</strong><br>
  XRechnung, ZUGFeRD &amp; Factur-X prüfen, konvertieren und erzeugen –<br>
  mit einer kleinen REST-API in Ihrem eigenen Netz.
</p>

<p align="center">
  <a href="https://corbum.de/fakturum.html">Website</a> ·
  <a href="https://corbum.de/fakturum.html#partner">Bezugsquellen</a> ·
  <a href="https://hub.docker.com/r/vsveyko/corbum-fakturum-api">Free-Image auf Docker Hub</a> ·
  <a href="#english">English</a>
</p>

---

Seit 2025 müssen Unternehmen in Deutschland E-Rechnungen empfangen können,
ab 2027/2028 auch versenden. **Fakturum** erledigt das als ein einziger,
rund 28 MB kleiner Docker-Container – ohne Java-Toolchain, ohne Cloud,
ohne Abo.

| | |
| --- | --- |
| ✅ **Offizielle Prüfregeln** | XSD + EN-16931- und XRechnung-Schematron der KoSIT – keine nachgebaute Annäherung |
| 🔒 **Ihre Daten bleiben bei Ihnen** | Läuft vollständig offline. Keine Telemetrie, kein Lizenzserver, auch im abgeschotteten Netz |
| 📦 **Ein Container, ~28 MB** | Ein statisches Go-Binary. Keine JVM, keine Datenbank – `linux/amd64` und `linux/arm64` |
| ♾️ **Keine Kontingente** | Keine Gebühren pro Dokument, keine Rate-Limits |
| 💶 **Einmal kaufen** | Kein Abo. Patches innerhalb Ihrer Version dauerhaft kostenlos |
| 📖 **Swagger UI eingebaut** | Die vollständige API-Referenz liefert jeder Container unter `/docs` mit |

## Pläne

| | **Free** | **Pro** | **Business** |
| --- | :---: | :---: | :---: |
| XRechnung UBL & CII validieren | ✓ | ✓ | ✓ |
| ZUGFeRD- / Factur-X-PDFs validieren | | ✓ | ✓ |
| UBL ⇄ CII konvertieren | | ✓ | ✓ |
| XRechnung aus JSON erzeugen | | ✓ | ✓ |
| Stapelverarbeitung per ZIP (bis 5.000 Dateien, CSV-Bericht) | | | ✓ |
| Preis | kostenlos | 199 € einmalig (UVP) | 499 € einmalig (UVP) |
| Image | Docker Hub | **diese Release-Seite** | **diese Release-Seite** |

Lizenzen für Pro und Business erhalten Sie bei unseren
[Vertriebspartnern](https://corbum.de/fakturum.html#partner). Das Image
auf dieser Seite ist frei herunterladbar – erst die signierte Lizenzdatei
schaltet Pro bzw. Business frei. Ohne Lizenz arbeitet es wie die
Free-Version.

## In zwei Minuten startklar

**Free** – ohne Registrierung:

```bash
docker run -d -p 8080:8080 vsveyko/corbum-fakturum-api:free

DOC=$(base64 -w0 invoice.xml)
curl -X POST http://localhost:8080/validate \
  -H "Content-Type: application/json" \
  -d "{\"document\":\"${DOC}\",\"format\":\"auto\"}"
```

Antwort (gekürzt):

```json
{ "status": "valid", "valid": true, "format": "xrechnung-ubl", "errors": [], "warnings": [] }
```

**Pro / Business** – Image unter [Releases](../../releases) herunterladen,
dann:

```bash
docker load < fakturum-paid-<version>.tar.gz

docker run -d -p 8080:8080 \
  -v /pfad/zur/license.json:/app/license.json:ro \
  corbum-fakturum-api:<version>-paid-amd64      # -paid-arm64 auf ARM

curl http://localhost:8080/license/status       # zeigt den aktiven Plan
```

Die vollständige API-Referenz: `http://localhost:8080/docs` (Swagger UI,
funktioniert offline).

## Updates

- **Patches** (z. B. 1.0.0 → 1.0.9): kostenlos, erscheinen hier als neue Release – gleiche Lizenzdatei.
- **Funktions-Updates** (z. B. 1.0 → 1.1): optional, pauschal 99 € (UVP), egal wie viele Versionen Sie überspringen.
- **Kein Abo**, nichts verlängert sich automatisch.

Es gelten die [Lizenzbedingungen](https://corbum.de/lizenzbedingungen.html).
Fragen: [info@corbum.de](mailto:info@corbum.de)

---

<a id="english"></a>

## English

**Fakturum** validates, converts and generates German and EU e-invoices
(XRechnung, ZUGFeRD, Factur-X, EN 16931) from one Docker container of
about 28 MB on your own servers – no cloud, no subscription, no
per-document fees.

- **Official rules** – XSD plus the KoSIT EN 16931 and XRechnung Schematron.
- **Your data stays with you** – fully offline, no telemetry, offline license check.
- **One small container** – static Go binary, `linux/amd64` and `linux/arm64`.
- **No quotas** and a **one-time price** – patches within your version are free forever.
- **Swagger UI built in** at `/docs`.

| | Free | Pro | Business |
| --- | :---: | :---: | :---: |
| XRechnung UBL & CII validation | ✓ | ✓ | ✓ |
| ZUGFeRD / Factur-X PDF validation | | ✓ | ✓ |
| Convert UBL ⇄ CII, generate XRechnung from JSON | | ✓ | ✓ |
| Batch processing via ZIP (up to 5,000 files, CSV report) | | | ✓ |
| Price | free | €199 one-time (RRP) | €499 one-time (RRP) |

**Free:** `docker run -d -p 8080:8080 vsveyko/corbum-fakturum-api:free`

**Pro / Business:** download `fakturum-paid-<version>.tar.gz` from
[Releases](../../releases), `docker load` it and mount the license file
you get from one of our [sales partners](https://corbum.de/fakturum.html#partner)
as `/app/license.json`. Without a license the image runs as Free.

More: [corbum.de/fakturum](https://corbum.de/fakturum.html) ·
[License terms (German)](https://corbum.de/lizenzbedingungen.html) ·
[info@corbum.de](mailto:info@corbum.de)

---

<p align="center">
  <img src="assets/fakturum.svg" alt="" width="24"><br>
  <sub>Fakturum is part of <strong>Corbum</strong> – Engineering Regulatory Data.</sub>
</p>
