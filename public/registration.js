(function (root) {
  'use strict';
  const defaults = {
    enabled: true,
    number: 'RC/HARERA/GGM/4875/4470/2026/910',
    verificationUrl: 'https://www.hareraggm.gov.in/app/Agent_signup/Registered_certificate',
    office: 'DLF Corporate Greens, Sector 74A, Gurugram'
  };
  function safeUrl(value) {
    if (typeof value !== 'string' || value.length > 2048 || !/^https:\/\//i.test(value.trim()) || /[\s\\]/.test(value.trim())) return '';
    try {
      const url = new URL(value.trim());
      return url.hostname.includes('.') && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  function clean(input) {
    const data = { ...defaults, ...(input && typeof input === 'object' && !Array.isArray(input) ? input : {}) };
    return {
      enabled: data.enabled === true,
      number: String(data.number == null ? '' : data.number).trim().slice(0, 120),
      verificationUrl: safeUrl(data.verificationUrl),
      office: String(data.office == null ? '' : data.office).trim().slice(0, 300)
    };
  }
  function render(input) {
    const data = clean(input);
    document.querySelectorAll('[data-company-registration]').forEach(block => {
      block.hidden = !data.enabled || !data.number;
      block.querySelector('[data-registration-number]').textContent = data.number;
      const office = block.querySelector('[data-registration-office]');
      office.textContent = data.office;
      office.closest('p').hidden = !data.office;
      const link = block.querySelector('[data-registration-link]');
      link.closest('p').hidden = !data.verificationUrl;
      if (data.verificationUrl) link.href = data.verificationUrl;
      else link.removeAttribute('href');
    });
  }
  const api = { defaults, clean, safeUrl, render };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.EarthsarRegistration = api;
    if (document.querySelector('[data-company-registration]')) {
      fetch('/api/settings', { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(response => { if (!response.ok) throw new Error('Settings unavailable'); return response.json(); })
        .then(data => render(data.settings && data.settings.registration))
        .catch(() => {});
    }
  }
})(typeof window === 'undefined' ? globalThis : window);
