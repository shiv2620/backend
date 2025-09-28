// generate_static_from_json.js
const fs = require('fs');
const path = require('path');

const INPUT = path.resolve(__dirname, 'candidates.json'); // your downloaded JSON
const OUT_DIR = path.resolve(__dirname, 'frontend', 'public', 'verify'); // adjust if needed

if (!fs.existsSync(INPUT)) {
  console.error('Error: candidates.json not found in project root.');
  process.exit(1);
}

const raw = fs.readFileSync(INPUT, 'utf-8');
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error('Error parsing candidates.json:', e.message);
  process.exit(1);
}

const candidates = parsed.data || parsed; // handle both {ok,data:[...]} and plain array
if (!Array.isArray(candidates) || candidates.length === 0) {
  console.error('No candidates found in JSON.');
  process.exit(1);
}

// Ensure output folder exists
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function sanitize(s) {
  if (!s) return '';
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateHtml(row) {
  const name = sanitize(row.name || '');
  const cid = sanitize(row.candidate_id || '');
  const job = sanitize(row.job_role || '');
  const qp = sanitize(row.qp_code || '');
  const grade = sanitize(row.grade || '');
  const issue = sanitize(row.issue_date || '');
  const expiry = sanitize(row.expiry_date || '');
  const documentId = sanitize(row.document_id || '');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Verify — ${cid}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;margin:0;padding:24px}
    .card{max-width:720px;margin:24px auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 6px 18px rgba(30,40,50,0.08)}
    h1{margin:0 0 12px;font-size:20px}
    .row{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0}
    .label{width:160px;font-weight:600;color:#333}
    .value{flex:1;color:#111}
    .note{margin-top:18px;color:#666;font-size:13px}
  </style>
</head>
<body>
  <div class="card">
    <h1>Certificate Verification</h1>

    <div class="row"><div class="label">Name:</div><div class="value">${name}</div></div>
    <div class="row"><div class="label">Candidate ID:</div><div class="value">${cid}</div></div>
    <div class="row"><div class="label">Job Role:</div><div class="value">${job}</div></div>
    <div class="row"><div class="label">QP Code:</div><div class="value">${qp}</div></div>
    <div class="row"><div class="label">Grade:</div><div class="value">${grade}</div></div>
    <div class="row"><div class="label">Issue Date:</div><div class="value">${issue}</div></div>
    <div class="row"><div class="label">Expiry Date:</div><div class="value">${expiry}</div></div>

    ${documentId ? `<p class="note"><b>Document ID:</b> ${documentId}</p>` : ''}
    <p class="note">This is a static verification page generated for instant access.</p>
  </div>
</body>
</html>`;
}

let count = 0;
for (const row of candidates) {
  const id = row.candidate_id || row.id || ('candidate_' + Math.random().toString(36).slice(2,8));
  const safeId = String(id).trim();
  if (!safeId) continue;

  const html = generateHtml(row);

  // 1) file: verify/<id>.html
  const filePath = path.join(OUT_DIR, `${safeId}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');

  // 2) folder: verify/<id>/index.html  (so /verify/<id> works)
  const folderPath = path.join(OUT_DIR, safeId);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  const indexPath = path.join(folderPath, 'index.html');
  fs.writeFileSync(indexPath, html, 'utf-8');

  count++;
  console.log(`Generated: ${safeId}.html  and ${safeId}/index.html`);
}

console.log(`\nDone. Generated ${count} candidate pages under:\n  ${OUT_DIR}`);
