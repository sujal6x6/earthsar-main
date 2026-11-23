const PDFDocument = require("pdfkit");

const BLUE = "#004BAF";
const ORANGE = "#F1770A";
const MUTED = "#687789";
const LINE = "#DCE5F0";
const SOFT = "#F4F8FF";

function createPropertyPdf(data, sale = false) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 40, right: 44, bottom: 48, left: 44 }, autoFirstPage: false });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const pageHeader = () => {
      const { width, height } = doc.page;
      const left = doc.page.margins.left;
      const right = width - doc.page.margins.right;
      doc.x = left;
      doc.y = 0;
      doc.rect(left, 32, right - left, 3).fill(ORANGE);
      doc.font("Helvetica-Bold").fontSize(20).fillColor(BLUE).text("earthsar", left, 48, { lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text("SMART ADVISORS IN REAL ESTATE", left, 72, { lineBreak: false, characterSpacing: 0.7 });
      doc.font("Helvetica-Bold").fontSize(23).fillColor(BLUE).text(sale ? "Sale Property" : "Rental Property", left, 96, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(`REF  ${data.reference}`, left, 106, { align: "right", width: right - left });
      doc.moveTo(left, 128).lineTo(right, 128).lineWidth(1).strokeColor(LINE).stroke();
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(MUTED).text("Property owner submission  ·  earthsar Real Estate Advisory", left, height - doc.page.margins.bottom - 14, { width: right - left, align: "center", lineBreak: false });
      doc.x = left;
      doc.y = 142;
    };
    const addPage = () => { doc.addPage(); pageHeader(); };
    addPage();

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const bottom = doc.page.height - doc.page.margins.bottom - 4;
    const ensureSpace = height => { if (doc.y + height > bottom) addPage(); };
    const section = title => {
      ensureSpace(30);
      doc.moveDown(0.65);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(ORANGE).text(title.toUpperCase(), left, doc.y, { characterSpacing: 0.65 });
      doc.moveTo(left, doc.y + 4).lineTo(right, doc.y + 4).lineWidth(0.8).strokeColor(ORANGE).stroke();
      doc.y += 13;
    };
    const row = (label, value) => {
      const labelWidth = 174;
      const valueWidth = width - labelWidth - 24;
      const lines = String(value || "Not provided").split(/\r?\n/);
      const height = Math.max(31, doc.heightOfString(lines.join("\n"), { width: valueWidth, font: "Helvetica", fontSize: 9.5, lineGap: 2 }) + 15);
      ensureSpace(height + 2);
      const y = doc.y;
      doc.rect(left, y, width, height).fill("#FFFFFF").stroke(LINE);
      doc.rect(left, y, labelWidth, height).fill(SOFT);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED).text(label.toUpperCase(), left + 10, y + 10, { width: labelWidth - 18 });
      doc.font("Helvetica").fontSize(9.5).fillColor("#182433").text(lines.join("\n"), left + labelWidth + 12, y + 7, { width: valueWidth, lineGap: 2 });
      doc.y = y + height;
    };

    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(ORANGE).text("PROPERTY OWNER", left, 144, { characterSpacing: 0.7 });
    doc.font("Helvetica-Bold").fontSize(19).fillColor(BLUE).text(data.name, left, 160, { width, height: 28, ellipsis: true });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(`${data.email}  ·  ${data.phone}`, left, 190, { width, height: 15, ellipsis: true });
    doc.moveTo(left, 215).lineTo(right, 215).lineWidth(0.7).strokeColor(LINE).stroke();
    const metricWidth = width / 3;
    const metrics = [["PROPERTY TYPE", data.propertyType], ["CONFIGURATION", data.bhk], [sale ? "SALE AMOUNT" : "MONTHLY RENT", `INR ${sale ? data.saleAmount : data.rent}`]];
    metrics.forEach(([label, value], index) => {
      const x = left + metricWidth * index;
      doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text(label, x, 223, { width: metricWidth - 8 });
      doc.font("Helvetica-Bold").fontSize(12).fillColor(index === 2 ? ORANGE : BLUE).text(value, x, 236, { width: metricWidth - 10, height: 22, ellipsis: true });
    });
    doc.y = 272;

    section("Owner details");
    row("Name", data.name);
    row("Email", data.email);
    row("Phone", data.phone);
    row("LinkedIn profile", data.linkedinProfile);
    section("Property details");
    row("Property type", data.propertyType);
    row("BHK", data.bhk);
    row("Address", data.address);
    row("City", data.city);
    row("State", data.state);
    row("Area", `${data.area} sq ft`);
    if (sale) row("Sale amount", `INR ${data.saleAmount}`);
    else row("Rent amount (including maintenance)", `INR ${data.rent}`);
    row("Description", data.description);
    row(sale ? "Pets / pet-related details" : "Pet policy", data.pets);
    doc.end();
  });
}

module.exports = {
  createRentPropertyPdf: data => createPropertyPdf(data, false),
  createSalePropertyPdf: data => createPropertyPdf(data, true)
};
