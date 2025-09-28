// generate_static_from_json.js
const fs = require('fs');
const path = require('path');

// === CONFIG ===
// Your candidates JSON
const INPUT = path.resolve(__dirname, 'candidates.json'); 

// Output folder for HTML pages
const OUT_DIR = path.resolve(__dirname, 'frontend', 'public', 'verify'); 

// Backend URL for static images
const BACKEND_URL = "https://backend-5mua.onrender.com/static"; // Your Render backend

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

// === CSS TO EMBED ===
const EMBEDDED_CSS = `
* { box-sizing: border-box; }
body, html, #root { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #fff; color: #222; }
.topbar { background: #fff; border-bottom: 1px solid #ddd; position: fixed; top: 0; left: 0; width: 100%; z-index: 1000; }
.top-links { display: flex; justify-content: flex-end; align-items: center; gap: 16px; font-size: 13px; padding: 0 70px; height: 31px; line-height: 36px; border-bottom: 1px solid #ccc; background: #f9f9f9; }
.top-links a { color: #333; text-decoration: none; font-weight: 500; }
.top-links a:hover { text-decoration: underline; }
.support-link { display: flex; align-items: center; gap: 2px; color: #000; font-size: 13px; font-weight: 500; text-decoration: none; }
.top-links .login-btn { background: #ea7f18; color: #fff; padding: 0px 20px; border-radius: 0px; font-weight: 500; }
.top-links .register { color: black; }
.top-strip { height: 3px; width: 100%; display: flex; }
.top-strip div { flex: 1; height: 100%; }
.top-strip .green { background: #8bc34a; }
.top-strip .blue { background: #2196f3; }
.top-strip .red { background: #f44336; }
.top-row { width: 100%; display: block; padding: 0; }
.top-row img { width: 100%; max-width: 100%; height: auto; display: block; }
.navbar { background: #ea7f18; height: 47px; display: flex; align-items: center; padding: 0 40px; color: #fff; font-weight: 600; font-size: 14px; }
.page { padding-top: 72px; min-height: calc(100vh - 220px); }
.cert-wrap { display: flex; justify-content: center; padding: 40px; }
.cert-card { padding: 24px; text-align: left; }
.cert-logo { display: flex; justify-content: center; margin-bottom: 5px; }
.cert-logo img { height: 80px; }
.verified-badge { display: flex; flex-direction: column; align-items: center; margin-bottom: 3px; }
.verified-badge .text { margin-top: 8px; color: #1a73e8; font-size: 14px; }
.cert-data { font-size: 13px; line-height: 2.6; color: #444; }
.cert-data b { font-weight: 600; }
.footer { width: 100%; background: #fff; text-align: center; }
.footer-img { width: 100%; height: auto; display: block; }
.bottom-bar { height: 25px; background: #000; margin-top: 20px; }
`;

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
  <style>${EMBEDDED_CSS}</style>
</head>
<body>
  <header class="topbar">
    <div class="top-links">
      <a href="#" class="support-link">Technical Support</a>
      <a href="#" class="login-btn">LOGIN</a>
      <a href="#" class="register">Register</a>
    </div>
    <div class="top-strip">
      <div class="green"></div>
      <div class="blue"></div>
      <div class="red"></div>
    </div>
    <div class="top-row">
      <img src="${BACKEND_URL}/banner.png" alt="Skill India Banner" />
    </div>
    <div class="navbar"><span>HOME</span></div>
  </header>

  <main class="page">
    <div class="cert-wrap">
      <div class="cert-card">
        <div class="cert-logo">
          <img src="${BACKEND_URL}/Blue.png" alt="Certificate Logo" />
        </div>
        <div class="verified-badge">
          <div class="text">Certificate Verified</div>
        </div>
        <div class="cert-data">
          <div><b>Candidate Name:</b> ${name}</div>
          <div><b>Candidate ID:</b> ${cid}</div>
          <div><b>Job Role:</b> ${job}</div>
          <div><b>QP Code:</b> ${qp}</div>
          <div><b>Grade:</b> ${grade}</div>
          ${documentId ? `<div><b>Document ID:</b> ${documentId}</div>` : ''}
          <div><b>Issue Date:</b> ${issue}</div>
          <div><b>Valid Upto:</b> ${expiry}</div>
          <div><b>Type:</b> Certificate</div>
        </div>
      </div>
    </div>
  </main>

  <footer class="footer">
    <img src="${BACKEND_URL}/footer-full.png" alt="Footer" class="footer-img" />
  </footer>
  <div class="bottom-bar"></div>
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
