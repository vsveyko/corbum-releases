# Fakturum by Corbum

**E-Rechnung. Selbst gehostet. Einfach.**
XRechnung, ZUGFeRD und Factur-X prüfen, konvertieren und erzeugen – mit
einer kleinen REST-API in Ihrem eigenen Netz.

Seit 2025 müssen Unternehmen in Deutschland E-Rechnungen empfangen können,
ab 2027/2028 auch versenden. **Fakturum** erledigt das als ein einziger,
kleiner Docker-Container – ohne Java-Toolchain, ohne Cloud, ohne Abo.

| | |
| --- | --- |
| **Offizielle Prüfregeln** | XSD + EN-16931- und XRechnung-Schematron der KoSIT – keine nachgebaute Annäherung |
| **Ihre Daten bleiben bei Ihnen** | Läuft vollständig offline. Keine Telemetrie, kein Lizenzserver, auch im abgeschotteten Netz |
| **Ein kleiner Container** | Ein statisches Go-Binary. Keine JVM, keine Datenbank – `linux/amd64` und `linux/arm64` |
| **Keine Kontingente** | Keine Gebühren pro Dokument, keine Rate-Limits |
| **Dauerhafte Lizenz** | Kein Abo, keine Laufzeit. Patches innerhalb Ihrer Version dauerhaft inklusive |
| **Swagger UI eingebaut** | Die vollständige API-Referenz liefert jeder Container unter `/docs` mit |

## Pro und Business

| | **Pro** | **Business** |
| --- | :---: | :---: |
| XRechnung UBL & CII validieren | ✓ | ✓ |
| ZUGFeRD- / Factur-X-PDFs validieren | ✓ | ✓ |
| UBL ⇄ CII konvertieren | ✓ | ✓ |
| XRechnung aus JSON erzeugen | ✓ | ✓ |
| Stapelverarbeitung per ZIP (bis 5.000 Dateien, CSV-Bericht) | | ✓ |

Pro und Business sind dasselbe Image. Welcher Plan aktiv ist, entscheidet
die signierte Lizenzdatei, die Sie von einem unserer Vertriebspartner
erhalten.

## Installation

Image unter **Releases** herunterladen, dann:

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

- **Patches** (z. B. 1.0.0 → 1.0.9): inklusive, erscheinen hier als neue Release – gleiche Lizenzdatei.
- **Funktions-Updates** (z. B. 1.0 → 1.1): optional – Sie entscheiden, wann Sie wechseln, und können Versionen überspringen.
- **Kein Abo**, nichts verlängert sich automatisch.

---

## English

**Fakturum** validates, converts and generates German and EU e-invoices
(XRechnung, ZUGFeRD, Factur-X, EN 16931) from one small Docker container
on your own servers – no cloud, no subscription, no per-document fees.

- **Official rules** – XSD plus the KoSIT EN 16931 and XRechnung Schematron.
- **Your data stays with you** – fully offline, no telemetry, offline license check.
- **One small container** – static Go binary, `linux/amd64` and `linux/arm64`.
- **No quotas** and a **perpetual license** – no subscription, patches within your version included forever.
- **Swagger UI built in** at `/docs`.

| | Pro | Business |
| --- | :---: | :---: |
| XRechnung UBL & CII validation | ✓ | ✓ |
| ZUGFeRD / Factur-X PDF validation | ✓ | ✓ |
| Convert UBL ⇄ CII, generate XRechnung from JSON | ✓ | ✓ |
| Batch processing via ZIP (up to 5,000 files, CSV report) | | ✓ |

**Install:** download `fakturum-paid-<version>.tar.gz` from **Releases**,
`docker load` it and mount the license file you get from one of our sales
partners as `/app/license.json`. Pro and Business are the same image –
the license file decides which plan is active.

---

Fakturum is part of **Corbum** – Engineering Regulatory Data.
More: [corbum.de](https://corbum.de/fakturum.html)
