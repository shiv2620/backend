const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Database connected!");
  }
});

// Ensure table exists
db.run(
  `CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    course TEXT
  )`
);

// ---------------------- TEST ROUTE ----------------------
app.get("/api/lis", (req, res) => {
  res.json({ message: "✅ Backend working fine 🚀" });
});
// ---------------------------------------------------------

// Example: generate PDF API (keep your existing one)
app.get("/api/generate-pdf/:id", (req, res) => {
  const candidateId = req.params.id;

  db.get("SELECT * FROM candidates WHERE id = ?", [candidateId], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    if (!row) {
      return res.status(404).send("Candidate not found");
    }

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=certificate.pdf");

    // background image
    const bgPath = path.join(__dirname, "templates", "certificate-bg.jpg");
    if (fs.existsSync(bgPath)) {
      doc.image(bgPath, 0, 0, { width: 600 });
    }

    doc.fontSize(24).text("Certificate of Completion", 150, 200);
    doc.fontSize(18).text(`This certifies that ${row.name}`, 150, 250);
    doc.text(`Course: ${row.course}`, 150, 280);

    doc.end();
    doc.pipe(res);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
