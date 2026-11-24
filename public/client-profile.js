(() => {
  if (window.location.pathname === "/client-profile.html") {
    const cleanUrl = `/client-profile${window.location.search}${window.location.hash}`;
    window.history.replaceState(null, "", cleanUrl);
  }

  const form = document.querySelector("#clientProfileForm");
  if (!form) return;

  const offerDate = form.elements.offerDate;
  const today = new Date();
  offerDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const fileInput = form.elements.photo;
  const photoName = document.querySelector("#photoName");
  const status = document.querySelector("#formStatus");
  const submit = document.querySelector("#submitProfile");
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    photoName.textContent = file ? file.name : "No photo selected";
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    status.textContent = "";
    status.classList.remove("error");
    if (!form.reportValidity()) return;

    const photo = fileInput.files && fileInput.files[0];
    if (photo && !["image/jpeg", "image/png"].includes(photo.type)) {
      status.textContent = "Choose a JPG or PNG client photo.";
      status.classList.add("error");
      fileInput.focus();
      return;
    }
    if (photo && photo.size > 3 * 1024 * 1024) {
      status.textContent = "The client photo must be 3 MB or smaller.";
      status.classList.add("error");
      fileInput.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Creating profile…";
    status.textContent = "Preparing and emailing the PDF securely…";
    try {
      const response = await fetch("/api/client-profile", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The profile could not be sent. Please try again.");
      const ref = result.reference ? ` Reference: ${result.reference}.` : "";
      form.reset();
      offerDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      photoName.textContent = "No photo selected";
      status.textContent = `Your profile PDF has been emailed to the earthsar team.${ref}`;
      status.classList.remove("error");
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Create & email profile";
    }
  });
})();
