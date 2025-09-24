// migrate_static_html.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ---------------- DATABASE CONNECTION ----------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ---------------- HTML GENERATOR ----------------
function generateStaticHTML(row) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Verify Candidate</title>
<style>
body { font-family: Arial, sans-serif; padding:20px; background:#f4f4f4; }
.card { max-width:600px; margin:auto; border:1px solid #ccc; padding:20px; border-radius:8px; background:white; }
h2 { text-align:center; }
p { font-size:16px; margin:8px 0; }
</style>
</head>
<body>
<div class="card">
<h2>Certificate Verification</h2>
<p><b>Name:</b> ${row.name}</p>
<p><b>Candidate ID:</b> ${row.candidate_id}</p>
<p><b>Job Role:</b> ${row.job_role}</p>
<p><b>QP Code:</b> ${row.qp_code}</p>
<p><b>Grade:</b> ${row.grade}</p>
<p><b>Issue Date:</b> ${row.issue_date}</p>
<p><b>Expiry Date:</b> ${row.expiry_date}</p>
</div>
</body>
</html>
  `;
}

// ---------------- MIGRATION SCRIPT ----------------
(async () => {
  try {
    const result = await pool.query(`SELECT * FROM candidates`);
    const candidates = result.rows;
    if (!candidates.length) {
      console.log("No candidates found in database.");
      process.exit(0);
    }

    // Folder where HTML files will be saved
    const folderPath = path.resolve(__dirname, '../frontend/public/verify');
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    // Loop through candidates
    for (const row of candidates) {
      const html = generateStaticHTML(row);
      const filePath = path.join(folderPath, `${row.candidate_id}.html`);
      fs.writeFileSync(filePath, html, 'utf-8');
      console.log(`Generated HTML for candidate: ${row.candidate_id}`);
    }

    console.log("All candidate HTML files generated successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error generating HTML files:", err);
    process.exit(1);
  }
})();
