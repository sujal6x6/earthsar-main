const DEFAULT_SITE_SETTINGS = {
  registration: require("../public/registration").defaults,
  stats: {
    years: "15",
    satisfaction: "100",
    properties: "5"
  },
  contact: {
    phone: "+91 79820 08930",
    whatsapp: "+91 79820 08930",
    email: "info@earthsar.in",
    address: "DLF Corporate Greens, Tower No. 4, 11th Floor, Office No. 1118, Sector 74A, Gurugram, Haryana",
    hours: "Monday to Sunday, 10:00 am to 7:00 pm IST"
  },
  hero: {
    eyebrow: "Real estate advisory",
    title: "Honesty | Transparency\nTrust",
    lead: "We don't just show properties. We help you understand them with smart advice, honest conversations and long-term relationships.",
    trust: ["Right Property", "Right Time", "Right Return"],
    cardTitle: "The 3R value",
    cardText: "Right property, right time, right return.",
    image: "assets/hero-property.jpg",
    imageAlt: "Luxury modern real estate property with infinity pool at sunset"
  },
  seo: {
    title: "earthsar | Real Estate Advisory in Gurugram & Delhi NCR",
    description: "earthsar offers transparent real estate advisory for home buying, investments, commercial property, selling and leasing across Gurugram, Delhi NCR, key Indian markets and Dubai.",
    keywords: "real estate advisory Gurugram, property advisor Delhi NCR, commercial property Gurugram, home buying advisor, earthsar",
    canonicalUrl: "",
    robots: "index, follow, max-image-preview:large",
    ogTitle: "earthsar | Real Estate Advisory in Gurugram & Delhi NCR",
    ogDescription: "Smart advice, honest conversations and long-term real estate relationships across Gurugram, Delhi NCR, key Indian markets and Dubai.",
    ogImage: "assets/hero-property.jpg",
    ogImageAlt: "Luxury modern real estate property with infinity pool at sunset",
    twitterTitle: "earthsar | Real Estate Advisory in Gurugram & Delhi NCR",
    twitterDescription: "Transparent real estate advisory for homes, investments, commercial property, selling and leasing across key Indian markets and Dubai."
  },
  maintenance: {
    enabled: false,
    title: "Website under maintenance",
    message: "We are making a few updates and will be back online shortly. For urgent property advice, please contact us directly."
  },
  partners: [
    { name: "Max Estates", logo: "icons/partners/max-estates.png", website: "https://www.maxestates.in/" },
    { name: "TARC", logo: "icons/partners/tarc.jpg", website: "https://www.tarc.in/" },
    { name: "Oberoi Realty", logo: "icons/partners/oberoi-realty.png", website: "https://www.oberoirealty.com/" },
    { name: "Birla Estates", logo: "icons/partners/birla-estates.png", website: "https://www.birlaestates.com/" },
    { name: "Hero Homes", logo: "icons/partners/hero-homes.webp", website: "https://www.herohomes.in/" },
    { name: "Aarize", logo: "icons/partners/aarize.jpg", website: "https://aarizegroup.com/" },
    { name: "SS Group", logo: "icons/partners/ss-group.jpg", website: "https://ssgroup-india.com/" },
    { name: "NeoLiv", logo: "icons/partners/neoliv.jpg", website: "https://neoliv.in/" },
    { name: "Vianaar", logo: "icons/partners/vianaar.jpg", website: "https://vianaar.com/" },
    { name: "Prestige Group", logo: "icons/partners/prestige-group.jpg", website: "https://www.prestigeconstructions.com/" },
    { name: "Lodha", logo: "icons/partners/lodha.png", website: "https://www.lodhagroup.in/" },
    { name: "L&T Realty", logo: "icons/partners/lt-realty.webp", website: "https://www.lntrealty.com/" },
    { name: "Ashiana Amarah", logo: "icons/partners/ashiana-amarah.png", website: "https://www.ashianahousing.com/" },
    { name: "Eldeco Group", logo: "icons/partners/eldeco-group.png", website: "https://www.eldecogroup.com/" },
    { name: "Sobha Realty", logo: "icons/partners/sobha-realty.jpg", website: "https://www.sobharealty.com/" },
    { name: "County Group", logo: "icons/partners/county-group.jpg", website: "https://www.countygroup.in/" },
    { name: "Shapoorji Pallonji", logo: "icons/partners/shapoorji-pallonji.jpg", website: "https://shapoorji.in/" }
  ],
  clientVideos: [
    {
      src: "assets/client-videos/client-testimonial-1.mp4",
      cover: "",
      placement: "testimonials",
      kicker: "",
      title: "Mr. Padam jeet ji",
      subtitle: ""
    },
    {
      src: "assets/client-videos/client-testimonial-2.mp4",
      cover: "",
      placement: "testimonials",
      kicker: "Client testimonial",
      title: "EarthZ client testimonial",
      subtitle: "Client feedback, shared in their own words"
    }
  ],
  team: [
    {
      name: "Mr. Naveen Sharma",
      role: "Founder",
      experience: "Real Estate Advisory & Sales Leadership",
      bio: "With 17+ years of experience in real estate, Naveen brings extensive expertise across residential and commercial real estate, sales, advisory and business development, with a strong understanding of the Delhi NCR market.\n\nA postgraduate in Business Management, he combines formal management education with years of hands-on experience working closely with the real estate developer ecosystem. This experience has given him a deeper understanding of project evaluation, market dynamics, negotiations and the due diligence required to make the right real estate decision.\n\nIn 2021, Naveen chose to build his journey as an independent real estate advisor, driven by a simple belief: real estate advice should put the client's interest before the transaction. His approach is built on knowledge, transparency, honest advice, strong negotiation skills and a commitment to his word.\n\nOver the years, these principles have helped him build lasting relationships with clients, developers and industry partners, including a sophisticated clientele of senior professionals and business leaders. For Naveen, a successful transaction is not simply about closing a deal; it is about helping a client make a decision they can feel confident about, whether it is an investment or a home for their family.\n\nAt earthsar, he continues this relationship-first approach with a vision to make real estate advisory more transparent, knowledgeable and trust-driven.\n\nBeyond Real Estate\n\nA dedicated family man, Naveen believes that success should always leave room for the people who matter most.\n\nHe is equally committed to his health and personal discipline. Daily exercise and pranayama are an integral part of his routine, and consistency is a principle he follows every day. He often shares his daily fitness activity with his personal network as a simple way of motivating others to prioritise their health.\n\nAn avid marathoner, Naveen brings the same discipline, consistency and never-give-up spirit from his personal life into his professional journey.",
      photo: "assets/naveen-sharma.jpg"
    },
    {
      name: "Mr. Bhaskar Rawat",
      role: "Associate Director Sales and Strategy",
      experience: "17+ years in real estate",
      bio: "With 17+ years of experience in real estate, Bhaskar brings diverse experience across residential and commercial real estate, sales, channel development and advisory, with exposure to Delhi NCR, Bengaluru, Chennai, Coimbatore, Kochi, Pune, Hyderabad and Dubai.\n\nA postgraduate in Business Management, he began his career in 2009 and went on to work with leading real estate organisations, gaining hands-on experience across multiple markets while understanding real estate from both the developer and customer perspectives.\n\nDuring his years with a leading Indian real estate group, he pioneered cross-market sales from Delhi NCR, building channel partnerships and introducing opportunities from other Indian markets to the region. His work also took him to Pune and Hyderabad for new market launches, giving him valuable exposure to diverse real estate ecosystems and professionally structured, compliance-driven practices.\n\nHe later moved into international real estate, working on Dubai properties and developing channel partnerships across North and East India. In 2019, he chose to move away from conventional employment and pursue independent real estate advisory, driven by a belief that clients need informed advice and the right opportunity, not simply another property pitch.\n\nToday, at earthsar, Bhaskar brings together his multi-market experience, market understanding and relationship-driven approach to help clients make real estate decisions with clarity, transparency and long-term perspective.\n\nBeyond Real Estate\n\nA committed family man, Bhaskar values his family and believes in maintaining a balance between professional growth and personal life.\n\nOutside work, he enjoys running, hiking, trekking and adventure, and regularly practices meditation, yoga and pranayama. He has also completed a 10-day Vipassana meditation course, reflecting his interest in discipline, awareness and personal growth.\n\nCuriosity, consistency, resilience and continuous learning remain central to both his personal and professional journey.",
      photo: "assets/bhaskar-rawat.jpg"
    },
    {
      name: "Mrs. Neha Sharma",
      role: "Marketing, Branding & Administration",
      experience: "Around 10 years across marketing, administration and operations",
      bio: "With around 10 years of experience across marketing, administration and business operations, Neha brings together creativity, organisation and a strong understanding of business.\n\nAn MBA with a specialisation in Marketing Management, she began her professional journey in administrative and corporate roles before moving into marketing and creative communication. Her passion for art and design gives her a natural eye for visual storytelling and brand communication.\n\nAt earthsar, Neha manages marketing, creatives, social media, lead generation, HR and administration, while also playing an active role in building the company's digital and operational presence.\n\nShe was instrumental in conceptualising the earthsar name and logo, helping shape the brand identity from the very beginning.\n\nA passionate artist, Neha brings together creativity, business understanding and attention to detail to help build distinctive and consistent earthsar branding.",
      photo: "assets/neha-sharma.jpg"
    },
    {
      name: "Mr. Dushyant Arora",
      role: "Manager Sales",
      experience: "Around 6 years in real estate",
      bio: "With around 6 years of experience in real estate, Dushyant brings youthful energy, confidence, adaptability and a strong ability to learn and execute.\n\nA graduate who began working at a young age, he brings experience from diverse fields along with a natural ability to connect with people. His real estate journey has been shaped by hands-on learning, curiosity and taking ownership quickly, developing strong practical knowledge across client coordination and end-to-end real estate transactions.\n\nKnown for being polite, approachable and dependable, Dushyant has a natural ability to build rapport with clients and make them comfortable from the very first interaction.\n\nDespite being one of the younger members of the team, his maturity, ambition and sense of responsibility set him apart. Focused on his goals and always willing to learn, he represents the next generation of real estate professionals at earthsar.",
      photo: "assets/dushyant-arora.png"
    },
    {
      name: "Mr. Juber",
      role: "Asst. Manager Sales",
      experience: "Around 3 years in real estate",
      bio: "With around 3 years of experience in real estate, Juber brings a sincere, dependable and hands-on approach to his work.\n\nKnown for his reliability, discipline and commitment, he takes ownership of every responsibility entrusted to him and consistently ensures that tasks are completed with care and on time.\n\nConsistent, responsible and trustworthy, Juber is a dependable member of the earthsar team.",
      photo: "assets/juber.jpeg"
    }
  ]
};

function text(v, max) {
  return String(v == null ? "" : v).trim().slice(0, max);
}

function cleanStats(stats = {}) {
  return {
    years: text(stats.years, 12),
    satisfaction: text(stats.satisfaction, 12),
    properties: text(stats.properties, 12)
  };
}

function cleanContact(contact = {}) {
  let address = text(contact.address, 300);
  if (/DLF Corporate Greens,\s*Sector\s*-\s*74A/i.test(address)) {
    address = DEFAULT_SITE_SETTINGS.contact.address;
  }
  return {
    phone: text(contact.phone, 40),
    whatsapp: text(contact.whatsapp, 40),
    email: text(contact.email, 255).toLowerCase(),
    address,
    hours: text(contact.hours, 120)
  };
}

function cleanHero(hero = {}) {
  const trust = Array.isArray(hero.trust) ? hero.trust : String(hero.trust || "").split(/[|,\n]/);
  return {
    eyebrow: text(hero.eyebrow, 80),
    title: text(hero.title, 180),
    lead: text(hero.lead, 360),
    trust: trust.map(t => text(t, 40)).filter(Boolean).slice(0, 5),
    cardTitle: text(hero.cardTitle, 80),
    cardText: text(hero.cardText, 180),
    image: text(hero.image, 300),
    imageAlt: text(hero.imageAlt, 180)
  };
}

function cleanSeo(seo = {}) {
  const robots = text(seo.robots, 120) || DEFAULT_SITE_SETTINGS.seo.robots;
  return {
    title: text(seo.title, 90),
    description: text(seo.description, 180),
    keywords: text(seo.keywords, 400),
    canonicalUrl: text(seo.canonicalUrl, 300),
    robots,
    ogTitle: text(seo.ogTitle, 90),
    ogDescription: text(seo.ogDescription, 220),
    ogImage: text(seo.ogImage, 300),
    ogImageAlt: text(seo.ogImageAlt, 180),
    twitterTitle: text(seo.twitterTitle, 90),
    twitterDescription: text(seo.twitterDescription, 220)
  };
}

function cleanMaintenance(maintenance = {}) {
  return {
    enabled: maintenance.enabled === true || maintenance.enabled === "true" || maintenance.enabled === 1 || maintenance.enabled === "1",
    title: text(maintenance.title || DEFAULT_SITE_SETTINGS.maintenance.title, 90),
    message: text(maintenance.message || DEFAULT_SITE_SETTINGS.maintenance.message, 300)
  };
}

function cleanTeam(team = []) {
  return (Array.isArray(team) ? team : []).slice(0, 20).map(member => {
    member = member || {};
    return {
    showSocial: member.showSocial === true || member.showSocial === "true" || member.showSocial === 1 || member.showSocial === "1",
    name: text(member.name, 120),
    role: text(member.role, 120),
    experience: text(member.experience, 160),
    bio: text(member.bio, 3000),
    photo: text(member.photo, 300),
    linkedin: text(member.linkedin, 300),
    social: {
      linkedin: text((member.social && member.social.linkedin) || member.linkedin, 600),
      instagram: text(member.social && member.social.instagram, 600),
      facebook: text(member.social && member.social.facebook, 600),
      x: text(member.social && member.social.x, 600),
      youtube: text(member.social && member.social.youtube, 600)
    }
  };
  });
}

function cleanPartners(partners = []) {
  const list = Array.isArray(partners) ? partners : [];
  return list
    .slice(0, 50)
    .map(partner => ({
      name: text(partner.name, 120),
      logo: text(partner.logo, 600),
      website: text(partner.website, 600)
    }))
    .filter(partner => partner.name || partner.logo || partner.website);
}

function isPlaceholderPartners(partners = []) {
  const list = Array.isArray(partners) ? partners : [];
  return list.length > 0 && list.every((partner, index) => {
    const name = text(partner && partner.name, 120);
    return name === `Partner ${index + 1}`;
  });
}

function cleanClientVideos(videos = []) {
  const input = Array.isArray(videos) ? videos : [];
  const source = input.length ? input : DEFAULT_SITE_SETTINGS.clientVideos;
  const cleaned = source.slice(0, 20).map((item, index) => {
    const def = DEFAULT_SITE_SETTINGS.clientVideos[index] || {};
    item = item || {};
    return {
      src: text(item.src || def.src, 600),
      cover: text(item.cover || def.cover, 600),
      placement: item.placement === "review-media" ? "review-media" : "testimonials",
      kicker: text(item.kicker || def.kicker, 60),
      title: text(item.title || def.title, 120),
      subtitle: text(item.subtitle || def.subtitle, 160)
    };
  }).filter(video => video.src || video.title || video.cover);
  const hasVideo = def => cleaned.some(video => {
    const src = String(video.src || "");
    const title = String(video.title || "");
    return src.includes(def.src) || (def.title && title.toLowerCase() === def.title.toLowerCase());
  });
  const requiredDefaults = DEFAULT_SITE_SETTINGS.clientVideos.filter(def => !hasVideo(def));
  return [...requiredDefaults, ...cleaned].slice(0, 20);
}

function sanitizeSiteSettings(input = {}) {
  const savedPartners = input.partners && input.partners.length ? input.partners : null;
  const partnerSource = savedPartners && !isPlaceholderPartners(savedPartners) ? savedPartners : DEFAULT_SITE_SETTINGS.partners;
  return {
    registration: require("../public/registration").clean(input.registration),
    social: require("../public/social-links").clean(input.social),
    stats: cleanStats({ ...DEFAULT_SITE_SETTINGS.stats, ...(input.stats || {}) }),
    contact: cleanContact({ ...DEFAULT_SITE_SETTINGS.contact, ...(input.contact || {}) }),
    hero: cleanHero({ ...DEFAULT_SITE_SETTINGS.hero, ...(input.hero || {}) }),
    seo: cleanSeo({ ...DEFAULT_SITE_SETTINGS.seo, ...(input.seo || {}) }),
    maintenance: cleanMaintenance({ ...DEFAULT_SITE_SETTINGS.maintenance, ...(input.maintenance || {}) }),
    partners: cleanPartners(partnerSource),
    clientVideos: cleanClientVideos(input.clientVideos && input.clientVideos.length ? input.clientVideos : DEFAULT_SITE_SETTINGS.clientVideos),
    team: cleanTeam(input.team && input.team.length ? input.team : DEFAULT_SITE_SETTINGS.team)
  };
}

module.exports = { DEFAULT_SITE_SETTINGS, sanitizeSiteSettings };
