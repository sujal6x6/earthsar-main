const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DEFAULT_SITE_SETTINGS, sanitizeSiteSettings } = require("../server/site-settings");

test("all original and additional logos are available in both default lists", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/config.js"), "utf8"), context);
  const partners = DEFAULT_SITE_SETTINGS.partners;
  assert.equal(partners.length, 33);
  assert.equal(new Set(partners.map(partner => partner.logo)).size, 33);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.earthsarConfig.partners)), partners);
  for (const partner of partners) {
    assert.ok(fs.existsSync(path.join(__dirname, "../public", partner.logo)), partner.logo);
  }
  assert.deepEqual(sanitizeSiteSettings({}).partners, partners);
});

test("legacy and replacement-only saved settings recover the complete logo list", () => {
  const partners = DEFAULT_SITE_SETTINGS.partners;
  assert.deepEqual(sanitizeSiteSettings({ partners: partners.slice(0, 16) }).partners, partners);
  const repaired = sanitizeSiteSettings({ partners: partners.slice(16) });
  assert.deepEqual(repaired.partners, partners);
  assert.deepEqual(sanitizeSiteSettings(repaired).partners, partners);
});

test("custom admin logos and edits remain intact", () => {
  const partners = [{ name: "Custom partner", logo: "/uploads/logos/custom.png", website: "" }];
  assert.deepEqual(sanitizeSiteSettings({ partners }).partners, partners);
  const edited = DEFAULT_SITE_SETTINGS.partners.slice(16).map(partner => ({ ...partner }));
  edited[0].website = "https://example.com/custom";
  assert.deepEqual(sanitizeSiteSettings({ partners: edited }).partners, edited);
});
