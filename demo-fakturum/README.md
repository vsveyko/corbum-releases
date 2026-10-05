# Fakturum local demo

A small web page that runs next to your own Fakturum container, so you can
see what the API does and copy working code into your integration. It talks
only to the container on your machine — nothing is sent anywhere else, and
the demo needs no internet connection once the images are pulled.

What you can try:

| Tab | What it shows | Needs |
| --- | --- | --- |
| **Validate** | Send an XRechnung (UBL or CII) or a ZUGFeRD / Factur-X PDF and get every rule violation with its official rule ID | Free (PDF: Pro) |
| **Convert** | UBL ⇄ CII, then validate the result with one click | Pro |
| **Generate** | A JSON invoice in, a finished XRechnung out — with the checks run on it | Pro |
| **Batch** | Many invoices as one ZIP job: progress, a result per file, CSV report, result ZIP | Business |

Every tab shows the exact call as `curl`, Python and Node.js, ready to copy.
Tabs your license doesn't cover show the example call instead of a form.

## Start it (Free, validation only)

You need Docker with Compose. In this folder:

```bash
docker compose up -d
```

Open <http://localhost:8081>. Stop it with `docker compose down`.

## With your Pro or Business license

1. Download the image for your CPU from the releases page and load it:

   ```bash
   docker load < fakturum-paid-<version>-amd64.tar.gz     # or -arm64
   ```

2. Put the `license.json` you received from your sales partner into the
   `license` folder next to this file.
3. Start the demo with that image (the tag is the one `docker load` printed):

   ```bash
   FAKTURUM_IMAGE=corbum-fakturum-api:<version>-paid docker compose up -d
   ```

   On Windows PowerShell:

   ```powershell
   $env:FAKTURUM_IMAGE = "corbum-fakturum-api:<version>-paid"; docker compose up -d
   ```

The page shows the active plan in its top right corner. If the license isn't
accepted, the container still starts as Free and the page says why.

## Good to know

- The demo page is at `http://localhost:8081`; to use another port set
  `DEMO_PORT`. It listens on this machine only (`127.0.0.1`).
- Fakturum itself is **not** published on any port — it has no login, so only
  the demo's own web server can reach it. In your own setup, put it behind your
  gateway as described in `RUNNING.md`.
- The container here runs with the hardened settings recommended for real
  deployments (read-only filesystem, no extra privileges, memory limit).
- The container's own interactive API reference is linked in the page footer
  (`/docs`).
- The sample invoices are official examples from the KoSIT test suite and the
  Mustangproject, plus two deliberately broken variants; see
  `www/samples/NOTICE.txt`.
