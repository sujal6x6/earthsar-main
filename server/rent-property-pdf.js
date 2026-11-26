const PDFDocument = require("pdfkit");
const path = require("path");
const { isCommercialProperty, propertyNumberLabel } = require("./property-type");

const BLUE = "#004BAF";
const ORANGE = "#F1770A";
const MUTED = "#687789";
const LINE = "#DCE5F0";
const SOFT = "#F4F8FF";
const LOGO = path.join(__dirname, "../public/assets/earthsar-logo.png");
const FONT_REGULAR = path.join(__dirname, "fonts/NotoSans-Regular.ttf");
const FONT_BOLD = path.join(__dirname, "fonts/NotoSans-Bold.ttf");

function createPropertyPdf(data, sale = false) {
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
    doc.font("Noto-Bold").fontSize(19).fillColor(BLUE).text(sale ? "Sale Property" : "Rental Property", 178, 32, { width: right - 178, align: "right", lineBreak: false });
    doc.font("Noto").fontSize(8.5).fillColor(MUTED).text(`Reference ${data.reference}`, 178, 56, { width: right - 178, align: "right", lineBreak: false });
    doc.moveTo(left, 73).lineTo(right, 73).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.moveTo(left, 73).lineTo(left + 42, 73).lineWidth(1.8).strokeColor(ORANGE).stroke();

    doc.font("Noto-Bold").fontSize(13).fillColor(BLUE).text(data.name, left, 84, { width: width * 0.46, height: 16, ellipsis: true, lineBreak: false });
    doc.font("Noto").fontSize(8.5).fillColor(MUTED).text(`${data.email}  ·  ${data.phone}`, left + width * 0.46, 87, { width: width * 0.54, height: 14, ellipsis: true, lineBreak: false });
    doc.moveTo(left, 99).lineTo(right, 105).lineWidth(0.5).strokeColor(LINE).stroke();

    const commercial = isCommercialProperty(data.propertyType);
    const metrics = [
      ["PROPERTY TYPE", data.propertyType],
      ...(!commercial ? [["BHK", data.bhk]] : []),
      ["AREA", `${data.area} sq ft`],
      ["FLOOR", data.floor],
      [sale ? "SALE AMOUNT" : "MONTHLY RENT", `INR ${sale ? data.saleAmount : data.rent}`]
    ];
    const metricW = width / metrics.length;
    metrics.forEach(([label, value], i) => {
      const x = left + i * metricW;
      doc.font("Noto-Bold").fontSize(7.7).fillColor(MUTED).text(label, x, 113, { width: metricW - 7, lineBreak: false });
      doc.font("Noto-Bold").fontSize(10).fillColor(i === metrics.length - 1 ? ORANGE : BLUE).text(String(value || "—"), x, 125, { width: metricW - 7, height: 13, ellipsis: true, lineBreak: false });
    });
    doc.moveTo(left, 139).lineTo(right, 145).lineWidth(0.5).strokeColor(LINE).stroke();

    let y = 153;
    const section = title => {
      doc.font("Noto-Bold").fontSize(9).fillColor(ORANGE).text(title.toUpperCase(), left, y, { characterSpacing: 0.5, lineBreak: false });
      y += 13;
    };
    const row = (label, value) => {
      const labelW = 142;
      const valueW = width - labelW - 18;
      const fontSize = 9;
      const text = String(value == null || value === "" ? "Not provided" : value);
      const textHeight = doc.font("Noto").fontSize(fontSize).heightOfString(text, { width: valueW, lineGap: 0.5 });
      const h = Math.max(19, textHeight + 8);
      doc.rect(left, y, width, h).fill("#FFFFFF").stroke(LINE);
      doc.rect(left, y, labelW, h).fill(SOFT);
      doc.font("Noto-Bold").fontSize(7.7).fillColor(MUTED).text(label.toUpperCase(), left + 6, y + 6, { width: labelW - 10, lineBreak: false, ellipsis: true });
      doc.font("Noto").fontSize(fontSize).fillColor("#182433").text(text, left + labelW + 8, y + 4, { width: valueW, lineGap: 0.5 });
      y += h + 2;
    };

    section("Property details");
    if (!sale) row("LinkedIn profile", data.linkedinProfile || "Not provided");
    if (sale || (commercial && data.houseNumber)) row(propertyNumberLabel(data.propertyType), data.houseNumber);
    if (sale) {
      row("Street / locality", data.address);
    } else {
      row("Property address", data.address);
    }
    row("City", data.city);
    row("State", data.state);
    if (sale) {
      row("Existing bank loan", data.bankLoan);
      row("Bank name", data.bankLoan === "Yes" ? data.bankName : "Not applicable");
      row("Remarks", data.remarks || "Not provided");
    } else {
      row("Description", data.description || "Not provided");
      if (!commercial) row("Pet policy", data.pets || "Not provided");
    }
    doc.font("Noto").fontSize(8.5).fillColor(MUTED).text(sale ? "Property owner submission  ·  earthsar Real Estate Advisory" : "Property owner submission  ·  earthsar Real Estate Advisory", left, 808, { width, align: "center", lineBreak: false });
    doc.end();
  });
}

module.exports = {
  createRentPropertyPdf: data => createPropertyPdf(data, false),
  createSalePropertyPdf: data => createPropertyPdf(data, true)
};
