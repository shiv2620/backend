// generate_static_from_json.js
const fs = require('fs');
const path = require('path');

// === CONFIG ===
// Your candidates JSON
const INPUT = path.resolve(__dirname, 'candidates.json'); 

// Output folder for HTML pages
const OUT_DIR = path.resolve(__dirname, 'frontend', 'public', 'verify'); 

// Hostinger CSS URL
const HOSTINGER_CSS_URL = 'https://skillindiadigital.org/static/css/main.440362b9.css'; // CHANGE to your domain and CSS filename

// === VALIDATION ===
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

const candidates = parsed.data || parsed;
if (!Array.isArray(candidates) || candidates.length === 0) {
  console.error('No candidates found in JSON.');
  process.exit(1);
}

// Ensure output folder exists
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// === SANITIZE HELPER ===
function sanitize(s) {
  if (!s) return '';
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// === HTML GENERATOR ===
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
  <link rel="stylesheet" href="${HOSTINGER_CSS_URL}">
</head>
<body>
  <div class="cert-wrap">
    <div class="cert-card">
      <div class="cert-data">
        <p><b>Name:</b> ${name}</p>
        <p><b>Candidate ID:</b> ${cid}</p>
        <p><b>Job Role:</b> ${job}</p>
        <p><b>QP Code:</b> ${qp}</p>
        <p><b>Grade:</b> ${grade}</p>
        <p><b>Issue Date:</b> ${issue}</p>
        <p><b>Expiry Date:</b> ${expiry}</p>
        ${documentId ? `<p><b>Document ID:</b> ${documentId}</p>` : ''}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// === GENERATE PAGES ===
let count = 0;
for (const row of candidates) {
  const id = row.candidate_id || row.id || ('candidate_' + Math.random().toString(36).slice(2,8));
  const safeId = String(id).trim();
  if (!safeId) continue;

  const html = generateHtml(row);

  // 1) file: verify/<id>.html
  const filePath = path.join(OUT_DIR, `${safeId}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');

  // 2) folder: verify/<id>/index.html
  const folderPath = path.join(OUT_DIR, safeId);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  const indexPath = path.join(folderPath, 'index.html');
  fs.writeFileSync(indexPath, html, 'utf-8');

  count++;
  console.log(`Generated: ${safeId}.html  and ${safeId}/index.html`);
}

console.log(`\nDone. Generated ${count} candidate pages under:\n  ${OUT_DIR}`);
