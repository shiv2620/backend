// Generate PDF with QR
app.get('/api/generate-pdf/:id', async (req, res) => {
  const id = req.params.id;
  db.get(`SELECT * FROM candidates WHERE candidate_id=? LIMIT 1`, [id], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Candidate not found' });

    try {
      const token = crypto.randomBytes(8).toString('hex');
      db.run(`INSERT OR IGNORE INTO qr_map (token, candidate_id) VALUES (?, ?)`, [token, id]);

      // ✅ Corrected QR code URL (skillindiadigital.org)
      const verifyUrl = new URL("https://skillindiadigital.org/documentverificationbyQR");
      verifyUrl.searchParams.set("Candidate Name", row.name);
      verifyUrl.searchParams.set("Candidate ID", row.candidate_id);
      verifyUrl.searchParams.set("Sector Name", row.sector);
      verifyUrl.searchParams.set("QP Name", row.job_role);
      verifyUrl.searchParams.set("QP Code", row.qp_code);
      verifyUrl.searchParams.set("Grade", row.grade);
      verifyUrl.searchParams.set("Valid Till Date", row.expiry_date);
      verifyUrl.searchParams.set("Candidate/Applicant type", "Trainer");
      verifyUrl.searchParams.set("Document", "certificate");

      const finalUrl = verifyUrl.toString();

      // ✅ Final URL string pass karo, object nahi
      const qrBuffer = await QRCode.toBuffer(finalUrl, {
        type: 'png',
        errorCorrectionLevel: 'Q',
        width: 400,
        margin: 3,
        scale: 5
      });

      const doc = new PDFDocument({ size: [491, 347], margin: 0 });
      res.setHeader('Content-Disposition', `attachment; filename=${row.candidate_id}_certificate.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);

      const bgPath = path.join(__dirname, 'certificate-bg.jpg');
      if (fs.existsSync(bgPath)) doc.image(bgPath, 0, 0, { width: doc.page.width, height: doc.page.height });

      doc.font('Times-Bold').fontSize(28).text(row.name, 0, 20, { align: 'center' });
      doc.font('Times-Roman').fontSize(18).text(`Job Role: ${row.job_role}`, 0, 80, { align: 'center' });
      doc.fontSize(14).text(`ID: ${row.candidate_id}`, 60, 300);
      doc.fontSize(14).text(`Issue: ${row.issue_date}`, 260, 300);
      doc.fontSize(14).text(`Valid Upto: ${row.expiry_date}`, 260, 320);
      doc.image(qrBuffer, 360, 200, { width: 100, height: 100 });
      doc.end();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});
