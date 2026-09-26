const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "public");
const port = Number(process.env.PORT || 3000);
const host = "127.0.0.1";
let loggedIn = false;
let nextReviewId = 2;
let nextGalleryId = 2;
let previewAdmin = { email: "preview@earthsar.local", name: "Preview Admin" };
let siteSettings = {
  stats: {
    years: "15",
    satisfaction: "100",
    properties: "5"
  },
  contact: {
    phone: "+91 79820 08930",
    whatsapp: "+91 79820 08930",
    email: "info@earthsar.in",
    address: "DLF Corporate Greens, Sector - 74A, Gurugram, Haryana",
    hours: "Mon-Sun, 10:00 am - 7:00 pm IST"
  },
  hero: {
    eyebrow: "Real estate advisory",
    title: "Honesty |\nTransparency |\nTrust",
    lead: "We don't just show properties. We help you understand them with smart advice, honest conversations and long-term relationships.",
    trust: ["Right Property", "Right Time", "Right Return"],
    cardTitle: "The 3R value",
    cardText: "Right property, right time, right return.",
    image: "assets/hero-property.jpg",
    imageAlt: "Luxury modern real estate property with infinity pool at sunset"
  },
  seo: {
    title: "earthsar | Real Estate Advisory in Gurugram & Delhi NCR",
    description: "earthsar offers transparent real estate advisory in Gurugram and Delhi NCR for home buying, investments, commercial property, selling and leasing.",
    keywords: "real estate advisory Gurugram, property advisor Delhi NCR, commercial property Gurugram, home buying advisor, earthsar",
    canonicalUrl: "",
    robots: "index, follow, max-image-preview:large",
    ogTitle: "earthsar | Real Estate Advisory in Gurugram & Delhi NCR",
    ogDescription: "Smart advice, honest conversations and long-term real estate relationships across Gurugram and Delhi NCR.",
    ogImage: "assets/hero-property.jpg",
    ogImageAlt: "Luxury modern real estate property with infinity pool at sunset",
    twitterTitle: "earthsar | Real Estate Advisory in Gurugram & Delhi NCR",
    twitterDescription: "Transparent real estate advisory for homes, investments, commercial property, selling and leasing."
  },
  team: [
    {
      name: "Mr. Naveen Sharma",
      role: "Founder",
      experience: "Real Estate Advisory & Sales Leadership",
      bio: "With 17+ years of experience in real estate, Naveen brings extensive expertise across residential and commercial real estate, sales, advisory and business development with a strong understanding of the Delhi-NCR market.\n\nA postgraduate in Business Management, he combines formal management education with years of hands-on experience working closely with the real estate developer ecosystem. This experience has given him a deeper understanding of project evaluation, market dynamics, negotiations and the due diligence required to make the right real estate decision.\n\nIn 2021, Naveen chose to build his journey as an independent real estate advisor, driven by a simple belief: real estate advice should put the client's interest before the transaction. His approach is built on knowledge, transparency, honest advice, strong negotiation and commitment to his word.\n\nOver the years, these principles have helped him build lasting relationships with clients, developers and industry partners, including a sophisticated clientele of senior professionals and business leaders. For Naveen, a successful transaction is not simply about closing a deal; it is about helping a client make a decision they can feel confident about, whether it is an investment or a home for their family.\n\nAt earthsar, he continues this relationship-first approach with a vision to make real estate advisory more transparent, knowledgeable and trust-driven.\n\nBeyond Real Estate\n\nA dedicated family man, Naveen believes that success should always leave room for the people who matter most.\n\nHe is equally committed to his health and personal discipline. Daily exercise and pranayama are an integral part of his routine, with consistency being a principle he follows every day. He often shares his daily fitness activity with his personal network as a simple way of motivating others to prioritise their health.\n\nAn avid marathoner, Naveen brings the same discipline, consistency and never-give-up spirit from his personal life into his professional journey.",
      photo: "assets/naveen-sharma.jpg"
    },
    {
      name: "Mr. Bhaskar Rawat",
      role: "Associate Director Sales and Strategy",
      experience: "17+ years in real estate",
      bio: "With 17+ years of experience in real estate, Bhaskar brings diverse experience across residential and commercial real estate, sales, channel development and advisory, with exposure to Delhi-NCR, Bengaluru, Chennai, Coimbatore, Kochi, Pune, Hyderabad and Dubai.\n\nA postgraduate in Business Management, he began his career in 2009 and went on to work with leading real estate organisations, gaining hands-on experience across multiple markets and understanding real estate from both the developer and customer perspective.\n\nDuring his years with a leading Indian real estate group, he pioneered cross-market sales from Delhi-NCR, building channel partnerships and introducing opportunities from other Indian markets to the region. His work also took him to Pune and Hyderabad for new market launches, giving him valuable exposure to diverse real estate ecosystems and professionally structured, compliance-driven practices.\n\nHe later moved into international real estate, working on Dubai properties and developing channel partnerships across North and East India. In 2019, he chose to move away from conventional employment and pursue independent real estate advisory, driven by a belief that clients need informed advice and the right opportunity, not simply a property being sold to them.\n\nToday, at earthsar, Bhaskar brings together his multi-market experience, market understanding and relationship-driven approach to help clients make real estate decisions with clarity, transparency and long-term perspective.\n\nBeyond Real Estate\n\nA committed family man, Bhaskar values his family and believes in maintaining a balance between professional growth and personal life.\n\nOutside work, he enjoys running, hiking, trekking and adventure, and regularly practices meditation, yoga and pranayama. He has also completed a 10-day Vipassana meditation course, reflecting his interest in discipline, awareness and personal growth.\n\nCuriosity, consistency, resilience and continuous learning remain central to both his personal and professional journey.",
      photo: "assets/bhaskar-rawat.jpg"
    },
    {
      name: "Dushyant Arora",
      role: "Manager Sales",
      experience: "Around 6 years in real estate",
      bio: "With around 6 years of experience in real estate, Dushyant brings youthful energy, confidence, adaptability and a strong ability to learn and execute.\n\nA graduate who began working at a young age, he brings experience from diverse fields along with a natural ability to connect with people. His real estate journey has been shaped by hands-on learning, curiosity and taking ownership quickly, developing strong practical knowledge across client coordination and end-to-end real estate transactions.\n\nKnown for being polite, approachable and dependable, Dushyant has a natural ability to build rapport with clients and make them comfortable from the very first interaction.\n\nDespite being one of the younger members of the team, his maturity, ambition and sense of responsibility set him apart. Focused on his goals and always willing to learn, he represents the next generation of real estate professionals at earthsar.",
      photo: "assets/dushyant-arora.png"
    },
    {
      name: "Mrs. Neha Sharma",
      role: "Marketing, Branding & Administration",
      experience: "Around 10 years across marketing, administration and operations",
      bio: "With around 10 years of experience across marketing, administration and business operations, Neha brings together creativity, organisation and a strong understanding of business.\n\nAn MBA with a specialisation in Marketing Management, she began her professional journey in administrative and corporate roles before moving into marketing and creative communication. Her passion for art and design gives her a natural eye for visual storytelling and branding communication.\n\nAt earthsar, Neha manages marketing, creatives, social media, lead generation, HR and administration, while also playing an active role in building the company's digital and operational presence.\n\nShe was instrumental in conceptualising the earthsar name and logo, helping shape the branding identity from the very beginning.\n\nA passionate artist, Neha brings together creativity, business understanding and attention to detail to help build a distinctive and consistent earthsar branding.",
      photo: "assets/neha-sharma.jpg"
    },
    {
      name: "Juber",
      role: "Asst. Manager Sales",
      experience: "Around 3 years in real estate",
      bio: "With around 3 years of experience in real estate, Juber brings a sincere, dependable and hands-on approach to his work.\n\nKnown for his reliability, discipline and commitment, he takes ownership of every responsibility entrusted to him and consistently ensures that tasks are completed with care and within timelines.\n\nConsistent, responsible and trustworthy, Juber is a dependable member of the earthsar team.",
      photo: "assets/juber.jpeg"
    }
  ]
};

const sitemapUrls = [
  ["", "weekly", "1.0"],
  ["about.html", "monthly", "0.8"],
  ["services.html", "monthly", "0.9"],
  ["real-estate-advisory-gurugram.html", "monthly", "0.8"],
  ["contact.html", "monthly", "0.7"],
  ["privacy.html", "yearly", "0.3"],
  ["terms.html", "yearly", "0.3"],
  ["disclaimer.html", "yearly", "0.3"]
];

const sampleReviews = [
  {
    id: 1,
    name: "Preview Client",
    email: "client@example.com",
    phone: "+91 98100 00000",
    rating: 5,
    message: "The team explained the property and paperwork clearly. This is sample preview data.",
    status: "pending",
    verified: false,
    adminNote: "",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    avatar: null,
    media: [],
    videoLink: null
  }
];
const sampleGallery = [
  {
    id: 1,
    title: "Preview gallery item",
    caption: "Sample admin preview item",
    published: true,
    sortOrder: 1,
    uploadedHere: false,
    createdAt: new Date().toISOString(),
    type: "image",
    url: "/assets/hero-property.jpg",
    thumb: "/assets/hero-property.jpg",
    full: "/assets/hero-property.jpg"
  }
];
const sampleEnquiries = [
  {
    id: 1,
    name: "Ravi Preview",
    phone: "+91 98100 12345",
    email: "ravi@example.com",
    topic: "Buying a home",
    message: "This is a sample enquiry so you can see the admin panel layout.",
    handled: false,
    status: "new",
    note: "",
    followUp: "",
    createdAt: new Date().toISOString()
  }
];

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-cache" });
  res.end(body);
}

function json(res, status, body) {
  send(res, status, JSON.stringify(body), "application/json; charset=utf-8");
}

function drain(req, done) {
  req.on("data", () => {});
  req.on("end", done);
  req.on("error", done);
}

function readBody(req, done) {
  const chunks = [];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", () => done(Buffer.concat(chunks)));
  req.on("error", () => done(Buffer.alloc(0)));
}

function readJson(req, done) {
  let body = "";
  req.on("data", chunk => { body += chunk; });
  req.on("end", () => {
    try {
      done(body ? JSON.parse(body) : {});
    } catch {
      done({});
    }
  });
  req.on("error", () => done({}));
}

function parseForm(req, done) {
  readBody(req, body => {
    const type = req.headers["content-type"] || "";
    if (type.includes("application/json")) {
      try {
        return done(body.length ? JSON.parse(body.toString("utf8")) : {});
      } catch {
        return done({});
      }
    }
    if (type.includes("application/x-www-form-urlencoded")) {
      return done(Object.fromEntries(new URLSearchParams(body.toString("utf8"))));
    }
    const boundary = (type.match(/boundary=(?:"([^"]+)"|([^;]+))/) || [])[1] || (type.match(/boundary=(?:"([^"]+)"|([^;]+))/) || [])[2];
    if (!boundary) return done({});
    const fields = {};
    const parts = body.toString("binary").split("--" + boundary);
    for (const part of parts) {
      const name = (part.match(/name="([^"]+)"/) || [])[1];
      const filename = /filename="/.test(part);
      const splitAt = part.indexOf("\r\n\r\n");
      if (!name || filename || splitAt === -1) continue;
      fields[name] = part.slice(splitAt + 4).replace(/\r\n$/, "");
    }
    done(fields);
  });
}

function publicReview(review) {
  return {
    id: review.id,
    name: review.name,
    rating: review.rating,
    message: review.message,
    verified: review.verified,
    createdAt: review.createdAt,
    avatar: review.avatar || "",
    media: review.media || [],
    videoLink: review.videoLink || null
  };
}

function reviewSummary(reviews) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const review of reviews) {
    distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    total += review.rating;
  }
  return {
    count: reviews.length,
    average: reviews.length ? +(total / reviews.length).toFixed(2) : 0,
    distribution
  };
}

function createPreviewReview(body) {
  const name = String(body.name || "").trim().slice(0, 80);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
  const phone = String(body.phone || "").trim().slice(0, 30);
  const message = String(body.message || "").trim().slice(0, 1500);
  const rating = Math.max(1, Math.min(5, parseInt(body.rating, 10) || 5));
  return {
    id: nextReviewId++,
    name: name || "Preview Client",
    email: email || "client@example.com",
    phone,
    rating,
    message: message || "Preview review submitted from the website.",
    status: "pending",
    verified: false,
    adminNote: "",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    avatar: null,
    media: [],
    videoLink: null
  };
}

function isAdmin(req) {
  return loggedIn || /(?:^|;\s*)es_preview_admin=1(?:;|$)/.test(req.headers.cookie || "");
}

function adminStats() {
  return {
    pending: sampleReviews.filter(r => r.status === "pending").length,
    approved: sampleReviews.filter(r => r.status === "approved").length,
    rejected: sampleReviews.filter(r => r.status === "rejected").length,
    average: reviewSummary(sampleReviews.filter(r => r.status === "approved")).average,
    gallery: sampleGallery.length,
    gallery_published: sampleGallery.filter(g => g.published).length,
    enquiries_new: sampleEnquiries.filter(e => !e.handled).length
  };
}

function findId(pathname, pattern) {
  const m = pathname.match(pattern);
  return m ? Number(m[1]) : 0;
}

function adminApi(req, res, pathname, searchParams) {
  if (req.method === "POST" && pathname === "/api/admin/login") {
    return readJson(req, body => {
      loggedIn = true;
      previewAdmin.email = body.email || previewAdmin.email;
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-cache",
        "set-cookie": "es_preview_admin=1; Path=/; SameSite=Lax"
      });
      res.end(JSON.stringify({ admin: previewAdmin }));
    });
  }

  if (req.method === "POST" && pathname === "/api/admin/logout") {
    loggedIn = false;
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache",
      "set-cookie": "es_preview_admin=; Path=/; Max-Age=0; SameSite=Lax"
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (!isAdmin(req)) return json(res, 401, { error: "Preview mode: sign in with any email and password." });

  if (req.method === "GET" && pathname === "/api/admin/me") {
    return json(res, 200, {
      admin: previewAdmin,
      storage: { configured: true, name: "Preview storage" },
      limits: { adminUploadMb: 100 }
    });
  }

  if (req.method === "PATCH" && pathname === "/api/admin/profile") {
    return readJson(req, body => {
      previewAdmin = {
        email: String(body.email || previewAdmin.email).trim().toLowerCase(),
        name: String(body.name || "").trim()
      };
      json(res, 200, { admin: previewAdmin });
    });
  }

  if (req.method === "GET" && pathname === "/api/admin/stats") return json(res, 200, adminStats());

  if (req.method === "GET" && pathname === "/api/admin/settings") {
    return json(res, 200, { settings: siteSettings });
  }

  if (req.method === "PATCH" && pathname === "/api/admin/settings") {
    return readJson(req, body => {
      siteSettings = body.settings || siteSettings;
      json(res, 200, { settings: siteSettings });
    });
  }

  if (req.method === "GET" && pathname === "/api/admin/reviews") {
    const status = searchParams.get("status") || "pending";
    return json(res, 200, { reviews: sampleReviews.filter(r => r.status === status) });
  }

  if (req.method === "PATCH" && /^\/api\/admin\/reviews\/\d+$/.test(pathname)) {
    const id = findId(pathname, /reviews\/(\d+)/);
    return readJson(req, body => {
      const review = sampleReviews.find(r => r.id === id);
      if (!review) return json(res, 404, { error: "Review not found." });
      if (body.status) review.status = body.status;
      if (body.verified !== undefined) review.verified = Boolean(body.verified);
      if (body.adminNote !== undefined) review.adminNote = String(body.adminNote || "").trim();
      review.reviewedAt = review.status === "pending" ? null : new Date().toISOString();
      json(res, 200, { review });
    });
  }

  if (req.method === "POST" && /^\/api\/admin\/reviews\/\d+\/remove-media$/.test(pathname)) {
    const id = findId(pathname, /reviews\/(\d+)/);
    const review = sampleReviews.find(r => r.id === id);
    if (!review) return json(res, 404, { error: "Review not found." });
    return json(res, 200, { review });
  }

  if (req.method === "DELETE" && /^\/api\/admin\/reviews\/\d+$/.test(pathname)) {
    const id = findId(pathname, /reviews\/(\d+)/);
    const i = sampleReviews.findIndex(r => r.id === id);
    if (i >= 0) sampleReviews.splice(i, 1);
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/admin/gallery") return json(res, 200, { items: sampleGallery });

  if (req.method === "POST" && pathname === "/api/admin/gallery") {
    return readJson(req, body => {
      const item = {
        id: nextGalleryId++,
        title: body.title || "Linked media",
        caption: body.caption || "",
        published: body.published !== false,
        sortOrder: sampleGallery.length + 1,
        uploadedHere: false,
        createdAt: new Date().toISOString(),
        type: body.type === "video" ? "video" : "image",
        url: body.url,
        thumb: body.url,
        full: body.url
      };
      sampleGallery.unshift(item);
      json(res, 201, { item });
    });
  }

  if (req.method === "POST" && pathname === "/api/admin/gallery/upload") {
    return drain(req, () => {
      const item = {
        id: nextGalleryId++,
        title: "Preview upload",
        caption: "Uploads are mocked in preview mode.",
        published: true,
        sortOrder: sampleGallery.length + 1,
        uploadedHere: true,
        createdAt: new Date().toISOString(),
        type: "image",
        url: "/assets/hero-property.jpg",
        thumb: "/assets/hero-property.jpg",
        full: "/assets/hero-property.jpg"
      };
      sampleGallery.unshift(item);
      json(res, 201, { item });
    });
  }

  if (req.method === "PATCH" && /^\/api\/admin\/gallery\/\d+$/.test(pathname)) {
    const id = findId(pathname, /gallery\/(\d+)/);
    return readJson(req, body => {
      const item = sampleGallery.find(g => g.id === id);
      if (!item) return json(res, 404, { error: "Gallery item not found." });
      if (body.title !== undefined) item.title = body.title;
      if (body.caption !== undefined) item.caption = body.caption;
      if (body.published !== undefined) item.published = Boolean(body.published);
      json(res, 200, { item });
    });
  }

  if (req.method === "POST" && pathname === "/api/admin/gallery/reorder") return json(res, 200, { ok: true });

  if (req.method === "DELETE" && /^\/api\/admin\/gallery\/\d+$/.test(pathname)) {
    const id = findId(pathname, /gallery\/(\d+)/);
    const i = sampleGallery.findIndex(g => g.id === id);
    if (i >= 0) sampleGallery.splice(i, 1);
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/admin/enquiries") return json(res, 200, { enquiries: sampleEnquiries });

  if (req.method === "PATCH" && /^\/api\/admin\/enquiries\/\d+$/.test(pathname)) {
    const id = findId(pathname, /enquiries\/(\d+)/);
    return readJson(req, body => {
      const item = sampleEnquiries.find(e => e.id === id);
      if (!item) return json(res, 404, { error: "Enquiry not found." });
      if (body.handled !== undefined) item.handled = Boolean(body.handled);
      if (body.status !== undefined) item.status = body.status;
      if (body.note !== undefined) item.note = String(body.note || "").trim();
      if (body.followUp !== undefined) item.followUp = body.followUp || "";
      json(res, 200, { ok: true });
    });
  }

  if (req.method === "DELETE" && /^\/api\/admin\/enquiries\/\d+$/.test(pathname)) {
    const id = findId(pathname, /enquiries\/(\d+)/);
    const i = sampleEnquiries.findIndex(e => e.id === id);
    if (i >= 0) sampleEnquiries.splice(i, 1);
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/admin/password") return json(res, 200, { ok: true });

  return json(res, 404, { error: "Preview admin route not found." });
}

function api(req, res, pathname) {
  const url = new URL(req.url, `http://${host}:${port}`);
  if (pathname.startsWith("/api/admin")) return adminApi(req, res, pathname, url.searchParams);

  if (req.method === "GET" && pathname === "/api/reviews") {
    const approved = sampleReviews.filter(r => r.status === "approved");
    return json(res, 200, {
      reviews: approved.map(publicReview),
      summary: reviewSummary(approved),
      limits: { photoMb: 20, videoMb: 50 }
    });
  }

  if (req.method === "GET" && pathname === "/api/gallery") {
    return json(res, 200, { items: [] });
  }

  if (req.method === "GET" && pathname === "/api/settings") {
    return json(res, 200, { settings: siteSettings });
  }

  if (req.method === "POST" && pathname === "/api/reviews") {
    return parseForm(req, body => {
      sampleReviews.unshift(createPreviewReview(body));
      json(res, 201, { ok: true, preview: true });
    });
  }

  if (req.method === "POST" && pathname === "/api/enquiries") {
    return drain(req, () => json(res, 200, { ok: true, preview: true }));
  }

  return json(res, 404, { error: "Preview API route not found." });
}

function robots(req, res) {
  const origin = `http://${host}:${port}`;
  send(res, 200, `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`, "text/plain; charset=utf-8");
}

function sitemap(req, res) {
  const origin = `http://${host}:${port}`;
  const today = new Date().toISOString().slice(0, 10);
  send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(([path, changefreq, priority]) => `  <url>
    <loc>${origin}/${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join("\n")}
</urlset>
`, "application/xml; charset=utf-8");
}

function staticFile(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  let file = path.join(root, requested);
  const rel = path.relative(root, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return send(res, 403, "Forbidden");

  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (readErr, data) => {
      if (!readErr) return send(res, 200, data, types[path.extname(file).toLowerCase()] || "application/octet-stream");
      fs.readFile(path.join(root, "index.html"), (fallbackErr, fallback) => {
        if (fallbackErr) return send(res, 404, "Not found");
        send(res, 200, fallback, types[".html"]);
      });
    });
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${host}:${port}`);
  if (pathname === "/robots.txt") return robots(req, res);
  if (pathname === "/sitemap.xml") return sitemap(req, res);
  if (pathname.startsWith("/api/")) return api(req, res, pathname);
  staticFile(req, res, pathname);
});

server.listen(port, host, () => {
  console.log(`earthsar preview running on http://${host}:${port}`);
  console.log("Preview API is mocked; configure DATABASE_URL to run the real backend.");
});

server.on("error", err => {
  console.error(err.message);
  process.exit(1);
});
