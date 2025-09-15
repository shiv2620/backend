// server/index.js - Express + SQLite backend with PDF + QR
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

// CORS - Hostinger frontend
app.use(cors({
  origin: [
    "https://skillindiadigital.org",
    "https://www.skillindiadigital.org"
  ],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(bodyParser.json());

// ----------------- DB Setup -----------------
const db = new sqlite3.Database("database.sqlite", (err) => {
  if (err) console.error("Database connection error:", err.message);
  else console.log("Database connected!");
});

// Create tables
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

// ----------------- Helpers -----------------
function getCandidateById(id, cb) {
  db.get(`SELECT * FROM candidates WHERE candidate_id = ? LIMIT 1`, [id], cb);
}
function getCandidateByDoc(doc, cb) {
  db.get(`SELECT * FROM candidates WHERE document_id = ? LIMIT 1`, [doc], cb);
}
function getCandidateByToken(token, cb) {
  db.get(`SELECT c.* FROM qr_map q JOIN candidates c 
          ON q.candidate_id=c.candidate_id 
          WHERE q.token = ? LIMIT 1`, [token], cb);
}

// ----------------- API Routes -----------------
app.get('/api/verify', (req, res) => {
  const { id, doc, token } = req.query;
  if (!id && !doc && !token) return res.status(400).json({ ok:false, error: 'Provide id or doc or token' });

  const cb = (err, row) => {
    if (err) return res.status(500).json({ ok:false, error: err.message });
    if (!row) return res.status(404).json({ ok:false, error: 'Not found' });
    res.json({ ok:true, data: row });
  };

  if (token) return getCandidateByToken(token, cb);
  if (id) return getCandidateById(id, cb);
  if (doc) return getCandidateByDoc(doc, cb);
});

app.post('/api/add', (req, res) => {
  const p = req.body;
  const fields = ['candidate_id','name','father_name','aadhar','sector','qp_code',
                  'qp_version','job_role','grade','issue_date','expiry_date','document_id'];
  const vals = fields.map(f => p[f] || '');
  db.run(`INSERT OR REPLACE INTO candidates (${fields.join(',')}) 
          VALUES (${fields.map(()=>'?').join(',')})`, vals, function(err) {
    if (err) return res.status(500).json({ ok:false, error: err.message });
    res.json({ ok:true, id: this.lastID });
  });
});

// QR Code API
app.get('/api/qrcode', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ ok:false, error: 'Provide id' });

  const token = crypto.randomBytes(8).toString('hex');
  db.run(`INSERT OR IGNORE INTO qr_map (token, candidate_id) VALUES (?, ?)`, [token, id], async (err) => {
    if (err) return res.status(500).json({ ok:false, error: err.message });

    const url = `https://skillindiadigital.org/verify?token=${token}`;
    try {
      const png = await QRCode.toBuffer(url, { type: 'png', width: 250 });
      res.setHeader('Content-Type', 'image/png');
      res.send(png);
    } catch (e) {
      res.status(500).json({ ok:false, error: e.message });
    }
  });
});

// Generate PDF API
app.get('/api/generate-pdf/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT * FROM candidates WHERE candidate_id = ? LIMIT 1`, [id], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Candidate not found' });

    try {
      const verifyUrl = `https://skillindiadigital.org/verify?token=${row.candidate_id}`;
      const qrBuffer = await QRCode.toBuffer(verifyUrl, { type: 'png', width: 120 });

      const doc = new PDFDocument({ size: [491, 347], margin: 0 });
      let filename = `${row.candidate_id}_certificate.pdf`;

      res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
      res.setHeader('Content-type', 'application/pdf');
      doc.pipe(res);

      const bgPath = path.join(__dirname, 'certificate-bg.jpg');
      if (fs.existsSync(bgPath)) doc.image(bgPath, 0, 0, { width: doc.page.width, height: doc.page.height });

      doc.font('Times-Bold').fontSize(28).fillColor('#000')
         .text(row.name, 0, 20, { align: 'center' });
      doc.font('Times-Roman').fontSize(18)
         .text(`Job Role: ${row.job_role}`, 0, 80, { align: 'center' });
      doc.fontSize(14).text(`ID: ${row.candidate_id}`, 60, 300);
      doc.fontSize(14).text(`Issue: ${row.issue_date}`, 260, 300);
      doc.fontSize(14).text(`Valid Upto: ${row.expiry_date}`, 260, 320);
      doc.image(qrBuffer, 360, 200, { width: 100, height: 100 });

      doc.end();
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
});

// ----------------- Static Frontend -----------------
app.use(express.static(path.resolve(__dirname, '../frontend/build')));
app.get('*', (req, res) => {
  const index = path.resolve(__dirname, '../frontend/build/index.html');
  res.sendFile(index);
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Server running on port', PORT));
