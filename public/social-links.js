(function (root) {
  'use strict';
  const platforms = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X', youtube: 'YouTube', threads: 'Threads' };
  function safeUrl(value) {
    if (typeof value !== 'string' || value.length > 2048 || !/^https:\/\//i.test(value.trim()) || /[\s\\]/.test(value.trim())) return '';
    try {
      const url = new URL(value.trim());
      return url.hostname.includes('.') && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  function clean(items) {
    return (Array.isArray(items) ? items : []).slice(0, 12).filter(item => item && Object.hasOwn(platforms, item.platform)).map(item => {
      const url = safeUrl(item.url);
      return { platform: item.platform, url, enabled: item.enabled === true && !!url };
    });
  }
  function render(items) {
    const active = clean(items).filter(item => item.enabled);
    document.querySelectorAll('[data-social-links]').forEach(container => {
      container.replaceChildren();
      container.hidden = !active.length;
      active.forEach(item => {
        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', platforms[item.platform] + ' (opens in a new tab)');
        link.title = platforms[item.platform];
        const img = document.createElement('img');
        img.src = '/assets/social/' + item.platform + '.svg';
        img.alt = '';
        img.width = img.height = 24;
        link.append(img);
        container.append(link);
      });
    });
  }
  const api = { platforms, safeUrl, clean, render };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.EarthsarSocial = api;
    if (document.querySelector('[data-social-links]')) {
      fetch('/api/settings', { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(response => { if (!response.ok) throw new Error('Settings unavailable'); return response.json(); })
        .then(data => render(data.settings && data.settings.social))
        .catch(() => render([]));
    }
  }
})(typeof window === 'undefined' ? globalThis : window);
