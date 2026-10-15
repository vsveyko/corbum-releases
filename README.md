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
| **Passt in Ihr ERP** | Schlichte HTTP-API: ERP, Warenwirtschaft, Rechnungseingang, Shop oder Buchhaltung binden Fakturum mit einem Aufruf ein – in jeder Programmiersprache |
| **Ihre Daten bleiben bei Ihnen** | Läuft vollständig offline. Keine Telemetrie, kein Lizenzserver, auch im abgeschotteten Netz |
| **Ein kleiner Container** | Ein statisches Go-Binary. Keine JVM, keine Datenbank – `linux/amd64` und `linux/arm64` |
| **Sicher zu betreiben** | Läuft ohne root, ohne ausgehende Verbindungen, ohne Datenbank; Dokumente werden nur im Arbeitsspeicher verarbeitet und nie protokolliert – Details im Abschnitt „Sicherheit und Betrieb“ |
| **Keine Kontingente** | Keine Gebühren pro Dokument, keine Rate-Limits |
| **Dauerhafte Lizenz** | Kein Abo, keine Laufzeit. Patches innerhalb Ihrer Version dauerhaft inklusive |
| **Swagger UI eingebaut** | Die vollständige API-Referenz liefert jeder Container unter `/docs` mit |

## Kostenlos testen

Die XML-Prüfung (XRechnung UBL und CII, mit denselben offiziellen Regeln)
ist kostenlos und ohne Limits – ohne Lizenz, ohne Registrierung:

```bash
docker run -d --name fakturum -p 127.0.0.1:8080:8080 vsveyko/corbum-fakturum-api:free
```

Eine Beispielrechnung mit absichtlichem Fehler (die Käuferreferenz fehlt)
holen und prüfen:

```bash
curl -sO https://raw.githubusercontent.com/vsveyko/corbum-releases/main/demo-fakturum/www/samples/invalid-no-buyer-reference.xml
curl -s -X POST http://localhost:8080/validate -H "Content-Type: application/json" \
  -d "{\"document\":\"$(base64 -w0 invalid-no-buyer-reference.xml)\",\"format\":\"auto\"}"
```

Antwort (gekürzt) – eine ungültige Rechnung ist ein normales Ergebnis, kein HTTP-Fehler:

```json
{
  "status": "invalid",
  "valid": false,
  "errors": [
    {
      "code": "BR-DE-15",
      "message": "[BR-DE-15] Das Element \"Buyer reference\" (BT-10) muss übermittelt werden.",
      "businessTerm": "BT-10"
    }
  ]
}
```

Eine gültige Vergleichsrechnung: `valid-ubl.xml` aus demselben Ordner. Die
vollständige API-Referenz: `http://localhost:8080/docs`. Beenden:
`docker rm -f fakturum`.

- Der Port ist nur auf dem eigenen Rechner erreichbar (`127.0.0.1`) – Fakturum
  hat keine eingebaute Anmeldung.
- macOS: `base64 -i invalid-no-buyer-reference.xml` statt `base64 -w0 …`.
- Jede Version gibt es auch als festen Tag `<version>-free` (siehe Docker
  Hub), für reproduzierbare Tests.
- Die lokale Demo (siehe unten) zeigt im Browser auch, was Pro und Business
  können.

## So funktioniert's

![Fakturum in 4 Schritten: Container starten, Rechnung an /validate senden, Ergebnis mit Regel-IDs auswerten, in den Ablauf einbauen. Architektur: Ihre Software spricht per HTTP im internen Netz mit dem Fakturum-Container, die Regeln sind eingebaut, keine ausgehenden Verbindungen.](images/so-funktionierts.png)

## Free, Pro und Business

| | **Free** | **Pro** | **Business** |
| --- | :---: | :---: | :---: |
| XRechnung UBL & CII validieren | ✓ | ✓ | ✓ |
| ZUGFeRD- / Factur-X-PDFs validieren | | ✓ | ✓ |
| UBL ⇄ CII konvertieren | | ✓ | ✓ |
| XRechnung aus JSON erzeugen – auch ohne Umsatzsteuer (Kleinunternehmer nach § 19 UStG, Reverse Charge) | | ✓ | ✓ |
| XRechnung in Ihr eigenes PDF/A einbetten (ZUGFeRD / Factur-X) | | ✓ | ✓ |
| Stapelverarbeitung per ZIP (bis 5.000 Dateien, CSV-Bericht) | | | ✓ |

Free gibt es auf Docker Hub (`vsveyko/corbum-fakturum-api:free`), ohne Lizenz
und ohne Mengengrenze.

Pro und Business sind dasselbe Image. Welcher Plan aktiv ist, entscheidet
die signierte Lizenzdatei, die Sie von einem unserer Vertriebspartner
erhalten.

## Installation

Unter **Releases** die Datei für Ihren Server herunterladen –
`fakturum-paid-<version>-amd64.tar.gz` für Intel/AMD,
`fakturum-paid-<version>-arm64.tar.gz` für ARM (z. B. AWS Graviton,
Apple Silicon). Danach ist alles gleich:

```bash
docker load -i fakturum-paid-<version>-amd64.tar.gz

docker run -d -p 8080:8080 \
  -v /pfad/zur/license.json:/app/license.json:ro \
  corbum-fakturum-api:<version>-paid

curl http://localhost:8080/license/status       # zeigt den aktiven Plan
```

Die vollständige API-Referenz: `http://localhost:8080/docs` (Swagger UI,
funktioniert offline).

## Für Entwickler und Integratoren

- **Sauberer API-Vertrag** – OpenAPI 3 und Swagger UI in jedem Container, auch offline; Clients für Ihre Sprache generieren Sie direkt aus der Spezifikation.
- **Fehler, mit denen man arbeiten kann** – jeder Verstoß mit offizieller Regel-ID, Business Term und Position im Dokument. Eine ungültige Rechnung ist ein normales Ergebnis, kein HTTP-Fehler.
- **Betriebsfreundlich** – `/health` für Liveness- und Readiness-Probes, `/license/status` fürs Monitoring. Ein Lizenzproblem legt den Dienst nie lahm.
- **Partnerschaft für Systemhäuser** – Sie setzen Fakturum in Kundenprojekten ein? Werden Sie Vertriebspartner und bieten Sie Integration und Lizenz aus einer Hand.
- **Direkter Draht zum Entwickler** – technische Fragen zur Integration beantwortet der Entwickler von Fakturum selbst.

## Lokale Demo für Integratoren

Im Ordner `demo-fakturum` dieses Repositories liegt eine kleine Demo-Seite,
die neben Ihrem eigenen Container läuft: Rechnungen prüfen, konvertieren,
erzeugen und als Stapel verarbeiten – mit dem passenden curl-, Python- und
Node.js-Code zum Kopieren. Alles bleibt auf Ihrem Rechner;
`docker compose up -d` genügt (die Seite ist englisch).

Neu ab 1.0.14: **aus einer normalen PDF-Rechnung eine XRechnung machen** – mit
Ihrem eigenen KI-Assistenten. Die Demo liefert den Prompt dafür; die KI liest
die PDF, Fakturum erzeugt daraus die XRechnung und prüft sie gegen die
offiziellen Regeln. Die KI ist angewiesen, Fehlendes zu melden statt es zu
erfinden – die Prüfung durch Fakturum und ein Blick auf ihren Bericht bleiben
trotzdem Pflicht.

Neu ab 1.0.15: **die XRechnung in Ihre eigene PDF-Rechnung einbetten.** Ihre
PDF – als PDF/A gespeichert (in Word: Optionen → „PDF/A-kompatibel“) – wird
zur ZUGFeRD-/Factur-X-Rechnung, sonst bleibt sie unverändert. Geprüft mit dem
Referenz-Validator für ZUGFeRD (Mustang, darin veraPDF). Fakturum vergleicht
dabei nicht den Text der PDF mit der XRechnung – darauf weist jede Antwort hin.

## Sicherheit und Betrieb

- **Keine eingebaute Authentifizierung.** Betreiben Sie den Container im
  privaten Netz hinter Ihrem eigenen Reverse-Proxy oder API-Gateway und
  geben Sie den Port nicht ins Internet frei.
- **Kein Internetzugang nötig.** Regeln, API-Dokumentation und
  Lizenzprüfung sind eingebaut; ausgehende Verbindungen können Sie
  komplett sperren.
- **Ab Version 1.0.10:** das Image enthält nur das Programm – kein
  Betriebssystem, keine Shell (Schwachstellenscan ohne Befund); Schutz
  gegen übergroße und bösartige Dokumente (extrem komplexe XML, ZIP-Bomben
  im Stapel) mit klaren Fehlermeldungen; jede Release enthält
  `SHA256SUMS`, eine SBOM und `RUNNING.md` mit gehärtetem Start,
  Speicher-Empfehlungen und allen Einstellungen.
- **Schwachstelle gefunden?** Bitte nicht öffentlich melden – siehe die
  Datei `SECURITY.md` in diesem Repository.

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
- **Fits into your ERP** – a plain HTTP API: ERP, inventory, incoming-invoice workflows, shops or accounting call it directly, from any language.
- **Your data stays with you** – fully offline, no telemetry, offline license check.
- **One small container** – static Go binary, `linux/amd64` and `linux/arm64`.
- **No quotas** and a **perpetual license** – no subscription, patches within your version included forever.
- **Swagger UI built in** at `/docs`.
- **Try it free** – XML validation (XRechnung UBL and CII, same official rules) is free with no limits, no license, no sign-up. Start it, fetch a sample with a deliberate error and validate it:

  ```bash
  docker run -d --name fakturum -p 127.0.0.1:8080:8080 vsveyko/corbum-fakturum-api:free
  curl -sO https://raw.githubusercontent.com/vsveyko/corbum-releases/main/demo-fakturum/www/samples/invalid-no-buyer-reference.xml
  curl -s -X POST http://localhost:8080/validate -H "Content-Type: application/json" \
    -d "{\"document\":\"$(base64 -w0 invalid-no-buyer-reference.xml)\",\"format\":\"auto\"}"
  ```

  The answer is `"valid": false` with rule `BR-DE-15` (buyer reference missing) – an invalid invoice is a normal result, not an HTTP error. API reference: `http://localhost:8080/docs`; stop with `docker rm -f fakturum`. The port is bound to `127.0.0.1` because Fakturum has no built-in authentication. On macOS use `base64 -i` instead of `base64 -w0`.
- **Safe to operate** – runs as non-root, makes no outbound connections, processes documents in memory only and never logs them. There is no built-in authentication: run it on a private network behind your own gateway. From 1.0.10 the image contains nothing but the program (no OS, no shell), is protected against oversized and hostile documents, and every release ships `SHA256SUMS`, an SBOM and `RUNNING.md`. Report vulnerabilities privately – see `SECURITY.md` in this repository.
- **Try it locally** – the `demo-fakturum` folder holds a small demo page that runs next to your own container (validate, convert, generate, batch, with copyable curl/Python/Node.js code); `docker compose up -d` is all it takes.
- **New in 1.0.14: from an ordinary PDF invoice to an XRechnung with your own AI assistant** – the demo provides the prompt; the AI reads the PDF, Fakturum generates the XRechnung and checks it against the official rules. The AI is instructed to report what the invoice doesn't show instead of inventing it; Fakturum's check and a look at the AI's report are still a must.
- **New in 1.0.15: embed the XRechnung into your own invoice PDF** – saved as PDF/A (Word: Options → "PDF/A compliant"), it becomes a ZUGFeRD / Factur-X invoice and is otherwise unchanged. Checked with the ZUGFeRD reference validator (Mustang, which runs veraPDF). Fakturum does not compare the PDF's text with the XRechnung; every response says so.

![Fakturum in 4 steps: start the container, send an invoice to /validate, read the result with rule IDs, make it part of the flow. Architecture: your software talks HTTP on the internal network to the Fakturum container, rules built in, no outbound connections.](images/how-it-works.png)

| | Pro | Business |
| --- | :---: | :---: |
| XRechnung UBL & CII validation | ✓ | ✓ |
| ZUGFeRD / Factur-X PDF validation | ✓ | ✓ |
| Convert UBL ⇄ CII, generate XRechnung from JSON – also without VAT (German small businesses under § 19 UStG, reverse charge) | ✓ | ✓ |
| Embed the XRechnung into your own PDF/A (ZUGFeRD / Factur-X) | ✓ | ✓ |
| Batch processing via ZIP (up to 5,000 files, CSV report) | | ✓ |

**For developers and integrators:** a clean OpenAPI 3 contract with Swagger UI in every container, errors with official rule IDs and document positions, `/health` and `/license/status` for operations – and a partner program for system integrators who use Fakturum in client projects. Technical questions are answered directly by Fakturum's developer.

**Install:** download `fakturum-paid-<version>-amd64.tar.gz` (Intel/AMD) or
`-arm64.tar.gz` (ARM) from **Releases**, `docker load` it, run
`corbum-fakturum-api:<version>-paid` and mount the license file you get from one of our sales
partners as `/app/license.json`. Pro and Business are the same image –
the license file decides which plan is active.

---

Fakturum is part of **Corbum** – Engineering Regulatory Data.
Fragen zu Lizenz, Vertriebspartnern oder Integration / Questions about licenses, sales partners or integration: **info@corbum.de**
