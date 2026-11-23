const PDFDocument = require("pdfkit");

const BLUE = "#004BAF";
const ORANGE = "#F1770A";
const MUTED = "#687789";
const LINE = "#DCE5F0";
const SOFT = "#F4F8FF";

function createClientProfilePdf(data, photo) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 40, right: 44, bottom: 48, left: 44 }, bufferPages: true, autoFirstPage: false });
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
      doc.font("Helvetica-Bold").fontSize(23).fillColor(BLUE).text("Client Profile", left, 96, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(`REF  ${data.reference}`, left, 106, { align: "right", width: right - left });
      doc.moveTo(left, 128).lineTo(right, 128).lineWidth(1).strokeColor(LINE).stroke();
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(MUTED).text("Private client information  ·  earthsar Real Estate Advisory", left, height - doc.page.margins.bottom - 14, { width: right - left, align: "center", lineBreak: false });
      doc.x = left;
      doc.y = 142;
    };
    doc.addPage();
    pageHeader();

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;
    const bottom = doc.page.height - doc.page.margins.bottom - 4;
    const ensureSpace = height => {
      if (doc.y + height > bottom) {
        doc.addPage();
        pageHeader();
      }
    };
    const section = title => {
      ensureSpace(30);
      doc.moveDown(0.65);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(ORANGE).text(title.toUpperCase(), left, doc.y, { characterSpacing: 0.65 });
      doc.moveTo(left, doc.y + 4).lineTo(right, doc.y + 4).lineWidth(0.8).strokeColor(ORANGE).stroke();
      doc.y += 13;
    };
    const row = (label, value) => {
      const labelWidth = 174;
      const valueWidth = contentWidth - labelWidth - 24;
      const text = value || "Not provided";
      const valueHeight = doc.font("Helvetica").fontSize(9.5).heightOfString(text, { width: valueWidth, lineGap: 2 });
      const height = Math.max(31, valueHeight + 15);
      ensureSpace(height + 2);
      const y = doc.y;
      doc.rect(left, y, contentWidth, height).fill("#FFFFFF").stroke(LINE);
      doc.rect(left, y, labelWidth, height).fill(SOFT);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED).text(label.toUpperCase(), left + 10, y + 10, { width: labelWidth - 18, lineGap: 1 });
      doc.font("Helvetica").fontSize(9.5).fillColor("#182433").text(text, left + labelWidth + 12, y + 7, { width: valueWidth, lineGap: 2 });
      doc.y = y + height;
    };

    const cardY = doc.y;
    const imageW = photo ? 82 : 0;
    if (photo) {
      try { doc.image(photo.buffer, left, cardY, { fit: [imageW, 94], align: "center", valign: "center" }); }
      catch { /* An invalid optional image must not prevent the profile PDF. */ }
    }
    const textX = left + imageW + (photo ? 16 : 0);
    const textWidth = contentWidth - imageW - (photo ? 16 : 0);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(ORANGE).text("CLIENT", textX, cardY + 2, { characterSpacing: 0.7 });
    doc.font("Helvetica-Bold").fontSize(19).fillColor(BLUE).text(data.name, textX, cardY + 18, { width: textWidth, height: 48, ellipsis: true });
    const subtitle = [data.designation, data.company].filter(Boolean).join("  ·  ");
    if (subtitle) doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(subtitle, textX, cardY + 47, { width: textWidth, height: 18, ellipsis: true });
    const metricY = cardY + 72;
    const metricGap = 14;
    const metricW = (textWidth - metricGap) / 2;
    doc.moveTo(textX, metricY - 7).lineTo(textX + textWidth, metricY - 7).lineWidth(0.7).strokeColor(LINE).stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("PREFERRED FLAT", textX, metricY, { width: metricW });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(ORANGE).text(data.preferredFlat, textX, metricY + 12, { width: metricW, height: 22, ellipsis: true });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("MONTHLY BUDGET", textX + metricW + metricGap, metricY, { width: metricW });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BLUE).text(`INR ${data.budget}`, textX + metricW + metricGap, metricY + 12, { width: metricW, height: 22, ellipsis: true });
    doc.y = cardY + 105;

    section("Client details");
    row("Offer date", data.offerDate);
    row("Name", data.name);
    row("Email", data.email);
    row("Phone", data.phone);
    row("LinkedIn profile", data.linkedinProfile);
    row("No. of family members", data.familyCount);
    row("Family members residing", data.familyDetails);
    row("Native place", data.nativePlace);
    row("Shifting from", data.shiftingFrom);
    row("Expected shifting date", data.shiftDate);
    row("Educational background", data.education);
    row("Working company / profession", data.company);
    row("Designation", data.designation);
    row("Preferred flat size", data.preferredFlat);
    row("Monthly rental budget", `INR ${data.budget}`);
    row("Pets / housing needs", data.pets);

    doc.end();
  });
}

module.exports = { createClientProfilePdf };
