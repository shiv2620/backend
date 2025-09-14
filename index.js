const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: ["https://skillindiadigital.org"], // apna frontend URL
    credentials: false,
  })
);

// Database setup
const db = new sqlite3.Database("./candidates.db", (err) => {
  if (err) {
    console.error("Database opening error: ", err);
  } else {
    console.log("Database connected!");
  }
});

// Create table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id TEXT UNIQUE,
    name TEXT,
    course TEXT,
    date TEXT
  )
`);

// Example seed data
db.run(
  `INSERT OR IGNORE INTO candidates (candidate_id, name, course, date)
   VALUES ('TR440776', 'Shiv Raj Singh', 'Full Stack Development', '2025-09-14')`
);

// API: Get all candidates
app.get("/api/list", (req, res) => {
  db.all("SELECT * FROM candidates", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// API: Generate PDF
app.get("/api/generate-pdf/:id", (req, res) => {
  const candidateId = req.params.id;

  db.get(
    "SELECT * FROM candidates WHERE candidate_id = ?",
    [candidateId],
    (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      // PDF file name
      const fileName = `certificate_${candidateId}.pdf`;
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      res.setHeader("Content-Type", "application/pdf");

      // Create PDF
      const doc = new PDFDocument({ size: "A4", margin: 0 });
      doc.pipe(res);

      // Background image (root me)
      const bgPath = path.join(__dirname, "certificate-bg.jpg");
      if (fs.existsSync(bgPath)) {
        doc.image(bgPath, 0, 0, {
          width: doc.page.width,
          height: doc.page.height,
        });
      } else {
        console.log("⚠️ certificate-bg.jpg missing, PDF plain banega...");
      }

      // Certificate text
      doc.fontSize(26).fillColor("#000").text("Certificate of Completion", {
        align: "center",
        valign: "center",
      });

      doc.moveDown(2);
      doc.fontSize(20).text(`This is to certify that`, { align: "center" });
      doc.moveDown(1);
      doc.fontSize(24).text(row.name, { align: "center", bold: true });
      doc.moveDown(1);
      doc.fontSize(18).text(`has successfully completed the course`, {
        align: "center",
      });
      doc.moveDown(1);
      doc.fontSize(20).text(row.course, { align: "center" });
      doc.moveDown(2);
      doc.fontSize(14).text(`Date: ${row.date}`, { align: "center" });

      // End PDF
      doc.end();
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
