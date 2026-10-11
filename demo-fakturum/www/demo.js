"use strict";

// Everything here talks to /api/*, which the demo's own web server forwards
// to the Fakturum container. No third-party requests, no libraries.

const API = "api";
const BASE = "http://localhost:8080"; // what the copyable code snippets use
const RANK = { free: 0, pro: 1, business: 2 };
const enc = new TextEncoder();
const dec = new TextDecoder();

const XML_SAMPLES = [
  { label: "Valid XRechnung (UBL)", url: "samples/valid-ubl.xml", name: "valid-ubl.xml", syntax: "ubl" },
  { label: "Valid XRechnung (CII)", url: "samples/valid-cii.xml", name: "valid-cii.xml", syntax: "cii" },
  { label: "Invalid: unknown currency code", url: "samples/invalid-currency.xml", name: "invalid-currency.xml", syntax: "ubl" },
  { label: "Invalid: buyer reference missing", url: "samples/invalid-no-buyer-reference.xml", name: "invalid-no-buyer-reference.xml", syntax: "ubl" },
];
const PDF_SAMPLE = { label: "ZUGFeRD PDF with embedded XML (Pro)", url: "samples/zugferd.pdf", name: "zugferd.pdf", binary: true };
const GEN_SAMPLES = [
  { label: "Complete invoice", url: "samples/generate.json", name: "generate.json" },
  { label: "Incomplete invoice (shows what the checks report)", url: "samples/generate-incomplete.json", name: "generate-incomplete.json" },
  { label: "Kleinunternehmer (§ 19 UStG, no VAT)", url: "samples/generate-kleinunternehmer.json", name: "generate-kleinunternehmer.json" },
];

const AI_PROMPT_URL = "ai/prompt.md";
const AI_SAMPLE_PDF = { url: "samples/rechnung-ohne-xml.pdf", name: "rechnung-ohne-xml.pdf" };
const AI_SAMPLE_ANSWER = { url: "samples/rechnung-ohne-xml.ai-answer.json" };

const state = { plan: "free", reachable: false };

// ---------- small helpers ----------

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function bytesToB64(bytes) {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shorten = (text, n = 60000) => (text.length > n ? text.slice(0, n) + "\n… (shortened, download for the full document)" : text);

function download(bytesOrText, filename, type) {
  const blob = bytesOrText instanceof Blob ? bytesOrText : new Blob([bytesOrText], { type });
  const a = h("a", { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  a.remove();
}

async function call(method, path, opts = {}) {
  const t0 = performance.now();
  const init = { method, headers: {} };
  if (opts.json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof opts.json === "string" ? opts.json : JSON.stringify(opts.json);
  }
  if (opts.form) init.body = opts.form;
  let res;
  try {
    res = await fetch(`${API}${path}`, init);
  } catch (e) {
    return { network: String(e.message || e) };
  }
  const ms = Math.round(performance.now() - t0);
  const type = res.headers.get("Content-Type") || "";
  let body;
  if (opts.binary && res.ok) body = new Uint8Array(await res.arrayBuffer());
  else if (type.includes("json")) body = await res.json().catch(() => null);
  else body = await res.text();
  return { status: res.status, ms, body, type };
}

// ---------- views ----------

function card(title, ...content) {
  return h("div", { class: "card" }, title ? h("h2", {}, title) : null, ...content);
}

function rawJson(obj) {
  return h("details", {}, h("summary", {}, "Raw JSON response"), h("pre", {}, JSON.stringify(obj, null, 2)));
}

function statusLine(method, path, res) {
  return h("div", { class: "line" },
    h("code", {}, `${method} ${path}`), " → ",
    h("span", { class: res.status < 300 ? "ok" : "bad" }, res.status), ` · ${res.ms} ms`);
}

function issueTable(issues) {
  return h("table", {},
    h("thead", {}, h("tr", {}, h("th", {}, "Severity"), h("th", {}, "Rule"), h("th", {}, "Message"))),
    h("tbody", {}, issues.map((i) => h("tr", {},
      h("td", { class: "sev " + i.severity }, i.severity),
      h("td", {}, h("code", {}, i.code)),
      h("td", {}, i.message, i.xpath ? h("small", {}, i.xpath) : null)))));
}

function errorView(res) {
  if (res.network) {
    return [h("div", { class: "verdict invalid" }, "No answer"),
      h("p", { class: "meta" }, "Could not reach the container: " + res.network)];
  }
  const e = res.body && res.body.error;
  return [
    h("div", { class: "verdict info" }, `HTTP ${res.status}`),
    h("p", { class: "meta" }, e ? `${e.code}: ${e.message}` : String(res.body)),
    e && e.upgradeUrl ? h("p", { class: "hint" }, "This needs a higher plan.") : null,
    res.body && typeof res.body === "object" ? rawJson(res.body) : null,
  ].filter(Boolean);
}

// The same view serves /validate and /generate: both return valid + errors + warnings.
function validationView(method, path, res) {
  const out = [res.network ? null : statusLine(method, path, res)];
  const b = res.body;
  if (res.network || res.status !== 200 || !b || typeof b !== "object" || !("valid" in b)) {
    return [...out.filter(Boolean), ...errorView(res)];
  }
  const meta = [`${b.errors.length} error(s)`, `${b.warnings.length} warning(s)`];
  if (b.rulesChecked != null) meta.push(`${b.rulesChecked} checks`);
  if (b.format) meta.push(`format ${b.format}`);
  if (b.profile) meta.push(b.profile);
  out.push(h("div", { class: "verdict " + (b.valid ? "valid" : "invalid") }, b.valid ? "VALID" : "INVALID"));
  out.push(h("p", { class: "meta" }, meta.join(" · ")));
  const issues = [...b.errors, ...b.warnings];
  if (issues.length) out.push(issueTable(issues));
  out.push(rawJson(b));
  return out.filter(Boolean);
}

function xmlResultBox(xmlBytes, filename) {
  const text = dec.decode(xmlBytes);
  return h("div", {},
    h("div", { class: "row" },
      h("button", { class: "small", type: "button", onclick: () => download(xmlBytes, filename, "application/xml") }, "Download XML")),
    h("pre", {}, shorten(text)));
}

// "Embed into your PDF" (POST /embed): the generated XML plus the user's own
// PDF/A become a ZUGFeRD / Factur-X PDF. A refusal explains itself (what,
// why, how to fix, findings); CONTENT_NOT_COMPARED is shown as a prominent
// block, never as small print.
function embedBox(xmlB64, baseName) {
  const file = h("input", { type: "file", accept: ".pdf,application/pdf" });
  const btn = h("button", { class: "small", type: "button", disabled: true }, "Embed into my PDF");
  const out = h("div", {});
  file.addEventListener("change", () => { btn.disabled = !file.files[0]; });
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const pdf = new Uint8Array(await file.files[0].arrayBuffer());
    const res = await call("POST", "/embed", { json: { pdf: bytesToB64(pdf), xml: xmlB64 } });
    const b = res.body;
    if (res.status === 200 && b && b.document) {
      const name = (file.files[0].name.replace(/\.pdf$/i, "") || baseName) + "-zugferd.pdf";
      out.replaceChildren(
        statusLine("POST", "/embed", res),
        h("div", { class: "verdict valid" }, "EMBEDDED"),
        h("p", { class: "meta" }, `${b.embeddedFileName} · ${b.conformanceLevel} · your PDF/A-${b.pdfaInput} is now PDF/A-3` + (b.convertedFromUbl ? " · UBL converted to CII" : "")),
        ...b.notices.filter((n) => n.code === "CONTENT_NOT_COMPARED").map((n) => h("div", { class: "notice-block" }, h("strong", {}, "Not compared: "), n.message)),
        h("div", { class: "row" }, h("button", { class: "primary", type: "button", onclick: () => download(b64ToBytes(b.document), name, "application/pdf") }, "Download " + name)),
        h("p", { class: "hint" }, "Check it any time in the Validate tab: it reads the invoice back out of the PDF."));
    } else if (b && b.error && b.error.reason) {
      out.replaceChildren(
        statusLine("POST", "/embed", res),
        h("div", { class: "verdict invalid" }, b.error.message),
        h("p", {}, h("strong", {}, "Why: "), b.error.reason),
        b.error.findings && b.error.findings.length ? h("ul", { class: "review warn" }, b.error.findings.map((f) => h("li", {}, f))) : null,
        h("strong", {}, "What to do:"),
        h("ol", { class: "review" }, b.error.fix.map((f) => h("li", {}, f))));
    } else {
      out.replaceChildren(statusLine("POST", "/embed", res), ...errorView(res));
    }
    btn.disabled = false;
  });
  return h("div", { class: "embed-box" },
    h("h2", {}, "Embed into your PDF (ZUGFeRD / Factur-X)"),
    h("p", { class: "hint" }, "Choose the invoice PDF people read. It must be saved as PDF/A (Word: \"PDF/A compliant\"; LibreOffice: \"Archive (PDF/A)\"). Fakturum adds the XML to it and changes nothing else."),
    h("div", { class: "row" }, file, btn),
    out);
}

// ---------- code snippets ----------

function snippetBox(snips) {
  const names = [["curl", "curl"], ["python", "Python"], ["node", "Node.js"]];
  const pre = h("pre", {});
  const copy = h("button", { class: "small", type: "button" }, "Copy");
  const buttons = {};
  let current = "curl";
  function select(k) {
    current = k;
    pre.textContent = snips[k];
    for (const [id, b] of Object.entries(buttons)) b.classList.toggle("sel", id === k);
  }
  const tabs = h("div", { class: "snippet-tabs" });
  for (const [id, label] of names) {
    buttons[id] = h("button", { class: "small", type: "button", onclick: () => select(id) }, label);
    tabs.append(buttons[id]);
  }
  tabs.append(h("span", { class: "spacer" }), copy);
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(snips[current]);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select and copy";
    }
    setTimeout(() => (copy.textContent = "Copy"), 1400);
  });
  select("curl");
  return h("div", {}, tabs, pre);
}

const SNIPPETS = {
  validate: {
    curl: `DOC=$(base64 -w0 invoice.xml)     # or invoice.pdf (Pro: ZUGFeRD / Factur-X)
curl -s -X POST ${BASE}/validate \\
  -H "Content-Type: application/json" \\
  -d "{\\"document\\":\\"\${DOC}\\",\\"format\\":\\"auto\\"}"`,
    python: `import base64, requests

doc = base64.b64encode(open("invoice.xml", "rb").read()).decode()
r = requests.post("${BASE}/validate", json={"document": doc, "format": "auto"})
result = r.json()
print(result["status"], [e["code"] for e in result["errors"]])`,
    node: `import { readFileSync } from "node:fs";

const document = readFileSync("invoice.xml").toString("base64");
const r = await fetch("${BASE}/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ document, format: "auto" }),
});
const result = await r.json();
console.log(result.status, result.errors.map((e) => e.code));`,
  },
  convert: {
    curl: `DOC=$(base64 -w0 invoice-ubl.xml)
curl -s -X POST ${BASE}/convert \\
  -H "Content-Type: application/json" \\
  -d "{\\"document\\":\\"\${DOC}\\",\\"to\\":\\"xrechnung-cii\\"}" \\
  | jq -r .document | base64 -d > invoice-cii.xml`,
    python: `import base64, requests

doc = base64.b64encode(open("invoice-ubl.xml", "rb").read()).decode()
r = requests.post("${BASE}/convert", json={"document": doc, "to": "xrechnung-cii"})
open("invoice-cii.xml", "wb").write(base64.b64decode(r.json()["document"]))`,
    node: `import { readFileSync, writeFileSync } from "node:fs";

const document = readFileSync("invoice-ubl.xml").toString("base64");
const r = await fetch("${BASE}/convert", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ document, to: "xrechnung-cii" }),
});
writeFileSync("invoice-cii.xml", Buffer.from((await r.json()).document, "base64"));`,
  },
  generate: {
    curl: `curl -s -X POST ${BASE}/generate \\
  -H "Content-Type: application/json" \\
  -d @invoice.json \\
  | tee response.json | jq '{valid, errors: [.errors[].code]}'
jq -r .document response.json | base64 -d > xrechnung.xml`,
    python: `import base64, json, requests

payload = json.load(open("invoice.json"))
r = requests.post("${BASE}/generate", json=payload).json()
print(r["valid"], [e["code"] for e in r["errors"]])
open("xrechnung.xml", "wb").write(base64.b64decode(r["document"]))`,
    node: `import { readFileSync, writeFileSync } from "node:fs";

const r = await fetch("${BASE}/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: readFileSync("invoice.json"),
});
const result = await r.json();
console.log(result.valid, result.errors.map((e) => e.code));
writeFileSync("xrechnung.xml", Buffer.from(result.document, "base64"));`,
  },
  ai: {
    curl: `# answer.json = what the AI returned for the PDF + prompt (ai/prompt.md)
jq '.review' answer.json                      # read this first: missing / assumptions
jq '.generateRequest' answer.json \\
  | curl -s -X POST ${BASE}/generate -H "Content-Type: application/json" -d @- \\
  | tee response.json | jq '{valid, errors: [.errors[] | "\\(.code): \\(.message)"]}'
jq -r .document response.json | base64 -d > xrechnung.xml`,
    python: `import base64, json, requests

PROMPT = open("fakturum-ai-prompt.md", encoding="utf-8").read()

def ask_ai(messages, pdf_bytes):
    """Call the AI provider you are allowed to use; return its text answer."""
    raise NotImplementedError

pdf = open("rechnung.pdf", "rb").read()
messages = [PROMPT]
for attempt in range(3):                      # at most 3 rounds, then a person decides
    answer = json.loads(ask_ai(messages, pdf).strip().strip("\`").removeprefix("json"))
    if answer["generateRequest"] is None:     # e.g. Kleinunternehmer: not convertible
        break
    r = requests.post("${BASE}/generate", json=answer["generateRequest"]).json()
    if r["valid"] and not r["warnings"]:
        break
    issues = "\\n".join(f'- {i["code"]}: {i["message"]}' for i in r["errors"] + r["warnings"])
    messages.append(f"Fakturum reported:\\n{issues}\\nFix what the invoice supports, "
                    "list the rest under review.missing, answer in the same JSON format.")

print(json.dumps(answer["review"], indent=2, ensure_ascii=False))  # a person reads this
if answer["generateRequest"] is not None:
    open("xrechnung.xml", "wb").write(base64.b64decode(r["document"]))`,
    node: `import { readFileSync, writeFileSync } from "node:fs";

// answer.json = what the AI returned for the PDF + prompt (ai/prompt.md)
const answer = JSON.parse(readFileSync("answer.json", "utf8"));
console.log(answer.review);                   // a person reads this first
if (answer.generateRequest) {
  const r = await fetch("${BASE}/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answer.generateRequest),
  });
  const result = await r.json();
  console.log(result.valid, result.errors.map((e) => \`\${e.code}: \${e.message}\`));
  writeFileSync("xrechnung.xml", Buffer.from(result.document, "base64"));
}`,
  },
  batch: {
    curl: `curl -s -X POST ${BASE}/batch \\
  -F "file=@invoices.zip" -F "operation=validate" -F "output=both"
# -> {"status":"queued","jobId":"…"}
curl -s ${BASE}/batch/<jobId>                    # poll: queued / processing / done / failed
curl -s ${BASE}/batch/<jobId>/report/json        # results per file
curl -s ${BASE}/batch/<jobId>/report/csv   -o report.csv
curl -s ${BASE}/batch/<jobId>/result/zip   -o result.zip`,
    python: `import time, requests

job = requests.post("${BASE}/batch",
                    files={"file": open("invoices.zip", "rb")},
                    data={"operation": "validate", "output": "both"}).json()["jobId"]
while (st := requests.get(f"${BASE}/batch/{job}").json())["status"] in ("queued", "processing"):
    time.sleep(1)
report = requests.get(f"${BASE}/batch/{job}/report/json").json()
print(report["valid"], "valid,", report["invalid"], "invalid")`,
    node: `import { openAsBlob } from "node:fs";

const form = new FormData();
form.set("file", await openAsBlob("invoices.zip"), "invoices.zip");
form.set("operation", "validate");
form.set("output", "both");
const { jobId } = await (await fetch("${BASE}/batch", { method: "POST", body: form })).json();

let st;
do {
  await new Promise((r) => setTimeout(r, 1000));
  st = await (await fetch(\`${BASE}/batch/\${jobId}\`)).json();
} while (st.status === "queued" || st.status === "processing");
console.log(await (await fetch(\`${BASE}/batch/\${jobId}/report/json\`)).json());`,
  },
};

// ---------- inputs ----------

// A sample picker + editable text area + file chooser. get() returns the bytes
// that would be sent.
function docInput({ samples, accept, rows = 16 }) {
  const input = { binary: null };
  const sel = h("select", {}, samples.map((s, i) => h("option", { value: i }, s.label)));
  const ta = h("textarea", { spellcheck: "false", rows });
  const file = h("input", { type: "file", accept });

  function setBinary(bytes, name) {
    input.binary = bytes;
    ta.value = "";
    ta.disabled = true;
    ta.placeholder = `(binary file ${name}, ${bytes.length} bytes)`;
  }
  function setText(text) {
    input.binary = null;
    ta.disabled = false;
    ta.placeholder = "";
    ta.value = text;
  }
  async function loadSample(i) {
    const s = samples[i];
    const r = await fetch(s.url);
    if (s.binary) setBinary(new Uint8Array(await r.arrayBuffer()), s.name);
    else setText(await r.text());
    ta.dispatchEvent(new Event("sampleloaded"));
  }
  sel.addEventListener("change", () => loadSample(+sel.value));
  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    if (buf[0] === 0x25 && buf[1] === 0x50) setBinary(buf, f.name); // "%P" of %PDF
    else setText(dec.decode(buf));
    ta.dispatchEvent(new Event("sampleloaded"));
  });

  const el = h("div", {},
    h("div", { class: "row" }, h("label", {}, "Sample"), sel),
    ta,
    h("div", { class: "row", style: "margin-top:8px" }, h("label", {}, "…or your own file"), file));
  loadSample(0);
  return { el, ta, sel, get: () => input.binary || enc.encode(ta.value) };
}

// ---------- tabs ----------

function grid(left, right) {
  return h("div", { class: "grid" }, left, right);
}
function codeCard(key) {
  return h("div", { style: "margin-top:16px" }, card("Use it in your code", snippetBox(SNIPPETS[key])));
}
function placeholder(text) {
  return h("div", { class: "resp" }, h("p", { class: "hint" }, text));
}

function validateTab() {
  const input = docInput({ samples: [...XML_SAMPLES, PDF_SAMPLE], accept: ".xml,.pdf,application/xml,application/pdf" });
  const result = placeholder("Send a document to see the result.");
  const btn = h("button", { class: "primary", type: "button" }, "Validate");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const res = await call("POST", "/validate", { json: { document: bytesToB64(input.get()), format: "auto" } });
    result.replaceChildren(...validationView("POST", "/validate", res));
    btn.disabled = false;
  });
  return h("div", {},
    grid(card("Request", input.el, h("div", { class: "row", style: "margin-top:10px" }, btn)), card("Response", result)),
    codeCard("validate"));
}

function convertTab() {
  const input = docInput({ samples: XML_SAMPLES.slice(0, 2), accept: ".xml,application/xml" });
  const target = h("select", {}, h("option", { value: "xrechnung-cii" }, "XRechnung CII"), h("option", { value: "xrechnung-ubl" }, "XRechnung UBL"));
  const syncTarget = () => { target.value = /CrossIndustryInvoice/.test(input.ta.value) ? "xrechnung-ubl" : "xrechnung-cii"; };
  input.ta.addEventListener("sampleloaded", syncTarget);
  const result = placeholder("Convert a document to see the result.");
  const btn = h("button", { class: "primary", type: "button" }, "Convert");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const res = await call("POST", "/convert", { json: { document: bytesToB64(input.get()), to: target.value } });
    if (res.status === 200 && res.body && res.body.document) {
      const xml = b64ToBytes(res.body.document);
      const check = h("div", {});
      const verify = h("button", { class: "small", type: "button" }, "Validate the result");
      verify.addEventListener("click", async () => {
        verify.disabled = true;
        const v = await call("POST", "/validate", { json: { document: res.body.document, format: "auto" } });
        check.replaceChildren(h("hr"), ...validationView("POST", "/validate", v));
      });
      result.replaceChildren(statusLine("POST", "/convert", res),
        h("div", { class: "verdict valid" }, `CONVERTED to ${res.body.to}`),
        h("div", { class: "row", style: "margin-top:10px" }, verify),
        check, xmlResultBox(xml, `converted-${res.body.to}.xml`));
    } else {
      result.replaceChildren(statusLine("POST", "/convert", res), ...errorView(res));
    }
    btn.disabled = false;
  });
  return h("div", {},
    grid(card("Request", input.el, h("div", { class: "row", style: "margin-top:10px" }, h("label", {}, "Convert to"), target, btn)), card("Response", result)),
    codeCard("convert"));
}

function generateTab() {
  const input = docInput({ samples: GEN_SAMPLES, accept: ".json,application/json", rows: 22 });
  const format = h("select", {}, h("option", { value: "xrechnung-ubl" }, "XRechnung UBL"), h("option", { value: "xrechnung-cii" }, "XRechnung CII"));
  format.addEventListener("change", () => {
    try {
      const j = JSON.parse(input.ta.value);
      j.format = format.value;
      input.ta.value = JSON.stringify(j, null, 2) + "\n";
    } catch { /* not valid JSON right now: leave the text alone */ }
  });
  input.ta.addEventListener("sampleloaded", () => {
    try { format.value = JSON.parse(input.ta.value).format || "xrechnung-ubl"; } catch { /* keep */ }
  });
  const result = placeholder("Generate an invoice to see the result.");
  const btn = h("button", { class: "primary", type: "button" }, "Generate XRechnung");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const res = await call("POST", "/generate", { json: input.ta.value });
    const view = validationView("POST", "/generate", res);
    if (res.status === 200 && res.body && res.body.document) {
      view.push(h("h2", { style: "margin-top:14px" }, "Generated document"));
      view.push(xmlResultBox(b64ToBytes(res.body.document), "xrechnung-generated.xml"));
      view.push(embedBox(res.body.document, "invoice"));
    }
    result.replaceChildren(...view);
    btn.disabled = false;
  });
  return h("div", {},
    grid(card("Request (JSON)", input.el, h("div", { class: "row", style: "margin-top:10px" }, h("label", {}, "Output format"), format, btn)),
      card("Response", result, h("p", { class: "hint" }, "A 200 means the document was generated. Whether it also satisfies every XRechnung rule is in valid / errors — check them."))),
    codeCard("generate"));
}

// ---------- PDF → XRechnung with an AI assistant ----------

// The AI's answer is { generateRequest, review } (see ai/prompt.md). Accept it
// with or without a ```json fence or chatter around it, or a bare request.
function parseAIAnswer(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object found in the answer.");
  const obj = JSON.parse(text.slice(start, end + 1));
  if ("generateRequest" in obj || "review" in obj) return { request: obj.generateRequest, review: obj.review || {} };
  return { request: obj, review: {} };
}

function reviewView(review) {
  const out = [];
  const list = (title, items, cls) => items && items.length
    ? [h("h2", { style: "margin-top:12px" }, title), h("ul", { class: "review " + cls }, items.map((i) => h("li", {}, i)))]
    : [];
  out.push(...list("Stops the conversion", review.unsupported, "bad"));
  out.push(...list("Missing on the invoice: ask for it, don't invent it", review.missing, "warn"));
  out.push(...list("What the AI converted or chose: check it", review.assumptions, ""));
  const t = review.totals;
  if (t && t.invoice && t.calculated) {
    const same = ["net", "vat", "gross"].every((k) => Math.abs((t.invoice[k] || 0) - (t.calculated[k] || 0)) < 0.015);
    out.push(h("p", { class: "meta" },
      h("span", { class: "verdict " + (same ? "valid" : "invalid") }, same ? "TOTALS MATCH" : "TOTALS DIFFER"),
      ` invoice ${t.invoice.gross} · recalculated ${t.calculated.gross} (gross)`));
  }
  return out;
}

// What to send back to the AI when Fakturum still finds something (prompt §6).
function followUp(body) {
  const lines = [...body.errors, ...body.warnings].map((i) => `- ${i.severity} ${i.code}: ${i.message}`);
  return "Fakturum checked your generateRequest and reported:\n" + lines.join("\n") +
    "\n\nFix what the invoice supports, list the rest under review.missing (never invent values), and answer again in the same JSON format.";
}

function aiTab() {
  const promptText = fetch(AI_PROMPT_URL).then((r) => r.text());
  const copyPrompt = h("button", { class: "small", type: "button" }, "Copy prompt");
  copyPrompt.addEventListener("click", async () => {
    await navigator.clipboard.writeText(await promptText);
    copyPrompt.textContent = "Copied ✓";
    setTimeout(() => { copyPrompt.textContent = "Copy prompt"; }, 1500);
  });
  const promptPre = h("pre", {});
  promptText.then((t) => { promptPre.textContent = t; });

  const answer = h("textarea", { spellcheck: "false", rows: 16, placeholder: "Paste the AI's answer here (the JSON with generateRequest and review)." });
  const loadExample = h("button", { class: "small", type: "button" }, "Load the example answer");
  loadExample.addEventListener("click", async () => { answer.value = await (await fetch(AI_SAMPLE_ANSWER.url)).text(); });

  const result = placeholder("Paste an answer and press the button to see what Fakturum makes of it.");
  const btn = h("button", { class: "primary", type: "button" }, "Check and generate XRechnung");
  btn.addEventListener("click", async () => {
    let parsed;
    try {
      parsed = parseAIAnswer(answer.value);
    } catch (e) {
      result.replaceChildren(h("div", { class: "verdict invalid" }, "Not readable"), h("p", { class: "meta" }, String(e.message || e)));
      return;
    }
    const review = reviewView(parsed.review);
    if (!parsed.request) {
      result.replaceChildren(h("div", { class: "verdict info" }, "NOT CONVERTED"),
        h("p", { class: "meta" }, "The AI found something this conversion can't carry (see below). Nothing was sent to Fakturum."), ...review);
      return;
    }
    btn.disabled = true;
    const res = await call("POST", "/generate", { json: parsed.request });
    const view = validationView("POST", "/generate", res);
    if (res.status === 200 && res.body && res.body.document) {
      if (res.body.errors.length || res.body.warnings.length) {
        const copy = h("button", { class: "small", type: "button" }, "Copy follow-up for the AI");
        copy.addEventListener("click", async () => {
          await navigator.clipboard.writeText(followUp(res.body));
          copy.textContent = "Copied ✓";
        });
        view.push(h("div", { class: "row" }, copy,
          h("span", { class: "hint" }, "Paste it into the same chat: the AI fixes what the PDF supports and lists the rest.")));
      }
      view.push(h("h2", { style: "margin-top:14px" }, "Generated document"));
      view.push(xmlResultBox(b64ToBytes(res.body.document), `xrechnung-${(parsed.request.invoice && parsed.request.invoice.number) || "generated"}.xml`));
      view.push(embedBox(res.body.document, (parsed.request.invoice && parsed.request.invoice.number) || "invoice"));
    }
    result.replaceChildren(...review, h("hr"), ...view);
    btn.disabled = false;
  });

  const steps = card("1 · Give your AI assistant the PDF and the prompt",
    h("p", { class: "hint" },
      "Any assistant that reads PDFs works (ChatGPT, Claude, Gemini, Copilot, or a model you run yourself). Attach the invoice PDF, paste the prompt, send. " +
      "It answers with the request for /generate plus a review: what it found, what it converted, and what the invoice doesn't say."),
    h("div", { class: "row" }, copyPrompt,
      h("button", { class: "small", type: "button", onclick: async () => download(await promptText, "fakturum-ai-prompt.md", "text/markdown") }, "Download prompt"),
      h("button", { class: "small", type: "button", onclick: async () => download(new Uint8Array(await (await fetch(AI_SAMPLE_PDF.url)).arrayBuffer()), AI_SAMPLE_PDF.name, "application/pdf") }, "Sample PDF to try")),
    h("details", {}, h("summary", {}, "Show the prompt"), promptPre),
    h("p", { class: "note" },
      "Data protection: the PDF goes to your AI provider, not through this page and not to Fakturum's makers. " +
      "Use a provider your data protection rules allow for invoices (a data processing agreement, or a local model). " +
      "If the PDF already is a ZUGFeRD / Factur-X e-invoice, you don't need an AI: validate it in the Validate tab."),
    h("h2", { style: "margin-top:16px" }, "2 · Paste the AI's answer"),
    h("div", { class: "row" }, loadExample, h("span", { class: "hint" }, "(what a correct answer for the sample PDF looks like)")),
    answer,
    h("div", { class: "row", style: "margin-top:10px" }, btn));

  return h("div", {},
    grid(steps, card("3 · Check the result", result,
      h("p", { class: "hint" }, "The AI only types the data in; Fakturum checks it against the official XRechnung rules. Read the review before you send the invoice: a person stays responsible for its content."))),
    codeCard("ai"));
}

// A store-only ZIP writer (no compression), enough to hand the batch endpoint a ZIP.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeZip(files) {
  const chunks = [];
  const central = [];
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
    lh.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  }
  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

function batchTab() {
  const operation = h("select", {},
    h("option", { value: "validate" }, "validate"), h("option", { value: "convert" }, "convert"), h("option", { value: "generate" }, "generate"));
  const target = h("select", {}, h("option", { value: "xrechnung-cii" }, "xrechnung-cii"), h("option", { value: "xrechnung-ubl" }, "xrechnung-ubl"));
  const output = h("select", {}, h("option", { value: "both" }, "both"), h("option", { value: "report" }, "report"), h("option", { value: "zip" }, "zip"));
  const own = h("input", { type: "file", multiple: true });
  const checks = h("div", { class: "checks" });
  const result = placeholder("Pack some invoices into a ZIP and submit them as one job.");
  const btn = h("button", { class: "primary", type: "button" }, "Build ZIP and submit");

  function renderChecks() {
    const samples = operation.value === "generate" ? GEN_SAMPLES : XML_SAMPLES;
    // Converting a document into the syntax it already has is an error, so for
    // convert only the samples in the *other* syntax are ticked to begin with.
    const wanted = (s) => operation.value !== "convert" || s.syntax !== target.value.replace("xrechnung-", "");
    checks.replaceChildren(...samples.map((s, i) => h("label", {}, h("input", { type: "checkbox", checked: wanted(s), "data-i": i }), " " + s.label)));
    target.disabled = operation.value !== "convert";
  }
  operation.addEventListener("change", renderChecks);
  target.addEventListener("change", renderChecks);
  renderChecks();

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const samples = operation.value === "generate" ? GEN_SAMPLES : XML_SAMPLES;
      const files = [];
      for (const cb of checks.querySelectorAll("input:checked")) {
        const s = samples[+cb.dataset.i];
        files.push({ name: s.name, data: new Uint8Array(await (await fetch(s.url)).arrayBuffer()) });
      }
      for (const f of own.files) files.push({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) });
      if (!files.length) { result.replaceChildren(h("p", { class: "hint" }, "Select at least one file.")); return; }

      const form = new FormData();
      form.append("file", makeZip(files), "batch.zip");
      form.append("operation", operation.value);
      if (operation.value === "convert") form.append("target_format", target.value);
      form.append("output", output.value);

      const created = await call("POST", "/batch", { form });
      if (created.status !== 202) { result.replaceChildren(statusLine("POST", "/batch", created), ...errorView(created)); return; }
      const id = created.body.jobId;
      const bar = h("div", {}, h("div", { class: "progress" }, h("div", {})), h("div", { class: "hint" }));
      result.replaceChildren(statusLine("POST", "/batch", created), h("div", { class: "meta" }, `Job ${id}`), bar);

      let st;
      do {
        await sleep(350);
        st = await call("GET", `/batch/${id}`);
        const p = st.body && st.body.progress;
        if (p) {
          bar.firstChild.firstChild.style.width = (p.total ? (100 * p.processed) / p.total : 0) + "%";
          bar.lastChild.textContent = `${st.body.status}: ${p.processed} / ${p.total} files`;
        }
      } while (st.body && (st.body.status === "queued" || st.body.status === "processing"));

      if (!st.body || st.body.status === "failed") {
        result.append(h("div", { class: "verdict invalid" }, "JOB FAILED"),
          h("p", { class: "meta" }, (st.body && st.body.error) || "unknown reason"));
        return;
      }
      const rep = await call("GET", `/batch/${id}/report/json`);
      const r = rep.body;
      if (rep.status !== 200 || !r || !r.results) { result.replaceChildren(statusLine("GET", `/batch/${id}/report/json`, rep), ...errorView(rep)); return; }
      const rows = r.results.map((x) => h("tr", {},
        h("td", {}, h("code", {}, x.file)),
        h("td", { class: "sev " + (x.valid ? "info" : "error") }, x.valid ? "valid" : "invalid"),
        h("td", {}, x.format || ""),
        h("td", {}, (x.errors || []).map((e) => e.code).join(", "))));
      const dl = h("div", { class: "row" });
      if (output.value !== "zip") dl.append(h("button", { class: "small", type: "button", onclick: async () => {
        const c = await call("GET", `/batch/${id}/report/csv`);
        download(c.body, "report.csv", "text/csv");
      } }, "Download report.csv"));
      if (output.value !== "report") dl.append(h("button", { class: "small", type: "button", onclick: async () => {
        const z = await call("GET", `/batch/${id}/result/zip`, { binary: true });
        if (z.body instanceof Uint8Array) download(z.body, "result.zip", "application/zip");
      } }, "Download result.zip"));
      result.replaceChildren(statusLine("GET", `/batch/${id}/report/json`, rep),
        h("div", { class: "verdict " + (r.invalid ? "invalid" : "valid") }, `${r.valid} VALID · ${r.invalid} INVALID`),
        h("p", { class: "meta" }, `${r.total} file(s)` + (r.byFormat ? " · " + Object.entries(r.byFormat).map(([k, v]) => `${v}× ${k}`).join(", ") : "")),
        h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "File"), h("th", {}, "Result"), h("th", {}, "Format"), h("th", {}, "Errors"))), h("tbody", {}, rows)),
        dl, rawJson(r));
    } finally {
      btn.disabled = false;
    }
  });

  return h("div", {},
    grid(card("Request", h("div", { class: "row" }, h("label", {}, "Operation"), operation, h("label", {}, "Convert to"), target, h("label", {}, "Output"), output),
      h("p", { class: "note" }, "The page builds a ZIP from the files you tick and uploads it as one job."),
      checks, h("div", { class: "row" }, h("label", {}, "…and your own files"), own), h("div", { class: "row" }, btn)),
      card("Result", result)),
    codeCard("batch"));
}

const TABS = [
  { id: "validate", title: "Validate", needs: "free", build: validateTab },
  { id: "convert", title: "Convert", needs: "pro", build: convertTab },
  { id: "generate", title: "Generate", needs: "pro", build: generateTab },
  { id: "ai", title: "PDF → XRechnung (AI)", needs: "pro", build: aiTab },
  { id: "batch", title: "Batch", needs: "business", build: batchTab },
];

function lockedView(tab) {
  const plan = tab.needs === "business" ? "Business" : "Pro";
  return h("div", {},
    card("", h("div", { class: "locked-card" },
      h("h2", {}, `${tab.title} needs a ${plan} license`),
      h("p", { class: "hint" }, "Your container is running without one for this plan. Put your license.json into the demo's license folder and restart (see README) — the page picks it up automatically. Until then, here is what the call looks like:"))),
    codeCard(tab.id));
}

// ---------- startup ----------

function select(tab) {
  for (const b of $all("#tabs button")) b.setAttribute("aria-selected", String(b.dataset.id === tab.id));
  const locked = !state.reachable ? false : RANK[state.plan] < RANK[tab.needs];
  document.getElementById("panel").replaceChildren(locked ? lockedView(tab) : tab.build());
}
const $all = (s) => [...document.querySelectorAll(s)];

async function init() {
  const status = document.getElementById("status");
  const [health, lic] = await Promise.all([call("GET", "/health"), call("GET", "/license/status")]);
  state.reachable = !health.network && health.status === 200;

  if (!state.reachable) {
    status.replaceChildren(h("span", { class: "chip bad" }, "container not reachable"));
    const n = document.getElementById("notice");
    n.hidden = false;
    n.textContent = "The Fakturum container does not answer. Is `docker compose up` running? You can still look at the example calls below.";
  } else {
    state.plan = (lic.body && lic.body.plan) || "free";
    const chips = [h("span", { class: "chip" }, "version " + (health.body.version || "?")),
      h("span", { class: "chip " + (state.plan === "free" ? "warn" : "good") }, "plan: " + state.plan)];
    // "file not found" is the normal Free case and the notice below says it already.
    if (lic.body && lic.body.warning && !/file not found/.test(lic.body.warning)) chips.push(h("span", { class: "chip warn" }, lic.body.warning));
    status.replaceChildren(...chips);
    if (state.plan === "free") {
      const n = document.getElementById("notice");
      n.hidden = false;
      n.textContent = "Running as Free: validation works. Convert, generate and batch need a Pro or Business license (mount license.json, see README).";
    }
  }

  const nav = document.getElementById("tabs");
  for (const tab of TABS) {
    const locked = state.reachable && RANK[state.plan] < RANK[tab.needs];
    nav.append(h("button", { type: "button", role: "tab", "data-id": tab.id, class: locked ? "locked" : "", onclick: () => select(tab) },
      tab.title, tab.needs !== "free" ? h("span", { class: "badge" }, tab.needs === "pro" ? "Pro" : "Business") : null));
  }
  select(TABS[0]);
}

init();
