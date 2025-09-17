const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

const app = express();

app.use(cors({
  origin: [
    "https://skillindiadigital.org",
    "https://www.skillindiadigital.org"
  ],
  credentials: true
}));

app.use(bodyParser.json());

// ------------------ DATABASE (PostgreSQL) ------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }   // Render ke liye SSL required hota hai
});

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        candidate_id TEXT UNIQUE,
        name TEXT,
        father_name TEXT,
        aadhar TEXT,
        sector TEXT,
        qp_code TEXT,
        qp_version TEXT,
        job_role TEXT,
        grade TEXT,
        issue_date TEXT,
        expiry_date TEXT,
        document_id TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS qr_map (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE,
        candidate_id TEXT
      )
    `);

    console.log("PostgreSQL connected & tables ready!");
  } catch (err) {
    console.error("DB init error:", err);
  }
})();

// ------------------ API ROUTES ------------------

// Add candidate
app.post('/api/add', async (req, res) => {
  const p = req.body;
  const fields = [
    'candidate_id','name','father_name','aadhar','sector','qp_code',
    'qp_version','job_role','grade','issue_date','expiry_date','document_id'
  ];
  const vals = fields.map(f => p[f] || '');

  try {
    const placeholders = fields.map((_, i) => `$${i+1}`).join(',');
    await pool.query(
      `INSERT INTO candidates (${fields.join(',')}) 
       VALUES (${placeholders})
       ON CONFLICT (candidate_id) DO UPDATE SET 
       ${fields.map(f => `${f}=EXCLUDED.${f}`).join(', ')}
      `,
      vals
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// List all candidates
app.get('/api/list', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM candidates ORDER BY id DESC`);
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generate PDF with QR
app.get('/api/generate-pdf/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      `SELECT * FROM candidates WHERE candidate_id=$1 LIMIT 1`, 
      [id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Candidate not found' });

    const token = crypto.randomBytes(8).toString('hex');
    await pool.query(
      `INSERT INTO qr_map (token, candidate_id) VALUES ($1, $2)
       ON CONFLICT (token) DO NOTHING`,
      [token, id]
    );

    const queryString = new URLSearchParams({
      CandidateName: row.name,
      CandidateID: row.candidate_id,
      SectorName: row.sector,
      QPName: row.job_role,
      QPCode: row.qp_code,
      Grade: row.grade,
      ValidTillDate: row.expiry_date,
      ApplicantType: "Trainer",
      Document: row.document_id || "certificate"
    }).toString();

    const verifyUrl = `https://skillindiadigital.org/verify/${encodeURIComponent(id)}?${queryString}`;

    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      type: 'png',
      errorCorrectionLevel: 'Q',
      width: 400,
      version: 15,
      margin: 3,
      scale: 5
    });

    const doc = new PDFDocument({ size:[491,347], margin:0 });
    res.setHeader('Content-Disposition', `attachment; filename=${row.candidate_id}_certificate.pdf`);
    res.setHeader('Content-Type','application/pdf');
    doc.pipe(res);

    const bgPath = path.join(__dirname,'certificate-bg.jpg');
    doc.image(bgPath,0,0,{width:doc.page.width,height:doc.page.height});

    doc.font('Times-Bold').fontSize(28).text(row.name,0,20,{align:'center'});
    doc.font('Times-Roman').fontSize(18).text(`Job Role: ${row.job_role}`,0,80,{align:'center'});
    doc.fontSize(14).text(`ID: ${row.candidate_id}`,60,300);
    doc.fontSize(14).text(`Issue: ${row.issue_date}`,260,300);
    doc.fontSize(14).text(`Valid Upto: ${row.expiry_date}`,260,320);
    doc.image(qrBuffer,360,200,{width:100,height:100});
    doc.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify API
app.get('/api/verify', async (req, res) => {
  const { id, token } = req.query;
  if (!id && !token) return res.status(400).json({ ok:false, error:'Provide id or token' });

  try {
    let row;
    if (id) {
      const result = await pool.query(
        `SELECT * FROM candidates WHERE candidate_id=$1 LIMIT 1`, 
        [id.trim()]
      );
      row = result.rows[0];
    } else {
      const result = await pool.query(
        `SELECT c.* FROM qr_map q 
         JOIN candidates c ON q.candidate_id=c.candidate_id 
         WHERE q.token=$1 LIMIT 1`,
        [token.trim()]
      );
      row = result.rows[0];
    }

    if (!row) return res.status(404).json({ ok:false, error:'Candidate not found' });
    res.json({ ok:true, data: row });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log('Backend running on port', PORT));
