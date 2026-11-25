const PDFDocument = require("pdfkit");
const path = require("path");

const BLUE = "#004BAF";
const ORANGE = "#F1770A";
const MUTED = "#687789";
const LINE = "#DCE5F0";
const SOFT = "#F4F8FF";
const LOGO = path.join(__dirname, "../public/assets/earthsar-logo.png");
const FONT_REGULAR = path.join(__dirname, "fonts/NotoSans-Regular.ttf");
const FONT_BOLD = path.join(__dirname, "fonts/NotoSans-Bold.ttf");

function createClientProfilePdf(data, photo) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 22, right: 34, bottom: 12, left: 34 } });
    doc.registerFont("Noto", FONT_REGULAR);
    doc.registerFont("Noto-Bold", FONT_BOLD);
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const left = 34;
    const right = doc.page.width - 34;
    const width = right - left;
    doc.image(LOGO, left, 27, { width: 112 });
    doc.font("Noto-Bold").fontSize(19).fillColor(BLUE).text("Client Profile", 178, 32, { width: right - 178, align: "right", lineBreak: false });
    doc.font("Noto").fontSize(8.5).fillColor(MUTED).text(`Reference ${data.reference}`, 178, 56, { width: right - 178, align: "right", lineBreak: false });
    doc.moveTo(left, 73).lineTo(right, 73).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.moveTo(left, 73).lineTo(left + 42, 73).lineWidth(1.8).strokeColor(ORANGE).stroke();

    const imageW = photo ? 58 : 0;
    if (photo) {
      try { doc.image(photo.buffer, left, 84, { fit: [imageW, 64], align: "center", valign: "center" }); }
      catch { /* An invalid optional image must not prevent the profile PDF. */ }
    }
    const textX = left + imageW + (photo ? 12 : 0);
    const textW = width - imageW - (photo ? 12 : 0);
    doc.font("Noto-Bold").fontSize(14).fillColor(BLUE).text(data.name, textX, 84, { width: textW, height: 16, ellipsis: true, lineBreak: false });
    const subtitle = [data.company, data.designation].filter(Boolean).join("  ·  ");
    if (subtitle) doc.font("Noto").fontSize(8.3).fillColor(MUTED).text(subtitle, textX, 102, { width: textW, height: 12, ellipsis: true, lineBreak: false });
    doc.moveTo(textX, 112).lineTo(right, 112).lineWidth(0.5).strokeColor(LINE).stroke();
    const metricW = (textW - 12) / 2;
    doc.font("Noto-Bold").fontSize(7).fillColor(MUTED).text("PREFERRED FLAT", textX, 124, { lineBreak: false });
    doc.font("Noto-Bold").fontSize(10).fillColor(ORANGE).text(data.preferredFlat, textX, 135, { width: metricW, height: 12, ellipsis: true, lineBreak: false });
    doc.font("Noto-Bold").fontSize(7).fillColor(MUTED).text("MONTHLY BUDGET", textX + metricW + 12, 124, { lineBreak: false });
    doc.font("Noto-Bold").fontSize(10).fillColor(BLUE).text(`INR ${data.budget}`, textX + metricW + 12, 135, { width: metricW, height: 12, ellipsis: true, lineBreak: false });

    let y = 157;
    doc.font("Noto-Bold").fontSize(9).fillColor(ORANGE).text("CLIENT DETAILS", left, y, { characterSpacing: 0.5, lineBreak: false });
    y += 12;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.7).strokeColor(ORANGE).stroke();
    y += 4;
    const rows = [
      ["Offer date", data.offerDate], ["Name", data.name], ["Email", data.email], ["Phone", data.phone],
      ["LinkedIn profile available", data.hasLinkedIn]
    ];
    if (data.hasLinkedIn === "Yes" && data.linkedinProfile) rows.push(["LinkedIn profile", data.linkedinProfile]);
    rows.push(["No. of family members", data.familyCount], ["Family members residing", data.familyDetails], ["Native place", data.nativePlace], ["Shifting from", data.shiftingFrom], ["Expected shifting date", data.shiftDate], ["Educational background", data.education], ["Company / profession", data.company], ["Designation", data.designation], ["Wife works", data.wifeWorks]);
    if (data.wifeWorks === "Yes") rows.push(["Wife’s company", data.wifeCompany], ["Wife’s designation", data.wifeDesignation]);
    rows.push(["Preferred flat size", data.preferredFlat], ["Monthly rental budget", `INR ${data.budget}`], ["Has pets", data.hasPets]);
    if (data.hasPets === "Yes" && data.pets) rows.push(["Pet details / housing needs", data.pets]);

    const labelW = 166;
    for (const [label, value] of rows) {
      const text = String(value == null || value === "" ? "Not provided" : value);
      const fontSize = 9;
      const valueW = width - labelW - 14;
      const textHeight = doc.font("Noto").fontSize(fontSize).heightOfString(text, { width: valueW, lineGap: 0.4 });
      const h = Math.max(19, textHeight + 7);
      doc.rect(left, y, width, h).fill("#FFFFFF").stroke(LINE);
      doc.rect(left, y, labelW, h).fill(SOFT);
      doc.font("Noto-Bold").fontSize(7.7).fillColor(MUTED).text(label.toUpperCase(), left + 6, y + 6, { width: labelW - 10, lineBreak: false, ellipsis: true });
      doc.font("Noto").fontSize(fontSize).fillColor("#182433").text(text, left + labelW + 8, y + 4, { width: valueW, lineGap: 0.4 });
      y += h;
    }
    doc.font("Noto").fontSize(8.5).fillColor(MUTED).text("Private client information  ·  earthsar Real Estate Advisory", left, 808, { width, align: "center", lineBreak: false });
    doc.end();
  });
}

module.exports = { createClientProfilePdf };
