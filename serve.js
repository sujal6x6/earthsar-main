const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // API Mocks for preview
  if (reqPath === '/api/settings') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      settings: {
        stats: { years: "10", satisfaction: "100", properties: "5" },
        contact: {
          phone: "+91 890 176 0000",
          whatsapp: "+91 890 176 0000",
          email: "earthzgroup@gmail.com",
          address: "SF001A, Emaar Emerald Plaza, Retail Block, Sector 65, Gurugram, Haryana",
          hours: "Mon-Sun, 10:00 am - 7:00 pm IST"
        },
        hero: {
          eyebrow: "Real estate advisory",
          title: "Right Property.\nRight Time.\nRight Return.",
          lead: "We don't just show properties. We help you understand them with smart advice, honest conversations and long-term relationships.",
          trust: ["Honesty", "Transparency", "Trust"],
          cardTitle: "The 3R value",
          cardText: "Right property, right time, right return.",
          image: "assets/hero-property.jpg",
          imageAlt: "Luxury modern real estate property"
        }
      }
    }));
  }

  if (reqPath === '/api/reviews') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      summary: { count: 2, average: 5.0, distribution: { 1:0, 2:0, 3:0, 4:0, 5:2 } },
      limits: { photoMb: 5, videoMb: 50 },
      reviews: [
        {
          id: 1,
          name: "Vikram Malhotra",
          rating: 5,
          message: "Exceptional advisory and complete transparency from Naveen and the team at earthsar. They helped us secure our dream home in Sector 65 Gurugram.",
          verified: true,
          createdAt: new Date().toISOString(),
          avatar: "",
          media: [],
          videoLink: null
        },
        {
          id: 2,
          name: "Ananya Deshmukh",
          rating: 5,
          message: "Very professional guidance on commercial leasing. The 3R value approach really sets them apart from typical brokers.",
          verified: true,
          createdAt: new Date().toISOString(),
          avatar: "",
          media: [],
          videoLink: null
        }
      ]
    }));
  }

  if (reqPath === '/api/gallery') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ items: [] }));
  }

  // Routing
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  if (reqPath === '/admin' || reqPath === '/admin/') reqPath = '/admin/index.html';

  let filePath = path.join(PUBLIC_DIR, reqPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
