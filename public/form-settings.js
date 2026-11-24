/* Applies the admin-configured field visibility and dropdown choices to the private forms portal. */
(() => {
  const form = document.querySelector("#clientProfileForm, #rentPropertyForm, #salePropertyForm");
  if (!form) return;
  const formKey = form.id === "clientProfileForm" ? "clientProfile" : form.id === "rentPropertyForm" ? "rentProperty" : "saleProperty";
  const selectLabels = { propertyType: "Select property type", bhk: "Select BHK", preferredFlat: "Select a flat size" };
  const syncConditionalFields = () => form.querySelectorAll("[data-depends-on]").forEach(field => {
    const trigger = form.elements.namedItem(field.dataset.dependsOn);
    const input = field.querySelector("input,select,textarea");
    const matches = trigger?.value === field.dataset.dependsValue;
    const adminHidden = input?.dataset.adminDisabled === "true";
    field.hidden = !(matches && !adminHidden);
    if (input) {
      input.disabled = !matches || adminHidden;
      input.required = !input.disabled && input.dataset.wasRequired === "true";
    }
  });
  form.querySelectorAll("[data-depends-on]").forEach(field => {
    const input = field.querySelector("input,select,textarea");
    if (input) input.dataset.wasRequired = String(input.required);
  });
  form.addEventListener("change", syncConditionalFields);
  form.addEventListener("reset", () => setTimeout(syncConditionalFields, 0));
  syncConditionalFields();
  fetch("/api/settings", { headers: { Accept: "application/json" } })
    .then(response => response.ok ? response.json() : null)
    .then(payload => {
      const config = payload?.settings?.forms?.[formKey];
      if (!config) return;
      for (const [name, enabled] of Object.entries(config.fields || {})) {
        const control = form.elements.namedItem(name);
        const field = control?.closest(".field");
        if (!field || ["name", "email", "phone"].includes(name)) continue;
        field.hidden = enabled === false;
        control.dataset.adminDisabled = String(enabled === false);
        control.disabled = enabled === false;
        if (enabled === false) control.required = false;
      }
      for (const [name, choices] of Object.entries(config.options || {})) {
        const select = form.elements.namedItem(name);
        if (!select || !Array.isArray(choices)) continue;
        const current = select.value;
        select.replaceChildren(new Option(selectLabels[name] || "Choose an option", ""));
        choices.filter(choice => choice && choice.visible !== false && choice.value).forEach(choice => select.add(new Option(choice.value, choice.value)));
        if (Array.from(select.options).some(option => option.value === current)) select.value = current;
      }
      syncConditionalFields();
    })
    .catch(() => {});
})();
