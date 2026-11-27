/* Endpoints used by the public website. */
const express = require("express");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const fs = require("fs/promises");
const config = require("../config");
const { query } = require("../db");
const media = require("../media");
const { sanitizeSiteSettings } = require("../site-settings");
const { makeUpload, allFiles, cleanup, check, UserError } = require("../uploads");
const { createClientProfilePdf } = require("../client-profile-pdf");
const { createRentPropertyPdf, createSalePropertyPdf } = require("../rent-property-pdf");
const { isCommercialProperty, propertyNumberLabel } = require("../property-type");

const router = express.Router();

const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validLinkedInProfile = value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["linkedin.com", "www.linkedin.com"].includes(url.hostname.toLowerCase()) && /^\/(in|pub)\//i.test(url.pathname);
  } catch {
    return false;
  }
};

async function readSiteSettings() {
  const { rows } = await query("SELECT setting_value FROM site_settings WHERE setting_key = 'site'");
  let saved = {};
  if (rows && rows[0]) {
    try {
      saved = typeof rows[0].setting_value === "string" ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
    } catch {
      saved = {};
    }
  }
  return sanitizeSiteSettings(saved);
}
const configuredChoices = (form, key) => (form.options && form.options[key] || []).filter(choice => choice && choice.visible !== false).map(choice => choice.value);

router.use(async (req, res, next) => {
  if (req.path === "/settings" || req.path === "/homepage" || req.path === "/health" || req.path.startsWith("/admin")) return next();
  try {
    const settings = await readSiteSettings();
    if (settings.maintenance && settings.maintenance.enabled) {
      res.set("Cache-Control", "no-cache");
      return res.status(503).json({ error: "The website is currently in maintenance mode." });
    }
  } catch (err) {
    console.warn("Could not check maintenance mode:", err.message);
  }
  next();
});

/* ---------- Reviews ---------- */

router.get("/homepage", async (req, res) => {
  const settings = await readSiteSettings();
  if (settings.maintenance && settings.maintenance.enabled) {
    return res.status(503).json({ error: "The website is currently in maintenance mode." });
  }
  const [{ rows: reviews }, { rows: gallery }] = await Promise.all([
    query("SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 500"),
    query("SELECT * FROM gallery_items WHERE published = 1 ORDER BY sort_order ASC, created_at DESC LIMIT 300")
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const review of reviews) {
    distribution[review.rating]++;
    total += review.rating;
  }
  res.set("Cache-Control", "no-cache");
  res.json({
    settings,
    summary: { count: reviews.length, average: reviews.length ? +(total / reviews.length).toFixed(2) : 0, distribution },
    limits: { photoMb: config.limits.reviewPhotoMb, videoMb: config.limits.reviewVideoMb },
    reviews: reviews.map(publicReview),
    gallery: gallery.map(item => ({ id: item.id, title: item.title, caption: item.caption, ...media.present({ type: item.type, url: item.url }) }))
  });
});

function publicReview(r) {
  const link = r.video_link ? media.parseVideoLink(r.video_link) : null;
  return {
    id: r.id,
    name: r.name,
    rating: r.rating,
    message: r.message,
    verified: r.verified,
    createdAt: r.created_at,
    avatar: r.avatar ? media.transform(r.avatar.url, "c_fill,g_face,w_160,h_160,f_auto,q_auto") : "",
    media: (r.media || []).map(media.present).filter(Boolean),
    videoLink: link ? { type: "video", url: link.url, embed: link.embed, thumb: link.thumb, full: "" } : null
  };
}

router.get("/reviews", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 500");
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    for (const r of rows) {
      distribution[r.rating]++;
      total += r.rating;
    }
    res.set("Cache-Control", "no-cache");
    res.json({
      summary: { count: rows.length, average: rows.length ? +(total / rows.length).toFixed(2) : 0, distribution },
      limits: { photoMb: config.limits.reviewPhotoMb, videoMb: config.limits.reviewVideoMb },
      reviews: rows.map(publicReview)
    });
  } catch (err) {
    console.warn("Could not fetch reviews:", err.message);
    res.set("Cache-Control", "no-cache");
    res.json({
      summary: { count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
      limits: { photoMb: config.limits.reviewPhotoMb, videoMb: config.limits.reviewVideoMb },
      reviews: []
    });
  }
});

const skipInTests = () => process.env.NODE_ENV === "test";

const reviewLimiter = rateLimit({
  skip: skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many reviews from this connection. Try again in an hour." }
});

const L = config.limits;
const reviewUpload = makeUpload(Math.max(L.reviewPhotoMb, L.reviewVideoMb)).fields([
  { name: "avatar", maxCount: 1 },
  { name: "photos", maxCount: 4 },
  { name: "video", maxCount: 1 }
]);

router.post("/reviews", reviewLimiter, reviewUpload, async (req, res) => {
  const uploaded = [];
  try {
    const b = req.body || {};
    // Hidden field that people never see; bots tend to fill it in.
    if (b.website) return res.status(201).json({ ok: true });

    const name = str(b.name, 80);
    const email = str(b.email, 200).toLowerCase();
    const phone = str(b.phone, 30);
    const message = str(b.message, 1500);
    const rating = parseInt(b.rating, 10);
    const videoLinkRaw = str(b.videoLink, 500);

    const errors = {};
    if (name.length < 2) errors.name = "Enter your name.";
    if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
    if (!(rating >= 1 && rating <= 5)) errors.rating = "Choose a rating from 1 to 5 stars.";
    if (message.length < 3) errors.message = "Write a few words about your experience.";
    const link = videoLinkRaw ? media.parseVideoLink(videoLinkRaw) : null;
    if (videoLinkRaw && !link) errors.videoLink = "Paste a full YouTube or Vimeo link.";
    if (Object.keys(errors).length) return res.status(400).json({ error: "Check the highlighted fields.", fields: errors });

    const f = req.files || {};
    const avatarFile = (f.avatar || [])[0];
    const photoFiles = f.photos || [];
    const videoFile = (f.video || [])[0];
    if (avatarFile) await check(avatarFile, { kind: "image", maxMb: L.reviewPhotoMb, label: "Profile photo" });
    for (const [i, p] of photoFiles.entries()) await check(p, { kind: "image", maxMb: L.reviewPhotoMb, label: `Photo ${i + 1}` });
    if (videoFile) await check(videoFile, { kind: "video", maxMb: L.reviewVideoMb, label: "Video" });

    // Store in parallel and remember each one so we can undo on failure.
    const track = p => p.then(r => (uploaded.push(r), r));
    const [avatar, photos, video] = await Promise.all([
      avatarFile ? track(media.uploadFile(avatarFile, "image", "reviews")) : null,
      Promise.all(photoFiles.map(p => track(media.uploadFile(p, "image", "reviews")))),
      videoFile ? track(media.uploadFile(videoFile, "video", "reviews")) : null
    ]);

    const items = [...photos, ...(video ? [video] : [])];
    await query(
      `INSERT INTO reviews (name, email, phone, rating, message, avatar, media, video_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone, rating, message, avatar ? JSON.stringify(avatar) : null, JSON.stringify(items), link ? link.url : ""]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    if (uploaded.length) media.destroy(uploaded);
    if (err.expose) return res.status(err.status).json({ error: err.message });
    if (err.http_code || err.error) {
      console.error("Media upload failed:", err.message || err.error);
      return res.status(502).json({ error: "Your files could not be uploaded. Try again, or send the review without them." });
    }
    throw err;
  } finally {
    cleanup(req);
  }
});

/* ---------- Gallery ---------- */

router.get("/gallery", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM gallery_items WHERE published = 1 ORDER BY sort_order ASC, created_at DESC LIMIT 300");
    res.set("Cache-Control", "no-cache");
    res.json({
      items: rows.map(g => ({ id: g.id, title: g.title, caption: g.caption, ...media.present({ type: g.type, url: g.url }) }))
    });
  } catch (err) {
    console.warn("Could not fetch gallery:", err.message);
    res.set("Cache-Control", "no-cache");
    res.json({ items: [] });
  }
});

/* ---------- Website settings ---------- */

router.get("/settings", async (req, res) => {
  try {
    res.set("Cache-Control", "no-cache");
    res.json({ settings: await readSiteSettings() });
  } catch (err) {
    console.warn("Could not fetch settings from DB, using defaults:", err.message);
    res.set("Cache-Control", "no-cache");
    res.json({ settings: sanitizeSiteSettings({}) });
  }
});

/* ---------- Enquiries ---------- */

const enquiryLimiter = rateLimit({
  skip: skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many enquiries from this connection. Call us instead, or try again later." }
});

const profileLimiter = rateLimit({
  skip: skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many profile submissions. Please try again later." }
});
const profileUpload = makeUpload(3).single("photo");

function profileImageDimensions(buffer, mime) {
  if (mime === "image/png" && buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mime !== "image/jpeg" || buffer.length < 4) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset++; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { offset += 2; continue; }
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

router.post("/client-profile", profileLimiter, profileUpload, async (req, res, next) => {
  try {
    const b = req.body || {};
    const formSettings = (await readSiteSettings()).forms.clientProfile;
    const enabled = key => formSettings.fields[key] !== false;
    if (b.website) return res.status(201).json({ ok: true });

    const data = {
      reference: `CP-${require("crypto").randomBytes(3).toString("hex").toUpperCase()}`,
      name: str(b.name, 100),
      email: str(b.email, 200).toLowerCase(),
      phone: str(b.phone, 30),
      hasLinkedIn: str(b.hasLinkedIn, 3),
      linkedinProfile: str(b.linkedinProfile, 250),
      offerDate: str(b.offerDate, 10),
      familyCount: str(b.familyCount, 3),
      familyDetails: str(b.familyDetails, 180),
      nativePlace: str(b.nativePlace, 100),
      shiftingFrom: str(b.shiftingFrom, 100),
      shiftDate: str(b.shiftDate, 10),
      education: str(b.education, 120),
      company: str(b.company, 120),
      designation: str(b.designation, 120),
      wifeWorks: str(b.wifeWorks, 3),
      wifeCompany: str(b.wifeCompany, 120),
      wifeDesignation: str(b.wifeDesignation, 120),
      preferredFlat: str(b.preferredFlat, 40),
      budget: str(b.budget, 12),
      hasPets: str(b.hasPets, 3),
      pets: str(b.pets, 300)
    };
    const errors = {};
    if (data.name.length < 2) errors.name = "Enter the client's full name.";
    if (!EMAIL_RE.test(data.email)) errors.email = "Enter a valid email address.";
    if (!["Yes", "No"].includes(data.hasLinkedIn)) errors.hasLinkedIn = "Please choose Yes or No for LinkedIn.";
    if (data.hasLinkedIn === "Yes" && enabled("linkedinProfile") && data.linkedinProfile && !validLinkedInProfile(data.linkedinProfile)) errors.linkedinProfile = "Enter a valid LinkedIn profile URL.";
    if (data.phone.replace(/\D/g, "").length < 7) errors.phone = "Enter a valid phone number.";
    if (enabled("offerDate") && !/^\d{4}-\d{2}-\d{2}$/.test(data.offerDate)) errors.offerDate = "Choose the offer date.";
    if (enabled("familyCount") && (!/^\d{1,2}$/.test(data.familyCount) || +data.familyCount < 1 || +data.familyCount > 30)) errors.familyCount = "Enter a family size from 1 to 30.";
    if (enabled("familyDetails") && !data.familyDetails) errors.familyDetails = "Add the details of household members who will reside regularly.";
    if (enabled("nativePlace") && !data.nativePlace) errors.nativePlace = "Enter the client's native place.";
    if (enabled("shiftingFrom") && !data.shiftingFrom) errors.shiftingFrom = "Enter where the client is shifting from.";
    if (enabled("shiftDate") && !/^\d{4}-\d{2}-\d{2}$/.test(data.shiftDate)) errors.shiftDate = "Choose the expected shifting date.";
    if (enabled("education") && !data.education) errors.education = "Enter the educational background.";
    if (enabled("company") && !data.company) errors.company = "Enter the working company or profession.";
    if (enabled("designation") && !data.designation) errors.designation = "Enter the designation.";
    if (!["Yes", "No"].includes(data.wifeWorks)) errors.wifeWorks = "Please choose Yes or No.";
    if (data.wifeWorks === "Yes" && enabled("wifeCompany") && !data.wifeCompany) errors.wifeCompany = "Enter your spouse’s company name.";
    if (data.wifeWorks === "Yes" && enabled("wifeDesignation") && !data.wifeDesignation) errors.wifeDesignation = "Enter your spouse’s designation.";
    if (enabled("preferredFlat") && !configuredChoices(formSettings, "preferredFlat").includes(data.preferredFlat)) errors.preferredFlat = "Choose the preferred flat size.";
    if (enabled("budget") && (!/^\d{1,10}$/.test(data.budget) || +data.budget < 1)) errors.budget = "Enter the monthly rental budget in rupees.";
    if (!["Yes", "No"].includes(data.hasPets)) errors.hasPets = "Please choose Yes or No for pets.";
    if (b.consent !== "on") errors.consent = "Consent is required to send this profile to earthsar.";
    if (Object.keys(errors).length) return res.status(400).json({ error: "Check the highlighted fields.", fields: errors });

    if (!config.smtp.host || !config.smtp.port || !config.smtp.user || !config.smtp.pass || !config.smtp.from) {
      return res.status(503).json({ error: "Profile email delivery is not configured yet. Please contact earthsar directly." });
    }

    let photo;
    if (req.file) {
      await check(req.file, { kind: "image", maxMb: 3, label: "Client photo" });
      if (!["image/jpeg", "image/png"].includes(req.file.verifiedMime)) {
        throw new UserError("Client photo must be a JPG or PNG image.");
      }
      const buffer = await fs.readFile(req.file.path);
      const dimensions = profileImageDimensions(buffer, req.file.verifiedMime);
      if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 6000 || dimensions.height > 6000 || dimensions.width * dimensions.height > 20000000) {
        throw new UserError("Client photo dimensions are too large. Choose an image up to 20 megapixels.");
      }
      photo = { buffer, mime: req.file.verifiedMime };
    }

    const pdf = await createClientProfilePdf(data, photo);
    const safeName = data.name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "Client";
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass }
    });
    await transporter.sendMail({
      from: config.smtp.from,
      to: "info@earthsar.in",
      replyTo: data.email,
      subject: `Client profile · ${data.name} · ${data.reference}`,
      text: `A client profile was submitted through earthsar.in.\n\nClient: ${data.name}\nPhone: ${data.phone}\nEmail: ${data.email}\nReference: ${data.reference}\n\nThe completed client profile is attached as a PDF.`,
      attachments: [{ filename: `earthsar-client-profile-${safeName}.pdf`, content: pdf, contentType: "application/pdf" }]
    });
    res.status(201).json({ ok: true, reference: data.reference });
  } catch (err) {
    next(err);
  } finally {
    cleanup(req);
  }
});

const rentPropertyLimiter = rateLimit({
  skip: skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many property submissions. Please try again later." }
});

router.post("/rent-property", rentPropertyLimiter, express.json({ limit: "20kb" }), async (req, res) => {
  if (req.body && req.body.website) return res.status(201).json({ ok: true });
  const b = req.body || {};
  const formSettings = (await readSiteSettings()).forms.rentProperty;
  const enabled = key => formSettings.fields[key] !== false;
  const data = {
    reference: `RP-${require("crypto").randomBytes(3).toString("hex").toUpperCase()}`,
    name: str(b.name, 100),
    email: str(b.email, 200).toLowerCase(),
    phone: str(b.phone, 30),
    propertyType: str(b.propertyType, 30),
    bhk: str(b.bhk, 20),
    floor: str(b.floor, 30),
    address: str(b.address, 300),
    city: str(b.city, 80),
    state: str(b.state, 80),
    area: str(b.area, 8),
    rent: str(b.rent, 12),
    description: str(b.description, 600),
    linkedinProfile: str(b.linkedinProfile, 250),
    houseNumber: str(b.houseNumber, 60),
    pets: str(b.pets, 300)
  };
  const errors = {};
  if (data.name.length < 2) errors.name = "Enter your full name.";
  if (!EMAIL_RE.test(data.email)) errors.email = "Enter a valid email address.";
  if (enabled("linkedinProfile") && data.linkedinProfile && !validLinkedInProfile(data.linkedinProfile)) errors.linkedinProfile = "Enter a valid LinkedIn profile URL.";
  if (data.phone.replace(/\D/g, "").length < 7) errors.phone = "Enter a valid phone number.";
  if (enabled("propertyType") && !configuredChoices(formSettings, "propertyType").includes(data.propertyType)) errors.propertyType = "Choose a property type.";
  const commercial = isCommercialProperty(data.propertyType);
  if (!commercial && enabled("bhk") && !configuredChoices(formSettings, "bhk").includes(data.bhk)) errors.bhk = "Choose the BHK configuration.";
  if (enabled("floor") && !data.floor) errors.floor = "Enter the property floor.";
  if (commercial && enabled("houseNumber") && !data.houseNumber) errors.houseNumber = `Enter the ${propertyNumberLabel(data.propertyType).toLowerCase()}`;
  if (enabled("address") && data.address.length < 5) errors.address = "Enter the property address.";
  if (enabled("city") && !data.city) errors.city = "Enter the city.";
  if (enabled("state") && !data.state) errors.state = "Enter the state.";
  if (enabled("area") && (!/^\d{2,7}$/.test(data.area) || +data.area < 100)) errors.area = "Enter the area in square feet.";
  if (enabled("rent") && (!/^\d{1,10}$/.test(data.rent) || +data.rent < 1)) errors.rent = "Enter the monthly rent amount in rupees.";
  if (b.consent !== true) errors.consent = "Please confirm that we may contact you about the property.";
  if (Object.keys(errors).length) return res.status(400).json({ error: "Check the highlighted fields.", fields: errors });
  if (!config.smtp.host || !config.smtp.port || !config.smtp.user || !config.smtp.pass || !config.smtp.from) {
    return res.status(503).json({ error: "Email delivery is not configured yet. Please contact earthsar directly." });
  }

  try {
    const pdf = await createRentPropertyPdf(data);
    const safeName = data.name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "Owner";
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
    await transporter.sendMail({
      from: config.smtp.from,
      to: "info@earthsar.in",
      replyTo: data.email,
      subject: `Rental property submission · ${data.name} · ${data.reference}`,
      text: `A property was submitted for rent through earthsar.in.\n\nOwner: ${data.name}\nPhone: ${data.phone}\nEmail: ${data.email}\nProperty: ${data.propertyType}${commercial ? "" : `, ${data.bhk}`}\nFloor: ${data.floor}\nArea: ${data.area} sq ft\n${commercial && data.houseNumber ? `${propertyNumberLabel(data.propertyType)}: ${data.houseNumber}\n` : ""}Address: ${data.address}\nCity: ${data.city}\nMonthly rent: INR ${data.rent}\nReference: ${data.reference}\n\nThe completed rental property details are attached as a PDF.`,
      attachments: [{ filename: `earthsar-rental-property-${safeName}.pdf`, content: pdf, contentType: "application/pdf" }]
    });
    res.status(201).json({ ok: true, reference: data.reference });
  } catch (err) {
    console.error("Could not email rental property submission:", err.message);
    res.status(500).json({ error: "The property details could not be emailed right now. Please try again or contact earthsar directly." });
  }
});

const salePropertyLimiter = rateLimit({
  skip: skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many property submissions. Please try again later." }
});

router.post("/sale-property", salePropertyLimiter, express.json({ limit: "20kb" }), async (req, res) => {
  if (req.body && req.body.website) return res.status(201).json({ ok: true });
  const b = req.body || {};
  const formSettings = (await readSiteSettings()).forms.saleProperty;
  const enabled = key => formSettings.fields[key] !== false;
  const data = {
    reference: `SP-${require("crypto").randomBytes(3).toString("hex").toUpperCase()}`,
    name: str(b.name, 100),
    email: str(b.email, 200).toLowerCase(),
    phone: str(b.phone, 30),
    propertyType: str(b.propertyType, 30),
    bhk: str(b.bhk, 20),
    floor: str(b.floor, 30),
    houseNumber: str(b.houseNumber, 60),
    address: str(b.address, 300),
    city: str(b.city, 80),
    state: str(b.state, 80),
    area: str(b.area, 8),
    saleAmount: str(b.saleAmount, 12),
    bankLoan: str(b.bankLoan, 3),
    bankName: str(b.bankName, 120),
    remarks: str(b.remarks, 600)
  };
  const errors = {};
  if (data.name.length < 2) errors.name = "Enter your full name.";
  if (!EMAIL_RE.test(data.email)) errors.email = "Enter a valid email address.";
  if (data.phone.replace(/\D/g, "").length < 7) errors.phone = "Enter a valid phone number.";
  if (enabled("propertyType") && !configuredChoices(formSettings, "propertyType").includes(data.propertyType)) errors.propertyType = "Choose a property type.";
  const commercial = isCommercialProperty(data.propertyType);
  if (!commercial && enabled("bhk") && !configuredChoices(formSettings, "bhk").includes(data.bhk)) errors.bhk = "Choose the BHK configuration.";
  if (enabled("floor") && !data.floor) errors.floor = "Enter the property floor.";
  if (enabled("houseNumber") && !data.houseNumber) errors.houseNumber = commercial ? `Enter the ${propertyNumberLabel(data.propertyType).toLowerCase()}` : "Enter the house or flat number.";
  if (enabled("address") && data.address.length < 5) errors.address = "Enter the street or locality.";
  if (enabled("city") && !data.city) errors.city = "Enter the city.";
  if (enabled("state") && !data.state) errors.state = "Enter the state.";
  if (enabled("area") && (!/^\d{2,7}$/.test(data.area) || +data.area < 100)) errors.area = "Enter the area in square feet.";
  if (enabled("saleAmount") && (!/^\d{1,12}$/.test(data.saleAmount) || +data.saleAmount < 1)) errors.saleAmount = "Enter the sale amount in rupees.";
  if (!["Yes", "No"].includes(data.bankLoan)) errors.bankLoan = "Please choose Yes or No for an existing bank loan.";
  if (data.bankLoan === "Yes" && enabled("bankName") && !data.bankName) errors.bankName = "Enter the bank name.";
  if (b.consent !== true) errors.consent = "Please confirm that we may contact you about the property.";
  if (Object.keys(errors).length) return res.status(400).json({ error: "Check the highlighted fields.", fields: errors });
  if (!config.smtp.host || !config.smtp.port || !config.smtp.user || !config.smtp.pass || !config.smtp.from) {
    return res.status(503).json({ error: "Email delivery is not configured yet. Please contact earthsar directly." });
  }

  try {
    const pdf = await createSalePropertyPdf(data);
    const safeName = data.name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "Owner";
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
    await transporter.sendMail({
      from: config.smtp.from,
      to: "info@earthsar.in",
      replyTo: data.email,
      subject: `Sale property submission · ${data.name} · ${data.reference}`,
      text: `A property was submitted for sale through earthsar.in.\n\nOwner: ${data.name}\nPhone: ${data.phone}\nEmail: ${data.email}\nProperty: ${data.propertyType}${commercial ? "" : `, ${data.bhk}`}\nAddress: ${data.houseNumber}, ${data.address}\nFloor: ${data.floor}\nArea: ${data.area} sq ft\nCity: ${data.city}\nSale amount: INR ${data.saleAmount}\nBank loan: ${data.bankLoan}${data.bankName ? ` (${data.bankName})` : ""}\nReference: ${data.reference}\n\nThe completed sale property details are attached as a PDF.`,
      attachments: [{ filename: `earthsar-sale-property-${safeName}.pdf`, content: pdf, contentType: "application/pdf" }]
    });
    res.status(201).json({ ok: true, reference: data.reference });
  } catch (err) {
    console.error("Could not email sale property submission:", err.message);
    res.status(500).json({ error: "The property details could not be emailed right now. Please try again or contact earthsar directly." });
  }
});

router.post("/enquiries", enquiryLimiter, express.json({ limit: "20kb" }), async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.status(201).json({ ok: true });
  const name = str(b.name, 80);
  const phone = str(b.phone, 30);
  const email = str(b.email, 200).toLowerCase();
  const errors = {};
  if (!name) errors.name = "Enter your name.";
  if (phone.replace(/\D/g, "").length < 7) errors.phone = "Enter a phone number we can call.";
  if (email && !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (b.consent !== true) errors.consent = "Please confirm we may contact you.";
  if (Object.keys(errors).length) return res.status(400).json({ error: "Check the highlighted fields.", fields: errors });
  await query("INSERT INTO enquiries (name, phone, email, topic, message) VALUES (?, ?, ?, ?, ?)", [
    name,
    phone,
    email,
    str(b.topic, 80),
    str(b.message, 3000)
  ]);
  res.status(201).json({ ok: true });
});

router.get("/health", async (req, res) => {
  await query("SELECT 1");
  res.json({ ok: true });
});

module.exports = router;
