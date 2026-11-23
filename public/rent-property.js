(() => {
  const form = document.querySelector("#rentPropertyForm");
  if (!form) return;
  const status = document.querySelector("#rentStatus");
  const submit = document.querySelector("#submitRentProperty");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    status.textContent = "";
    status.classList.remove("error");
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const data = Object.fromEntries(fields.entries());
    data.area = String(data.area || "");
    data.rent = String(data.rent || "");
    data.consent = fields.get("consent") === "on";

    submit.disabled = true;
    submit.textContent = "Sending property details…";
    status.textContent = "Preparing and emailing the property PDF…";
    try {
      const response = await fetch("/api/rent-property", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The property details could not be sent. Please try again.");
      form.reset();
      status.textContent = `Your property details were emailed to the earthsar team.${result.reference ? ` Reference: ${result.reference}.` : ""}`;
      status.classList.remove("error");
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Submit property";
    }
  });
})();
