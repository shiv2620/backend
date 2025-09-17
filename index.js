// server/index.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const crypto = require('crypto');

// ------------------ EXPRESS APP ------------------
const app = express();

// ------------------ CORS ------------------
app.use(cors({
  origin: [
    "https://skillindiadigital.org",
    "https://www.skillindiadigital.org"
  ],
  credentials: true
}));

app.use(bodyParser.json());

// ------------------ DATABASE ------------------
const db = new sqlite3.Database("database.sqlite", (err) => {
  if (err) console.error(err.message);
  else console.log("Database connected!");
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS qr_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE,
    candidate_id TEXT
  )`);
});

// ------------------ API ROUTES ------------------

// Add candidate
app.post('/api/add', (req, res) => {
  const p = req.body;
  const fields = ['candidate_id','name','father_name','aadhar','sector','qp_code',
                  'qp_version','job_role','grade','issue_date','expiry_date','document_id'];
  const vals = fields.map(f => p[f] || '');
  db.run(`INSERT OR REPLACE INTO candidates (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,
    vals, function(err) {
      if(err) return res.status(500).json({ ok:false, error: err.message });
      res.json({ ok:true, id: this.lastID });
  });
});

// Generate PDF with QR
app.get('/api/generate-pdf/:id', async (req, res) => {
  const id = req.params.id;
  db.get(`SELECT * FROM candidates WHERE candidate_id=? LIMIT 1`, [id], async (err, row) => {
    if(err) return res.status(500).json({ error: err.message });
    if(!row) return res.status(404).json({ error: 'Candidate not found' });

    try {
      const token = crypto.randomBytes(8).toString('hex');
      db.run(`INSERT OR IGNORE INTO qr_map (token, candidate_id) VALUES (?, ?)`, [token, id]);

      // ✅ Full URL with query parameters
      const queryString = new URLSearchParams({
        "Candidate Name": row.name,
        "Candidate ID": row.candidate_id,
        "Sector Name": row.sector,
        "QP Name": row.job_role,
        "QP Code": row.qp_code,
        "Grade": row.grade,
        "Valid Till Date": row.expiry_date,
        "Candidate/Applicant type": "Trainer",
        "Document": row.document_id || "certificate"
      }).toString();

      const verifyUrl = `https://skillindiadigital.org/verify/${encodeURIComponent(id)}?${queryString}`;

      // QR code buffer
      const qrBuffer = await QRCode.toBuffer(verifyUrl, {
        type: 'png',
        errorCorrectionLevel: 'Q',
        width: 400,
        version: 15,
        margin: 3,
        scale: 5
      });

      // PDF generation
      const doc = new PDFDocument({ size:[491,347], margin:0 });
      res.setHeader('Content-Disposition', `attachment; filename=${row.candidate_id}_certificate.pdf`);
      res.setHeader('Content-Type','application/pdf');
      doc.pipe(res);

      const bgPath = path.join(__dirname,'certificate-bg.jpg');
      if(fs.existsSync(bgPath)) doc.image(bgPath,0,0,{width:doc.page.width,height:doc.page.height});

      doc.font('Times-Bold').fontSize(28).text(row.name,0,20,{align:'center'});
      doc.font('Times-Roman').fontSize(18).text(`Job Role: ${row.job_role}`,0,80,{align:'center'});
      doc.fontSize(14).text(`ID: ${row.candidate_id}`,60,300);
      doc.fontSize(14).text(`Issue: ${row.issue_date}`,260,300);
      doc.fontSize(14).text(`Valid Upto: ${row.expiry_date}`,260,320);
      doc.image(qrBuffer,360,200,{width:100,height:100});
      doc.end();
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// Verify API
app.get('/api/verify', (req, res) => {
  const { id, token } = req.query;
  if(!id && !token) return res.status(400).json({ ok:false, error:'Provide id or token' });

  const cb = (err,row) => {
    if(err) return res.status(500).json({ ok:false, error: err.message });
    if(!row) return res.status(404).json({ ok:false, error:'Not found' });
    res.json({ ok:true, data: row });
  };

  if(id) db.get(`SELECT * FROM candidates WHERE candidate_id=? LIMIT 1`, [id], cb);
  else db.get(`SELECT c.* FROM qr_map q JOIN candidates c ON q.candidate_id=c.candidate_id WHERE q.token=? LIMIT 1`, [token], cb);
});

// ✅ Get full URL with query parameters
app.get('/api/getFullUrl/:id', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM candidates WHERE candidate_id=? LIMIT 1`, [id], (err, row) => {
        if(err) return res.status(500).json({ ok:false, error: err.message });
        if(!row) return res.status(404).json({ ok:false, error:'Candidate not found' });

        const queryString = new URLSearchParams({
            "Candidate Name": row.name,
            "Candidate ID": row.candidate_id,
            "Sector Name": row.sector,
            "QP Name": row.job_role,
            "QP Code": row.qp_code,
            "Grade": row.grade,
            "Valid Till Date": row.expiry_date,
            "Candidate/Applicant type": "Trainer",
            "Document": row.document_id || "certificate"
        }).toString();

        const fullUrl = `https://skillindiadigital.org/verify/${encodeURIComponent(id)}?${queryString}`;

        res.json({ ok:true, url: fullUrl });
    });
});

// ❌ Block root for public
app.get('/', (req, res) => {
  res.status(403).send("Access Denied");
});


// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log('Backend running on port', PORT));
