# Fakturum local demo

A small web page that runs next to **your own** Fakturum container. You send
sample invoices (or your own) to the real API, see the answers, and copy the
matching `curl`, Python or Node.js code into your integration.

- Everything stays on your computer. The page talks only to the container on
  your machine; nothing is sent to us or anyone else.
- After the images are downloaded once, no internet connection is needed.
- It takes about five minutes, most of it the first download.

## 1. What you need

- **Docker** with Compose. Check it in a terminal:

  ```bash
  docker compose version
  ```

  If that prints a version, you're set. (Docker Desktop on Windows and macOS
  includes Compose. On an older Linux install it may be called
  `docker-compose`: use that name in all commands below.)
- A **web browser**.
- Optional, for convert / generate / batch / PDF: a **Pro or Business
  license** (`license.json`). Without one, the demo still validates XML
  invoices and shows the example calls for everything else.

## 2. Start the demo

Open a terminal **in this folder** (the one containing `docker-compose.yml`)
and run:

```bash
docker compose up -d
```

The first start downloads two small images (Fakturum Free and a web server).
When it's done, open **<http://localhost:8081>** in your browser.

You should see the page with two chips in the top right corner:
`version 1.0.x` and `plan: free`. That means it works.

> **Stop it** any time with `docker compose down` (run in the same folder).
> Start it again with `docker compose up -d`.

## 3. Take the five-minute tour

The page has four tabs. Each has a **Request** on the left, the **Response**
on the right, and a **"Use it in your code"** box below with the exact call as
`curl`, Python and Node.js (use the **Copy** button).

### Validate (works on Free)

1. Leave the sample on **Valid XRechnung (UBL)** and press **Validate**.
   Result: **VALID**, with the number of rules checked.
2. Pick **Invalid: unknown currency code** and press **Validate** again.
   Result: **INVALID**, and a table of every violated rule with its official
   rule ID (here `BR-CL-04`), the message and the position in the document.
3. Pick **Invalid: buyer reference missing**: a German XRechnung rule
   (`BR-DE-15`).
4. **Try your own invoice:** under "…or your own file" choose an XRechnung XML
   (or, with a Pro license, a ZUGFeRD / Factur-X PDF). Or edit the XML in the
   box and validate again.

Notice that an invalid invoice is a **normal answer** (HTTP 200 with
`"valid": false`), not an HTTP error. Your integration reads the `valid`
field and the `errors` list.

### Convert (Pro)

Pick a sample and press **Convert**: UBL becomes CII (or the other way
round). Then press **Validate the result** to check the converted document
with the same rules. **Download XML** saves it.

### Generate (Pro)

The box holds a JSON invoice: seller, buyer, line items, VAT. Press
**Generate XRechnung**.

- With **Complete invoice** you get **VALID** and a finished XRechnung XML.
- With **Incomplete invoice** the XML is still generated, but the checks
  list what an official XRechnung needs and the data doesn't have yet. Edit
  the JSON (add a field, change a price) and generate again.

A `200` from this endpoint means "generated"; whether the result is also
compliant is in `valid` / `errors`. Always check them.

### Batch (Business)

Many invoices as one job. Choose the operation (validate, convert or
generate), tick the sample files (or add your own), and press **Build ZIP and
submit**. The page packs the ZIP, submits it, shows the progress, and then a
result per file. **Download report.csv** and **Download result.zip** give you
the same files your own system would receive.

## 4. Use a Pro or Business license

Convert, generate, batch and PDF validation need a license. The tabs you
can't use yet show the example call instead of a form. To unlock them:

1. **Download the image** for your computer from the releases page
   (`fakturum-paid-<version>-amd64.tar.gz` for Intel/AMD, `…-arm64.tar.gz` for
   ARM, such as Apple Silicon or AWS Graviton) and load it:

   ```bash
   docker load -i fakturum-paid-<version>-amd64.tar.gz
   ```

   It prints the image name, for example
   `Loaded image: corbum-fakturum-api:1.0.11-paid`. Note that name.
2. **Copy your `license.json`** into the **`license`** folder next to
   `docker-compose.yml`. The file must be called exactly `license.json`.
3. **Restart the demo with that image** (replace the name with the one from
   step 1):

   macOS / Linux:

   ```bash
   FAKTURUM_IMAGE=corbum-fakturum-api:1.0.11-paid docker compose up -d --force-recreate
   ```

   Windows PowerShell:

   ```powershell
   $env:FAKTURUM_IMAGE = "corbum-fakturum-api:1.0.11-paid"
   docker compose up -d --force-recreate
   ```

4. **Reload the page.** The chip now says `plan: pro` or `plan: business`,
   and the tabs your license covers are open.

To go back to Free, run `docker compose up -d --force-recreate` without the
`FAKTURUM_IMAGE` setting.

## 5. Troubleshooting

| What you see | What it means / what to do |
| --- | --- |
| The page says **"container not reachable"** | The Fakturum container isn't running. In this folder run `docker compose ps` (both lines should say *running*) and `docker compose logs fakturum`. Then `docker compose up -d` again. |
| `docker compose up` says **a port is already in use** | Another program uses port 8081. Choose a free one: `DEMO_PORT=8090 docker compose up -d` (PowerShell: `$env:DEMO_PORT = "8090"` first) and open `http://localhost:8090`. |
| The chip says **plan: free** although you added a license | A license the container *rejects* is shown as a second chip with the reason. A license it can't *find* just stays at Free. Common reasons: the file isn't named exactly `license.json`, it's in the wrong folder (it must be in `license` next to `docker-compose.yml`), you didn't use `--force-recreate`, or you forgot `FAKTURUM_IMAGE`. The free image can't read a Pro license: use the downloaded image. |
| The chip says **license: version mismatch** | Your license is for a different major.minor version than the image (a `1.0` license works with any `1.0.x` image). Load the image that matches your license. |
| A tab says **"needs a Pro / Business license"** | Your plan doesn't include it. Convert, generate and PDF need Pro; batch needs Business. |
| **402 PLAN_REQUIRED** when validating the PDF sample | PDF validation needs Pro or Business. XML works on Free. |
| **413 DOCUMENT_TOO_COMPLEX / PAYLOAD_TOO_LARGE** | The document is larger or more complex than one request may be. Real invoices don't hit this; the container documentation (`RUNNING.md`) explains the limits and how to raise them. |
| `docker load` fails or says the file is invalid | The download was cut off. Check it against `SHA256SUMS` from the release page (`sha256sum -c SHA256SUMS --ignore-missing`) and download again. |
| Something else | `docker compose logs` shows what the containers say (it never contains your invoice data). Send it to info@corbum.de together with your Fakturum version. |

## 6. From demo to your own integration

You've now seen the three calls most integrations use:

1. **Validate** incoming or outgoing invoices: `POST /validate`, check
   `valid` and `errors`.
2. **Generate** XRechnung from your own invoice data: `POST /generate`,
   then check `valid` and `errors`, and store or send `document`
   (base64-encoded XML).
3. **Convert** between UBL and CII when a partner needs the other syntax:
   `POST /convert`.

In your own setup:

- The code boxes use `http://localhost:8080`, the container's own port. Point
  them at wherever your container runs.
- The full interactive reference is built into every container at
  `/docs` (a link is in the page footer).
- Fakturum has **no login**. Run it on a private network behind your own
  gateway, and don't publish its port to the internet. The container
  documentation (`RUNNING.md`, attached to every release) describes a hardened
  production start, sizing and limits.

## How the demo is put together

Two containers: Fakturum itself, which is **not** published on any port, and a
small web server that serves this page and forwards the page's calls to it.
Because the page and the API share one address, nothing needs special
browser permissions. The web server listens on this computer only
(`127.0.0.1`), because Fakturum has no login. The Fakturum container runs with
the hardened settings recommended for real deployments (read-only
filesystem, no extra privileges, memory limit).

The sample invoices are official examples from the KoSIT test suite and the
Mustangproject, plus two deliberately broken variants; see
`www/samples/NOTICE.txt`.
