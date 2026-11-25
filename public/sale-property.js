(() => {
  const form = document.querySelector("#salePropertyForm");
  if (!form) return;
  const status = document.querySelector("#saleStatus");
  const submit = document.querySelector("#submitSaleProperty");

  const clearFieldError = name => {
    const control = form.elements.namedItem(name);
    const field = control?.closest(".field, .consent");
    if (!field) return;
    field.classList.remove("has-error");
    control.removeAttribute("aria-invalid");
    control.removeAttribute("aria-describedby");
    field.querySelector(".field-error-message")?.remove();
  };
  const clearFieldErrors = () => form.querySelectorAll(".field-error-message").forEach(error => {
    const field = error.closest(".field, .consent");
    field?.classList.remove("has-error");
    field?.querySelector('[aria-invalid="true"]')?.removeAttribute("aria-invalid");
    field?.querySelector("[aria-describedby]")?.removeAttribute("aria-describedby");
    error.remove();
  });
  const showFieldErrors = errors => {
    let firstInvalid;
    for (const [name, message] of Object.entries(errors || {})) {
      const control = form.elements.namedItem(name);
      const field = control?.closest(".field, .consent");
      if (!control || !field) continue;
      field.classList.add("has-error");
      control.setAttribute("aria-invalid", "true");
      const hint = document.createElement("small");
      hint.className = "field-error-message";
      hint.id = `${form.id}-${name}-error`;
      hint.textContent = message;
      field.append(hint);
      control.setAttribute("aria-describedby", hint.id);
      firstInvalid ||= { control, field };
    }
    return firstInvalid;
  };

  form.addEventListener("input", event => {
    if (event.target.name) clearFieldError(event.target.name);
    if (!form.querySelector(".field-error-message")) {
      status.textContent = "";
      status.classList.remove("error");
    }
  });
  form.addEventListener("change", event => {
    if (event.target.name) clearFieldError(event.target.name);
    if (!form.querySelector(".field-error-message")) {
      status.textContent = "";
      status.classList.remove("error");
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    clearFieldErrors();
    status.textContent = "";
    status.classList.remove("error");
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const data = Object.fromEntries(fields.entries());
    data.area = String(data.area || "");
    data.saleAmount = String(data.saleAmount || "");
    data.consent = fields.get("consent") === "on";

    submit.disabled = true;
    submit.textContent = "Sending property details…";
    status.textContent = "Preparing and emailing the property PDF…";
    try {
      const response = await fetch("/api/sale-property", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok && result.fields) {
        const firstInvalid = showFieldErrors(result.fields);
        status.textContent = firstInvalid ? "Please correct the highlighted fields below." : Object.values(result.fields).join(" ");
        status.classList.add("error");
        firstInvalid?.field.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid?.control.focus({ preventScroll: true });
        return;
      }
      if (!response.ok) throw new Error(result.error || "The property details could not be sent. Please try again.");
      form.reset();
      status.textContent = `Thank you for reaching out to earthsar. Our team has received your property details and will get in touch with you soon.${result.reference ? ` Your reference number is ${result.reference}.` : ""}`;
      status.classList.remove("error");
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Kindly submit your property details";
    }
  });
})();
