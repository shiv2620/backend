const fs = require("fs");
const path = require("path");

// 1. candidates.json read karo
const candidatesFile = path.join(__dirname, "candidates.json");
if (!fs.existsSync(candidatesFile)) {
  console.error("❌ candidates.json not found. Please place it in project root.");
  process.exit(1);
}
const candidates = JSON.parse(fs.readFileSync(candidatesFile, "utf8"));

// 2. template.html read karo
const templateFile = path.join(__dirname, "template.html");
const template = fs.readFileSync(templateFile, "utf8");

// 3. output folder
const outDir = path.join(__dirname, "verify");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

candidates.forEach((cand) => {
  let html = template;

  // placeholders replace
  Object.keys(cand).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    html = html.replace(regex, cand[key] || "");
  });

  // output file
  const filename = path.join(outDir, `${cand.candidate_id}.html`);
  fs.writeFileSync(filename, html, "utf8");
  console.log("✅ Generated:", filename);
});

console.log("\n🎉 All pages generated inside 'verify/' folder.");
