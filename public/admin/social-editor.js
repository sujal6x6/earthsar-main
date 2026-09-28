(function () {
  'use strict';
  const social = window.EarthsarSocial;
  window.mountSocialEditor = function (container, items) {
    function add(item = { platform: 'instagram', url: '', enabled: false }) {
      if (container.children.length >= 12) return;
      const row = document.createElement('div');
      row.className = 'social-editor-row';
      const preview = document.createElement('img');
      preview.width = preview.height = 28;
      preview.alt = '';
      const platformLabel = document.createElement('label');
      platformLabel.textContent = 'Platform / logo';
      const select = document.createElement('select');
      select.dataset.socialPlatform = '';
      Object.entries(social.platforms).forEach(([key, name]) => select.add(new Option(name, key)));
      select.value = item.platform;
      select.onchange = () => { preview.src = '/assets/social/' + select.value + '.svg'; };
      select.onchange();
      platformLabel.append(select);
      const urlLabel = document.createElement('label');
      urlLabel.textContent = 'Profile link';
      const input = document.createElement('input');
      input.type = 'url'; input.maxLength = 2048; input.placeholder = 'https://…'; input.value = item.url;
      input.dataset.socialUrl = '';
      urlLabel.append(input);
      const visibility = document.createElement('label');
      visibility.className = 'social-visibility';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.checked = item.enabled; checkbox.dataset.socialEnabled = '';
      visibility.append(checkbox, 'Show on website');
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'btn btn-secondary'; remove.textContent = 'Remove';
      remove.onclick = () => { row.remove(); update(); };
      row.append(preview, platformLabel, urlLabel, visibility, remove);
      container.append(row);
      update();
    }
    const button = document.getElementById('addSocial');
    function update() { button.disabled = container.children.length >= 12; }
    button.onclick = () => add();
    social.clean(items).forEach(add);
    update();
  };
  window.readSocialEditor = function (container) {
    return Array.from(container.children).map(row => {
      const platform = row.querySelector('[data-social-platform]').value;
      const input = row.querySelector('[data-social-url]');
      const url = input.value.trim();
      const enabled = row.querySelector('[data-social-enabled]').checked;
      if ((url && !social.safeUrl(url)) || (enabled && !url)) {
        input.focus();
        throw new Error('Enter a valid https:// profile link for ' + social.platforms[platform] + ' before showing it.');
      }
      return { platform, url, enabled };
    });
  };
})();
