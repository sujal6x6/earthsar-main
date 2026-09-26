/* earthsar admin panel. Talks to /api/admin. No build step. */
(function () {
"use strict";
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = id => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const stars = n => `<span class="stars sm" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map(i => `<svg class="${i <= n ? "" : "off"}" aria-hidden="true"><use href="#i-star"/></svg>`).join("")}</span>`;
const fmt = t => t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const main = $("#main");
const state = { me: null, stats: null, reviews: [], gallery: [], enquiries: [], settings: null };

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 3000); }

/* ---------- API ---------- */
async function api(method, path, body, opts = {}) {
  const headers = { Accept: "application/json", "X-Requested-With": "earthsar-admin" };
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch("/api/admin" + path, { method, headers, credentials: "same-origin", body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  } catch { throw new Error("The server could not be reached. Check your connection."); }
  let data = {};
  try { data = await res.json(); } catch { }
  if (res.status === 401 && !opts.noRedirect) { showLogin(); throw new Error(data.error || "Sign in to continue."); }
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}
/* Upload with progress (fetch cannot report upload progress). */
function upload(path, fd, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); x.open("POST", "/api/admin" + path);
    x.setRequestHeader("Accept", "application/json"); x.setRequestHeader("X-Requested-With", "earthsar-admin");
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch { }
      if (x.status === 401) showLogin();
      x.status >= 200 && x.status < 300 ? resolve(d) : reject(new Error(d.error || "The upload failed. Try again.")); };
    x.onerror = () => reject(new Error("The server could not be reached. Check your connection."));
    x.send(fd);
  });
}

/* ---------- dialogs ---------- */
const dlg = $("#dlg");
function confirmDialog({ title, text, ok = "Confirm", danger = false }) {
  return new Promise(resolve => {
    dlg.className = "dlg";
    dlg.innerHTML = `<div class="db"><h3>${esc(title)}</h3><p>${esc(text)}</p></div><div class="df"><button class="btn btn-plain btn-sm" data-r="0">Cancel</button><button class="btn ${danger ? "btn-danger" : "btn-primary"} btn-sm" data-r="1">${esc(ok)}</button></div>`;
    const done = v => { dlg.close(); resolve(v); };
    $$("[data-r]", dlg).forEach(b => b.onclick = () => done(b.dataset.r === "1"));
    dlg.oncancel = e => { e.preventDefault(); done(false); };
    dlg.showModal(); $("[data-r='0']", dlg).focus();
  });
}
function viewMedia(items, start) {
  let i = start || 0;
  dlg.className = "dlg media";
  const draw = () => {
    const m = items[i];
    const body = m.type === "video" && m.embed ? `<iframe src="${esc(m.embed)}" allow="autoplay; fullscreen" allowfullscreen title="Video"></iframe>`
      : m.type === "video" ? `<video src="${esc(m.url)}" controls autoplay playsinline></video>` : `<img src="${esc(m.full || m.url)}" alt="">`;
    dlg.innerHTML = `<button class="x" aria-label="Close">${icon("i-x")}</button>${items.length > 1 ? `<button class="icon-btn" data-d="-1" style="position:absolute;left:10px;top:50%;z-index:2" aria-label="Previous">${icon("i-left")}</button><button class="icon-btn" data-d="1" style="position:absolute;right:10px;top:50%;z-index:2" aria-label="Next">${icon("i-right")}</button>` : ""}<div class="stage">${body}</div>`;
    $(".x", dlg).onclick = () => dlg.close();
    $$("[data-d]", dlg).forEach(b => b.onclick = () => { i = (i + +b.dataset.d + items.length) % items.length; draw(); });
  };
  dlg.oncancel = null;
  dlg.onclose = () => { dlg.innerHTML = ""; dlg.onclose = null; };
  draw(); dlg.showModal();
}

/* ---------- sign in ---------- */
function showLogin() {
  $("#app").hidden = true; $("#login").hidden = false; dlg.open && dlg.close();
  setTimeout(() => $("#l-email").focus(), 30);
}
$("#loginForm").onsubmit = async e => {
  e.preventDefault(); $("#loginErr").textContent = "";
  const btn = $("#loginBtn"); btn.disabled = true;
  try {
    await api("POST", "/login", { email: $("#l-email").value, password: $("#l-pass").value }, { noRedirect: true });
    $("#l-pass").value = "";
    await boot();
  } catch (err) { $("#loginErr").textContent = err.message; }
  btn.disabled = false;
};

async function boot() {
  try { state.me = await api("GET", "/me", null, { noRedirect: true }); }
  catch { showLogin(); return; }
  $("#login").hidden = true; $("#app").hidden = false;
  $("#whoami").textContent = state.me.admin.email;
  refreshStats();
  route();
}

async function refreshStats() {
  try {
    state.stats = await api("GET", "/stats");
    const s = state.stats;
    $("#cPending").hidden = !s.pending; $("#cPending").textContent = s.pending;
    $("#cEnq").hidden = !s.enquiries_new; $("#cEnq").textContent = s.enquiries_new;
    const seg = $(".seg[data-reviews]"); if (seg) for (const k of ["pending", "approved", "rejected"]) { const n = $(`[data-s="${k}"] .n`, seg); if (n) n.textContent = s[k]; }
  } catch { }
}

/* ---------- routing ---------- */
function route() {
  if ($("#app").hidden) return;
  const [page, sub] = location.hash.replace(/^#\/?/, "").split("/");
  const nav = page === "leads" || page === "enquiries" ? "leads" : page || "dashboard";
  $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === nav));
  if (dlg.open) dlg.close();
  if (!page || page === "dashboard") return pageDashboard();
  if (page === "leads" || page === "enquiries") return pageLeads();
  if (page === "gallery") return pageGallery();
  if (page === "settings" || page === "account") return pageSettings();
  return pageReviews(["pending", "approved", "rejected"].includes(sub) ? sub : "pending");
}
addEventListener("hashchange", route);

/* ================= DASHBOARD ================= */
function pageDashboard() {
  const s = state.stats || {};
  main.innerHTML = `<div class="ph"><div><h1>Dashboard</h1><p>Your daily snapshot for leads, reviews and website media.</p></div><a class="btn btn-secondary" href="/" target="_blank" rel="noopener">View website</a></div>
    <div class="dash-grid">
      <a class="panel dash-card" href="#/leads"><span>New leads</span><b>${s.enquiries_new ?? 0}</b><small>Contact form messages needing attention</small></a>
      <a class="panel dash-card" href="#/reviews/pending"><span>Pending reviews</span><b>${s.pending ?? 0}</b><small>Approve or reject before publishing</small></a>
      <a class="panel dash-card" href="#/reviews/approved"><span>Published reviews</span><b>${s.approved ?? 0}</b><small>Live client feedback on the website</small></a>
      <a class="panel dash-card" href="#/gallery"><span>Website media</span><b>${s.gallery_published ?? 0}</b><small>Photos and videos published by earthsar</small></a>
    </div>
    <section class="panel dash-actions">
      <h2>Quick actions</h2>
      <div>
        <a class="btn btn-primary" href="#/leads">Open leads</a>
        <a class="btn btn-secondary" href="#/reviews/pending">Moderate reviews</a>
        <a class="btn btn-secondary" href="#/gallery">Manage website media</a>
        <a class="btn btn-secondary" href="#/settings">Website settings</a>
      </div>
    </section>`;
}

/* ================= REVIEWS ================= */
async function pageReviews(status) {
  const s = state.stats || {};
  const intro = { pending: "New reviews wait here until you approve or reject them. Nothing here is visible on the website.", approved: "These reviews are live on the website.", rejected: "Rejected reviews are hidden from the website. You can approve them later or delete them." }[status];
  main.innerHTML = `<div class="ph"><div><h1>Reviews</h1><p>${intro}</p></div></div>
    <div class="seg" data-reviews>${[["pending", "Waiting"], ["approved", "Published"], ["rejected", "Rejected"]].map(([k, l]) => `<a href="#/reviews/${k}" data-s="${k}" class="${k === status ? "on" : ""}">${l}<span class="n">${s[k] ?? ""}</span></a>`).join("")}</div>
    <div class="rlist" id="rlist"><div class="loading">Loading reviews…</div></div>`;
  try {
    const d = await api("GET", "/reviews?status=" + status);
    state.reviews = d.reviews; state.reviewStatus = status;
    drawReviews();
  } catch (err) { $("#rlist").innerHTML = `<div class="panel empty-state"><b>Reviews could not be loaded</b>${esc(err.message)}</div>`; }
}

function reviewMediaList(r) {
  const list = [];
  if (r.avatar) list.push({ ...r.avatar, label: "Profile" });
  r.media.forEach(m => list.push({ ...m, label: m.type === "video" ? "Video" : "Photo" }));
  if (r.videoLink) list.push({ type: "video", url: r.videoLink.url, embed: r.videoLink.embed, thumb: r.videoLink.thumb, label: r.videoLink.kind === "vimeo" ? "Vimeo" : "YouTube" });
  return list;
}

function drawReviews() {
  const box = $("#rlist"), st = state.reviewStatus;
  if (!state.reviews.length) {
    box.innerHTML = `<div class="panel empty-state"><b>${{ pending: "No reviews waiting", approved: "No published reviews yet", rejected: "No rejected reviews" }[st]}</b>${st === "pending" ? "New reviews from the website will show up here." : st === "approved" ? "Approve a review from the Waiting tab to publish it." : ""}</div>`;
    return;
  }
  box.innerHTML = state.reviews.map(r => {
    const media = reviewMediaList(r);
    const actions = st === "pending"
      ? `<button class="btn btn-primary btn-sm" data-act="approve">Approve &amp; publish</button><button class="btn btn-plain btn-sm" data-act="reject">Reject</button>`
      : st === "approved"
        ? `<button class="btn btn-plain btn-sm" data-act="unpublish">Unpublish</button>`
        : `<button class="btn btn-primary btn-sm" data-act="approve">Approve &amp; publish</button><button class="btn btn-plain btn-sm" data-act="pending">Move to waiting</button>`;
    return `<article class="panel rcard" data-id="${r.id}">
      <div class="body">
        <div class="rhead"><span class="who">${esc(r.name)}</span>${stars(r.rating)}${r.verified ? `<span class="pill ok">Verified client</span>` : ""}<span class="when">${esc(fmt(r.createdAt))}</span></div>
        <div class="contact"><a href="mailto:${esc(r.email)}">${esc(r.email)}</a>${r.phone ? `<a href="tel:${esc(r.phone.replace(/\s+/g, ""))}">${esc(r.phone)}</a>` : ""}</div>
        <p class="rmsg">${esc(r.message)}</p>
        ${media.length ? `<div class="mrow">${media.map((m, j) => `<div class="mitem"><button class="open" data-view="${j}" aria-label="Open ${esc(m.label)}">${m.thumb ? `<img src="${esc(m.thumb)}" alt="" loading="lazy">` : ""}</button>${m.type === "video" ? `<span class="pl">${icon("i-play")}</span>` : ""}<span class="tag">${esc(m.label)}</span><button class="rm" data-rm="${esc(m.url)}" aria-label="Remove this ${esc(m.label.toLowerCase())}" title="Remove from review">${icon("i-x")}</button></div>`).join("")}</div>` : ""}
      </div>
      <div class="acts">
        ${actions}
        <label class="check"><input type="checkbox" data-act="verified" ${r.verified ? "checked" : ""}><span>Show “Verified client” badge</span></label>
        <div class="note-fld"><label for="note-${r.id}">Private note</label><textarea id="note-${r.id}" data-note placeholder="Only admins see this">${esc(r.adminNote)}</textarea></div>
        <button class="link-btn" data-act="delete">Delete permanently</button>
      </div>
    </article>`;
  }).join("");
}

main.addEventListener("click", async e => {
  const card = e.target.closest(".rcard"); if (!card) return;
  const id = +card.dataset.id, r = state.reviews.find(x => x.id === id); if (!r) return;
  const view = e.target.closest("[data-view]");
  if (view) return viewMedia(reviewMediaList(r), +view.dataset.view);
  const rm = e.target.closest("[data-rm]");
  if (rm) {
    const ok = await confirmDialog({ title: "Remove this file?", text: "It will be removed from the review and deleted from hosting storage. The rest of the review stays.", ok: "Remove", danger: true });
    if (!ok) return;
    try { const d = await api("POST", `/reviews/${id}/remove-media`, { url: rm.dataset.rm }); Object.assign(r, d.review); drawReviews(); toast("File removed."); }
    catch (err) { toast(err.message); }
    return;
  }
  const act = e.target.closest("button[data-act]"); if (!act) return;
  const a = act.dataset.act;
  if (a === "delete") {
    const ok = await confirmDialog({ title: `Delete the review from ${r.name}?`, text: "The review and its photos and videos will be deleted for good, including from hosting storage.", ok: "Delete", danger: true });
    if (!ok) return;
    try { await api("DELETE", `/reviews/${id}`); removeReview(id); toast("Review deleted."); } catch (err) { toast(err.message); }
    return;
  }
  const next = { approve: "approved", reject: "rejected", unpublish: "pending", pending: "pending" }[a];
  if (!next) return;
  act.disabled = true;
  try {
    await api("PATCH", `/reviews/${id}`, { status: next });
    removeReview(id);
    toast({ approved: "Review published.", rejected: "Review rejected.", pending: a === "unpublish" ? "Review unpublished. It is back in Waiting." : "Review moved to Waiting." }[next]);
  } catch (err) { act.disabled = false; toast(err.message); }
});
main.addEventListener("change", async e => {
  const cb = e.target.closest("input[data-act='verified']"); if (!cb) return;
  const id = +cb.closest(".rcard").dataset.id;
  try { const d = await api("PATCH", `/reviews/${id}`, { verified: cb.checked }); const r = state.reviews.find(x => x.id === id); Object.assign(r, d.review); drawReviews(); toast(cb.checked ? "Badge added." : "Badge removed."); }
  catch (err) { cb.checked = !cb.checked; toast(err.message); }
});
main.addEventListener("focusout", async e => {
  const t = e.target.closest("textarea[data-note]"); if (!t) return;
  const id = +t.closest(".rcard").dataset.id, r = state.reviews.find(x => x.id === id);
  if (!r || t.value.trim() === r.adminNote) return;
  try { await api("PATCH", `/reviews/${id}`, { adminNote: t.value }); r.adminNote = t.value.trim(); toast("Note saved."); } catch (err) { toast(err.message); }
});
function removeReview(id) { state.reviews = state.reviews.filter(x => x.id !== id); drawReviews(); refreshStats(); }

/* ================= GALLERY ================= */
async function pageGallery() {
  main.innerHTML = `<div class="ph"><div><h1>Website Media</h1><p>Photos and videos published by earthsar in the website media section, in this order. Use the arrows to move items.</p></div></div>
    <section class="panel add-card" aria-labelledby="addH">
      <h2 id="addH">Add a photo or video</h2>
      <div class="seg" role="tablist"><button type="button" class="on" data-mode="link">Paste a link</button><button type="button" data-mode="upload">Upload a file</button></div>
      <form id="addForm" novalidate>
        <div class="add-grid">
          <div class="form-grid">
            <div class="fld full" data-for="link"><label for="g-url">Media link</label><input id="g-url" type="url" placeholder="https://example.com/photo.jpg"><div class="hint">Paste a direct HTTPS image/video URL. YouTube and Vimeo links work for videos too.</div></div>
            <div class="fld full" data-for="upload" hidden>
              <label>File</label><label class="drop"><input type="file" id="g-file" accept="image/*,video/mp4,video/webm,video/quicktime"><span class="dic" style="color:var(--heading)">${icon("i-gal")}</span><span><b id="g-file-l">Choose a photo or video</b><span>Up to ${state.me.limits.adminUploadMb} MB. It is saved on your hosting storage.</span></span></label>
            </div>
            <div class="fld" data-for="link"><label for="g-type">Type</label><select id="g-type"><option value="">Detect from link</option><option value="image">Photo</option><option value="video">Video</option></select></div>
            <div class="fld"><label for="g-title">Title <span class="opt">(optional)</span></label><input id="g-title" maxlength="120" placeholder="e.g. Handover at Emaar Palm Heights"></div>
            <div class="fld full"><label for="g-cap">Caption <span class="opt">(optional)</span></label><input id="g-cap" maxlength="500" placeholder="Shown when the photo or video is opened"></div>
            <div class="full"><label class="check"><input type="checkbox" id="g-pub" checked><span>Show on the website straight away</span></label></div>
          </div>
          <div class="preview" id="gPrev">Preview</div>
        </div>
        <div class="progress" id="gProg"><i></i></div>
        <div class="form-foot"><span class="note-err" id="gErr" role="alert"></span><button class="btn btn-primary" id="gBtn" type="submit">Add to website media</button></div>
      </form>
    </section>
    <div id="glist"><div class="loading">Loading gallery…</div></div>`;

  let mode = "link";
  $$("[data-mode]").forEach(b => b.onclick = () => {
    mode = b.dataset.mode;
    $$("[data-mode]").forEach(x => x.classList.toggle("on", x === b));
    $$("[data-for]").forEach(f => f.hidden = f.dataset.for !== mode);
    $("#gErr").textContent = ""; preview();
  });
  let objUrl = "";
  const preview = () => {
    const box = $("#gPrev"); if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = ""; }
    if (mode === "upload") {
      const f = $("#g-file").files[0];
      if (!f) { box.innerHTML = "Preview"; return; }
      objUrl = URL.createObjectURL(f);
      box.innerHTML = f.type.startsWith("video/") ? `<video src="${objUrl}" muted playsinline></video>` : `<img src="${objUrl}" alt="">`;
      return;
    }
    const u = $("#g-url").value.trim();
    if (!/^https:\/\//.test(u)) { box.innerHTML = "Preview"; return; }
    const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/);
    const isVid = $("#g-type").value === "video" || /\/video\/upload\//.test(u) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || /vimeo\.com/.test(u) || yt;
    if (yt) box.innerHTML = `<img src="https://i.ytimg.com/vi/${esc(yt[1])}/hqdefault.jpg" alt="">`;
    else if (/vimeo\.com/.test(u)) box.innerHTML = "Vimeo video";
    else box.innerHTML = isVid ? `<video src="${esc(u)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(u)}" alt="">`;
    const el = $("img,video", box); if (el) el.onerror = () => { if (box.contains(el)) box.innerHTML = "This link could not be previewed. Check that it opens in your browser."; };
  };
  $("#g-url").addEventListener("input", preview); $("#g-type").onchange = preview;
  $("#g-file").onchange = () => { const f = $("#g-file").files[0]; $("#g-file-l").textContent = f ? f.name : "Choose a photo or video"; preview(); };

  $("#addForm").onsubmit = async e => {
    e.preventDefault(); $("#gErr").textContent = "";
    const title = $("#g-title").value.trim(), caption = $("#g-cap").value.trim(), published = $("#g-pub").checked;
    const btn = $("#gBtn"); btn.disabled = true;
    try {
      let item;
      if (mode === "link") {
        const url = $("#g-url").value.trim();
        if (!/^https:\/\//.test(url)) throw new Error("Paste a full link that starts with https://");
        item = (await api("POST", "/gallery", { url, type: $("#g-type").value || undefined, title, caption, published })).item;
      } else {
        const f = $("#g-file").files[0];
        if (!f) throw new Error("Choose a photo or video to upload.");
        if (f.size > state.me.limits.adminUploadMb * 1024 * 1024) throw new Error(`That file is larger than ${state.me.limits.adminUploadMb} MB.`);
        const fd = new FormData(); fd.append("title", title); fd.append("caption", caption); fd.append("published", published); fd.append("file", f);
        const prog = $("#gProg"), bar = $("i", prog); prog.classList.add("show"); bar.style.width = "2%"; btn.textContent = "Uploading…";
        try { item = (await upload("/gallery/upload", fd, p => { bar.style.width = Math.round(p * 90) + "%"; if (p >= 1) btn.textContent = "Saving file…"; })).item; }
        finally { prog.classList.remove("show"); btn.textContent = "Add to gallery"; }
      }
      state.gallery.unshift(item); drawGallery(); refreshStats();
      $("#addForm").reset(); $("#g-file-l").textContent = "Choose a photo or video"; preview();
      toast(item.published ? "Added to the gallery." : "Added. It is hidden until you show it.");
    } catch (err) { $("#gErr").textContent = err.message; }
    btn.disabled = false;
  };

  try { state.gallery = (await api("GET", "/gallery")).items; drawGallery(); }
  catch (err) { $("#glist").innerHTML = `<div class="panel empty-state"><b>The gallery could not be loaded</b>${esc(err.message)}</div>`; }
}

function drawGallery(editId) {
  const box = $("#glist"); if (!box) return;
  const G = state.gallery;
  if (!G.length) { box.innerHTML = `<div class="panel empty-state"><b>The gallery is empty</b>Add a photo or video above. The Gallery section stays hidden on the website until it has at least one item.</div>`; return; }
  box.innerHTML = `<div class="ggrid">${G.map((g, i) => `<article class="panel gitem" data-gid="${g.id}">
    <div class="th"><button data-gview="${i}" aria-label="Open ${esc(g.title || "item")}">${g.thumb ? `<img src="${esc(g.thumb)}" alt="" loading="lazy">` : ""}</button>${g.type === "video" ? `<span class="mitem" style="all:unset"><span class="pl" style="position:absolute;inset:0;display:grid;place-items:center;pointer-events:none"><svg style="width:34px;height:34px;color:#fff;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))"><use href="#i-play"/></svg></span></span>` : ""}<span class="pill ${g.published ? "ok" : "off"}">${g.published ? "On website" : "Hidden"}</span></div>
    <div class="gb">${editId === g.id
      ? `<div class="edit"><input data-e="title" maxlength="120" value="${esc(g.title)}" placeholder="Title" aria-label="Title"><textarea data-e="caption" maxlength="500" placeholder="Caption" aria-label="Caption">${esc(g.caption)}</textarea><div style="display:flex;gap:6px"><button class="btn btn-primary btn-sm" data-g="save">Save</button><button class="btn btn-plain btn-sm" data-g="cancel">Cancel</button></div></div>`
      : `<b>${esc(g.title || (g.type === "video" ? "Untitled video" : "Untitled photo"))}</b>${g.caption ? `<span class="cap">${esc(g.caption)}</span>` : ""}<span class="src">${g.uploadedHere ? "Uploaded here" : "Linked"} · ${g.type === "video" ? "Video" : "Photo"}</span>`}</div>
    <div class="gf">
      <button class="icon-btn" data-g="up" aria-label="Move earlier" ${i === 0 ? "disabled" : ""}>${icon("i-up")}</button>
      <button class="icon-btn" data-g="down" aria-label="Move later" ${i === G.length - 1 ? "disabled" : ""}>${icon("i-down")}</button>
      <span class="sp"></span>
      <button class="btn btn-plain btn-sm" data-g="edit">Edit</button>
      <button class="btn btn-plain btn-sm" data-g="toggle">${g.published ? "Hide" : "Show"}</button>
      <button class="btn btn-plain btn-sm" data-g="delete" style="color:#C8321E">Delete</button>
    </div></article>`).join("")}</div>`;
}

main.addEventListener("click", async e => {
  const v = e.target.closest("[data-gview]");
  if (v) return viewMedia(state.gallery, +v.dataset.gview);
  const b = e.target.closest("[data-g]"); if (!b) return;
  const card = b.closest("[data-gid]"), id = +card.dataset.gid, idx = state.gallery.findIndex(g => g.id === id), g = state.gallery[idx];
  const a = b.dataset.g;
  try {
    if (a === "edit") return drawGallery(id);
    if (a === "cancel") return drawGallery();
    if (a === "save") {
      const d = await api("PATCH", `/gallery/${id}`, { title: $("[data-e=title]", card).value, caption: $("[data-e=caption]", card).value });
      state.gallery[idx] = d.item; drawGallery(); toast("Saved."); return;
    }
    if (a === "toggle") {
      const d = await api("PATCH", `/gallery/${id}`, { published: !g.published });
      state.gallery[idx] = d.item; drawGallery(); toast(d.item.published ? "Shown on the website." : "Hidden from the website."); return;
    }
    if (a === "up" || a === "down") {
      const j = a === "up" ? idx - 1 : idx + 1; if (j < 0 || j >= state.gallery.length) return;
      [state.gallery[idx], state.gallery[j]] = [state.gallery[j], state.gallery[idx]]; drawGallery();
      await api("POST", "/gallery/reorder", { ids: state.gallery.map(x => x.id) }); return;
    }
    if (a === "delete") {
      const ok = await confirmDialog({ title: "Delete this item?", text: g.uploadedHere ? "It will be removed from the website and deleted from hosting storage." : "It will be removed from the website. Linked files stay where they are hosted.", ok: "Delete", danger: true });
      if (!ok) return;
      await api("DELETE", `/gallery/${id}`); state.gallery.splice(idx, 1); drawGallery(); toast("Deleted.");
    }
  } catch (err) { toast(err.message); }
});

/* ================= LEADS ================= */
function waLink(q) {
  const digits = String(q.phone || "").replace(/\D/g, "");
  const text = encodeURIComponent(`Hello ${q.name || ""}, thank you for contacting earthsar. I would like to understand your property requirement.`);
  return digits ? `https://wa.me/${digits}?text=${text}` : "";
}
async function pageLeads() {
  main.innerHTML = `<div class="ph"><div><h1>Leads</h1><p>Contact form submissions with status, follow-up notes and quick actions.</p></div></div><div id="elist" class="elist"><div class="loading">Loading leads…</div></div>`;
  try { state.enquiries = (await api("GET", "/enquiries")).enquiries; drawEnquiries(); }
  catch (err) { $("#elist").innerHTML = `<div class="panel empty-state"><b>Leads could not be loaded</b>${esc(err.message)}</div>`; }
}
function drawEnquiries() {
  const box = $("#elist"); if (!box) return;
  if (!state.enquiries.length) { box.innerHTML = `<div class="panel empty-state"><b>No leads yet</b>Messages from the website's contact form will show up here.</div>`; return; }
  box.innerHTML = state.enquiries.map(q => `<article class="panel ecard${q.handled ? " done" : ""}" data-qid="${q.id}">
    <div>
      <div class="who">${esc(q.name)}</div>
      <div class="contact"><a href="tel:${esc(q.phone.replace(/\s+/g, ""))}">${esc(q.phone)}</a>${q.email ? `<a href="mailto:${esc(q.email)}">${esc(q.email)}</a>` : ""}${q.topic ? `<span>${esc(q.topic)}</span>` : ""}</div>
      <div class="meta">${esc(fmt(q.createdAt))}</div>
    </div>
    <div class="ea">
      <a class="btn btn-secondary btn-sm" href="tel:${esc(q.phone.replace(/\s+/g, ""))}">Call</a>
      ${waLink(q) ? `<a class="btn btn-secondary btn-sm" href="${esc(waLink(q))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      ${q.email ? `<a class="btn btn-secondary btn-sm" href="mailto:${esc(q.email)}">Email</a>` : ""}
      <button class="btn btn-plain btn-sm" data-q="delete" style="color:#C8321E">Delete</button>
    </div>
    ${q.message ? `<p class="msg">${esc(q.message)}</p>` : ""}
    <div class="lead-tools">
      <label>Status <select data-lead="status"><option value="new">New</option><option value="contacted">Contacted</option><option value="site_visit">Site visit planned</option><option value="converted">Converted</option><option value="not_interested">Not interested</option></select></label>
      <label>Follow-up <input type="date" data-lead="followUp" value="${esc(q.followUp || "")}"></label>
      <label class="lead-note">Private note <textarea data-lead="note" placeholder="Budget, location, next step...">${esc(q.note || "")}</textarea></label>
      <button class="btn ${q.handled ? "btn-plain" : "btn-primary"} btn-sm" data-q="toggle">${q.handled ? "Mark as open" : "Mark as handled"}</button>
    </div>
  </article>`).join("");
  state.enquiries.forEach(q => {
    const card = $(`[data-qid="${q.id}"]`, box);
    const st = $('[data-lead="status"]', card);
    if (st) st.value = q.status || (q.handled ? "contacted" : "new");
  });
}
main.addEventListener("click", async e => {
  const b = e.target.closest("[data-q]"); if (!b) return;
  const id = +b.closest("[data-qid]").dataset.qid, q = state.enquiries.find(x => x.id === id);
  try {
    if (b.dataset.q === "toggle") {
      await api("PATCH", `/enquiries/${id}`, { handled: !q.handled }); q.handled = !q.handled;
      state.enquiries.sort((a, b) => a.handled - b.handled || new Date(b.createdAt) - new Date(a.createdAt));
      drawEnquiries(); refreshStats(); toast(q.handled ? "Marked as handled." : "Marked as open.");
    } else {
      const ok = await confirmDialog({ title: `Delete the enquiry from ${q.name}?`, text: "This cannot be undone.", ok: "Delete", danger: true });
      if (!ok) return;
      await api("DELETE", `/enquiries/${id}`); state.enquiries = state.enquiries.filter(x => x.id !== id); drawEnquiries(); refreshStats(); toast("Enquiry deleted.");
    }
  } catch (err) { toast(err.message); }
});
main.addEventListener("change", async e => {
  const field = e.target.closest("[data-lead]"); if (!field) return;
  const card = field.closest("[data-qid]"); if (!card) return;
  const id = +card.dataset.qid, q = state.enquiries.find(x => x.id === id); if (!q) return;
  const patch = {};
  if (field.dataset.lead === "status") patch.status = field.value;
  if (field.dataset.lead === "followUp") patch.followUp = field.value;
  try { await api("PATCH", `/enquiries/${id}`, patch); Object.assign(q, patch); toast("Lead updated."); }
  catch (err) { toast(err.message); }
});
main.addEventListener("focusout", async e => {
  const field = e.target.closest('[data-lead="note"]'); if (!field) return;
  const card = field.closest("[data-qid]"); if (!card) return;
  const id = +card.dataset.qid, q = state.enquiries.find(x => x.id === id); if (!q || field.value.trim() === (q.note || "")) return;
  try { await api("PATCH", `/enquiries/${id}`, { note: field.value }); q.note = field.value.trim(); toast("Lead note saved."); }
  catch (err) { toast(err.message); }
});

/* ================= SETTINGS ================= */
async function pageSettings() {
  main.innerHTML = `<div class="ph"><div><h1>Website Settings</h1><p>Edit contact details, homepage content, advisor cards and SEO metadata.</p></div><a class="btn btn-secondary" href="/" target="_blank" rel="noopener">View website</a></div>
    <div id="settingsBox"><div class="loading">Loading website settings...</div></div>
    <form class="panel acc-card" id="profileForm" novalidate>
      <h2>Admin username</h2>
      <p style="color:var(--muted)">Change the login username/email used for this admin panel.</p>
      <div class="fld"><label for="u-name">Display name</label><input id="u-name" autocomplete="name" maxlength="160" value="${esc(state.me.admin.name || "")}"></div>
      <div class="fld"><label for="u-email">Login username / email</label><input id="u-email" type="email" autocomplete="username" maxlength="255" value="${esc(state.me.admin.email || "")}" required></div>
      <div class="fld"><label for="u-current">Current password</label><input id="u-current" type="password" autocomplete="current-password" required><div class="hint">Required before changing the admin username.</div></div>
      <div class="form-foot" style="margin-top:0"><span class="note-err" id="uErr" role="alert"></span><button class="btn btn-primary" type="submit">Save admin username</button></div>
    </form>
    <form class="panel acc-card" id="pwForm" novalidate>
      <h2>Change password</h2>
      <div class="fld"><label for="p-cur">Current password</label><input id="p-cur" type="password" autocomplete="current-password"></div>
      <div class="fld"><label for="p-new">New password</label><input id="p-new" type="password" autocomplete="new-password" minlength="10"><div class="hint">At least 10 characters. Other devices will be signed out.</div></div>
      <div class="form-foot" style="margin-top:0"><span class="note-err" id="pErr" role="alert"></span><button class="btn btn-primary" type="submit">Change password</button></div>
    </form>
    <div class="panel acc-card" style="margin-top:16px"><h2>Sign out</h2><p style="color:var(--muted)">Sign out of the admin panel on this device.</p><div><button class="btn btn-plain" id="logout">Sign out</button></div></div>`;
  try {
    state.settings = (await api("GET", "/settings")).settings;
    drawSettingsForm();
  } catch (err) {
    $("#settingsBox").innerHTML = `<div class="panel empty-state"><b>Settings could not be loaded</b>${esc(err.message)}</div>`;
  }
  $("#profileForm").onsubmit = async e => {
    e.preventDefault(); $("#uErr").textContent = "";
    try {
      const d = await api("PATCH", "/profile", { name: $("#u-name").value, email: $("#u-email").value, current: $("#u-current").value });
      state.me.admin = d.admin;
      $("#whoami").textContent = d.admin.email;
      $("#u-current").value = "";
      toast("Admin username saved.");
    } catch (err) { $("#uErr").textContent = err.message; }
  };
  $("#pwForm").onsubmit = async e => {
    e.preventDefault(); $("#pErr").textContent = "";
    try { await api("POST", "/password", { current: $("#p-cur").value, next: $("#p-new").value }); $("#pwForm").reset(); toast("Password changed."); }
    catch (err) { $("#pErr").textContent = err.message; }
  };
  $("#logout").onclick = async () => { try { await api("POST", "/logout"); } catch { } state.me = null; showLogin(); };
}

function settingsField(label, name, value, opts = {}) {
  const hint = opts.hint ? `<div class="hint">${esc(opts.hint)}</div>` : "";
  const cls = opts.full ? "fld full" : "fld";
  const inputName = name.replace(/[^\w-]/g, "_");
  const field = opts.area
    ? `<textarea name="${esc(inputName)}" data-key="${esc(name)}" rows="${opts.rows || 3}" maxlength="${opts.max || 300}" autocomplete="off">${esc(value || "")}</textarea>`
    : `<input name="${esc(inputName)}" data-key="${esc(name)}" type="${opts.type || "text"}" maxlength="${opts.max || 300}" value="${esc(value || "")}" autocomplete="off" data-lpignore="true">`;
  return `<div class="${cls}"><label>${esc(label)}</label>${field}${hint}</div>`;
}

function advisorEditor(member, i) {
  const title = `Advisor ${i + 1}`;
  return `<section class="settings-advisor">
    <h3>${title}</h3>
    <div class="form-grid">
      ${settingsField("Name", `team.${i}.name`, member.name, { max: 120 })}
      ${settingsField("Role", `team.${i}.role`, member.role, { max: 120 })}
      ${settingsField("Experience / headline", `team.${i}.experience`, member.experience, { full: true, max: 160 })}
      ${settingsField("Photo path", `team.${i}.photo`, member.photo, { full: true, max: 300, hint: "Use an existing file path such as assets/naveen-sharma.jpg." })}
      ${settingsField("Full bio", `team.${i}.bio`, member.bio, { full: true, area: true, rows: 8, max: 3000 })}
    </div>
  </section>`;
}

function drawSettingsForm() {
  const s = state.settings || {}, c = s.contact || {}, st = s.stats || {}, h = s.hero || {}, seo = s.seo || {}, team = s.team || [];
  const phone = c.phone || c.whatsapp || "+91 79820 08930";
  const whatsapp = c.whatsapp || c.phone || "+91 79820 08930";
  const email = c.email || "info@earthsar.in";
  $("#settingsBox").innerHTML = `<form class="panel settings-form" id="settingsForm" data-settings-version="edit-v2" novalidate>
    <section>
      <h2>Contact Details</h2>
      <div class="form-grid">
        ${settingsField("Phone", "contact.phone", phone, { max: 40 })}
        ${settingsField("WhatsApp", "contact.whatsapp", whatsapp, { max: 40 })}
        ${settingsField("Email", "contact.email", email, { max: 255 })}
        ${settingsField("Office hours", "contact.hours", c.hours, { max: 120 })}
        ${settingsField("Office address", "contact.address", c.address, { full: true, area: true, rows: 2, max: 300 })}
      </div>
    </section>
    <section>
      <h2>Homepage Hero</h2>
      <div class="form-grid">
        ${settingsField("Small heading", "hero.eyebrow", h.eyebrow, { max: 80 })}
        ${settingsField("Trust words", "hero.trust", (h.trust || []).join(" | "), { max: 160, hint: "Separate with |, comma or a new line." })}
        ${settingsField("Main headline", "hero.title", h.title, { full: true, area: true, rows: 3, max: 180, hint: "Use one line per headline line." })}
        ${settingsField("Message", "hero.lead", h.lead, { full: true, area: true, rows: 3, max: 360 })}
        ${settingsField("Hero image path", "hero.image", h.image, { max: 300 })}
        ${settingsField("Hero image alt text", "hero.imageAlt", h.imageAlt, { max: 180 })}
        ${settingsField("Hero card title", "hero.cardTitle", h.cardTitle, { max: 80 })}
        ${settingsField("Hero card text", "hero.cardText", h.cardText, { max: 180 })}
      </div>
    </section>
    <section>
      <h2>Homepage Stats</h2>
      <div class="form-grid compact">
        ${settingsField("Years", "stats.years", st.years, { max: 12 })}
        ${settingsField("Satisfaction", "stats.satisfaction", st.satisfaction, { max: 12 })}
        ${settingsField("Properties sold", "stats.properties", st.properties, { max: 12 })}
      </div>
    </section>
    <section>
      <h2>SEO Optimization</h2>
      <div class="notice">These fields control how the homepage appears in Google and when the website link is shared on WhatsApp, LinkedIn or other social platforms.</div>
      <div class="form-grid">
        ${settingsField("SEO title", "seo.title", seo.title, { full: true, max: 90, hint: "Best around 50-60 characters. Example: earthsar | Real Estate Advisory in Gurugram" })}
        ${settingsField("SEO description", "seo.description", seo.description, { full: true, area: true, rows: 3, max: 180, hint: "Best around 140-160 characters. This is often shown below the title in Google." })}
        ${settingsField("Keywords", "seo.keywords", seo.keywords, { full: true, area: true, rows: 2, max: 400, hint: "Comma-separated target phrases, such as real estate advisor Gurugram, property consultant Delhi NCR." })}
        ${settingsField("Canonical URL", "seo.canonicalUrl", seo.canonicalUrl, { full: true, type: "url", max: 300, hint: "Optional. Add the final live URL after hosting, for example https://earthsar.com/." })}
        ${settingsField("Robots", "seo.robots", seo.robots || "index, follow, max-image-preview:large", { max: 120, hint: "Use index, follow for public pages. Use noindex, nofollow only if you want to hide the site from search." })}
        ${settingsField("Social share image", "seo.ogImage", seo.ogImage || h.image, { max: 300, hint: "Image shown when sharing the link. Use an existing path such as assets/hero-property.jpg." })}
        ${settingsField("Social title", "seo.ogTitle", seo.ogTitle || seo.title, { full: true, max: 90 })}
        ${settingsField("Social description", "seo.ogDescription", seo.ogDescription || seo.description, { full: true, area: true, rows: 2, max: 220 })}
        ${settingsField("Social image alt text", "seo.ogImageAlt", seo.ogImageAlt || h.imageAlt, { full: true, max: 180 })}
        ${settingsField("Twitter/X title", "seo.twitterTitle", seo.twitterTitle || seo.ogTitle || seo.title, { max: 90 })}
        ${settingsField("Twitter/X description", "seo.twitterDescription", seo.twitterDescription || seo.ogDescription || seo.description, { full: true, area: true, rows: 2, max: 220 })}
      </div>
    </section>
    <section>
      <h2>Advisor Profiles</h2>
      <div class="advisor-grid">${[0, 1, 2, 3, 4].map(i => advisorEditor(team[i] || {}, i)).join("")}</div>
    </section>
    <div class="form-foot settings-foot"><span class="note-err" id="settingsErr" role="alert"></span><button class="btn btn-primary" id="settingsBtn" type="submit">Save website details</button></div>
  </form>`;
  normalizeContactDefaults();
  setTimeout(normalizeContactDefaults, 80);
  setTimeout(normalizeContactDefaults, 350);
  $("#settingsForm").onsubmit = saveSettingsForm;
}

function normalizeContactDefaults() {
  const form = $("#settingsForm");
  if (!form) return;
  const phone = $('[data-key="contact.phone"]', form);
  const whatsapp = $('[data-key="contact.whatsapp"]', form);
  const email = $('[data-key="contact.email"]', form);
  if (phone && !phone.value.trim() && whatsapp && whatsapp.value.trim()) phone.value = whatsapp.value.trim();
  if (whatsapp && !whatsapp.value.trim() && phone && phone.value.trim()) whatsapp.value = phone.value.trim();
  if (email && !email.value.trim()) email.value = "info@earthsar.in";
}

function settingsValue(form, name) {
  const el = $(`[data-key="${name}"]`, form);
  return el ? el.value.trim() : "";
}

async function saveSettingsForm(e) {
  e.preventDefault();
  const form = e.currentTarget, btn = $("#settingsBtn"), err = $("#settingsErr");
  err.textContent = "";
  normalizeContactDefaults();
  const settings = {
    contact: {
      phone: settingsValue(form, "contact.phone") || settingsValue(form, "contact.whatsapp") || "+91 79820 08930",
      whatsapp: settingsValue(form, "contact.whatsapp") || settingsValue(form, "contact.phone") || "+91 79820 08930",
      email: settingsValue(form, "contact.email") || "info@earthsar.in",
      hours: settingsValue(form, "contact.hours"),
      address: settingsValue(form, "contact.address")
    },
    hero: {
      eyebrow: settingsValue(form, "hero.eyebrow"),
      trust: settingsValue(form, "hero.trust").split(/[|,\n]/).map(x => x.trim()).filter(Boolean),
      title: settingsValue(form, "hero.title"),
      lead: settingsValue(form, "hero.lead"),
      image: settingsValue(form, "hero.image"),
      imageAlt: settingsValue(form, "hero.imageAlt"),
      cardTitle: settingsValue(form, "hero.cardTitle"),
      cardText: settingsValue(form, "hero.cardText")
    },
    stats: {
      years: settingsValue(form, "stats.years"),
      satisfaction: settingsValue(form, "stats.satisfaction"),
      properties: settingsValue(form, "stats.properties")
    },
    seo: {
      title: settingsValue(form, "seo.title"),
      description: settingsValue(form, "seo.description"),
      keywords: settingsValue(form, "seo.keywords"),
      canonicalUrl: settingsValue(form, "seo.canonicalUrl"),
      robots: settingsValue(form, "seo.robots") || "index, follow, max-image-preview:large",
      ogTitle: settingsValue(form, "seo.ogTitle"),
      ogDescription: settingsValue(form, "seo.ogDescription"),
      ogImage: settingsValue(form, "seo.ogImage"),
      ogImageAlt: settingsValue(form, "seo.ogImageAlt"),
      twitterTitle: settingsValue(form, "seo.twitterTitle"),
      twitterDescription: settingsValue(form, "seo.twitterDescription")
    },
    team: [0, 1, 2, 3, 4].map(i => ({
      name: settingsValue(form, `team.${i}.name`),
      role: settingsValue(form, `team.${i}.role`),
      experience: settingsValue(form, `team.${i}.experience`),
      photo: settingsValue(form, `team.${i}.photo`),
      bio: settingsValue(form, `team.${i}.bio`)
    }))
  };
  btn.disabled = true;
  try {
    state.settings = (await api("PATCH", "/settings", { settings })).settings;
    drawSettingsForm();
    toast("Website details saved.");
  } catch (ex) {
    err.textContent = ex.message;
  }
  btn.disabled = false;
}

boot();
})();
