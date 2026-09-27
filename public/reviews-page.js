(function(){
  "use strict";

  const staticReviews = window.earthsarGoogleReviews || [];
  const grid = document.getElementById("reviewPageGrid");
  const summary = document.getElementById("reviewPageSummary");
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
  const initials = name => String(name || "Google reviewer")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();
  const starText = rating => {
    const n = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
    return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  };
  const dateText = review => review.dateLabel || (review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Google review");

  function googleReviews(){
    return staticReviews.map((review, index) => ({
      id: `google-${index + 1}`,
      name: String(review.name || "Google reviewer").trim(),
      rating: Math.max(1, Math.min(5, parseInt(review.rating, 10) || 5)),
      message: String(review.message || "5-star rating shared on Google.").trim(),
      dateLabel: String(review.dateLabel || "Google review").trim(),
      source: "Google"
    }));
  }

  function mergeReviews(dynamicReviews){
    const seen = new Set();
    return [...googleReviews(), ...(dynamicReviews || [])].filter(review => {
      const key = `${String(review.name || "").toLowerCase()}|${String(review.message || "").toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function reviewStats(reviews){
    const total = reviews.reduce((sum, review) => sum + (parseInt(review.rating, 10) || 0), 0);
    return {
      count: reviews.length,
      average: reviews.length ? total / reviews.length : 0
    };
  }

  function render(reviews){
    const stats = reviewStats(reviews);
    summary.innerHTML = stats.count
      ? `<div><strong>${stats.average.toFixed(1)}</strong><span>average rating</span></div><div><strong>${stats.count}</strong><span>published reviews</span></div><div><strong>Google</strong><span>client feedback</span></div>`
      : `<div><strong>0</strong><span>reviews published</span></div>`;
    grid.innerHTML = reviews.length ? reviews.map(review => `
      <article class="review-page-card">
        <div class="review-page-head">
          <span class="review-avatar">${esc(initials(review.name))}</span>
          <div>
            <h3>${esc(review.name)}</h3>
            <div class="review-source">${esc(review.source || (review.verified ? "Verified client" : "Client review"))}</div>
          </div>
        </div>
        <div class="review-rating"><span>${starText(review.rating)}</span><em>${esc(dateText(review))}</em></div>
        <p>${esc(review.message)}</p>
      </article>
    `).join("") : `<div class="card"><h3>No reviews yet</h3><p>Client reviews will appear here after they are published.</p></div>`;
  }

  async function load(){
    let dynamicReviews = [];
    try{
      const response = await fetch("/api/reviews", { headers: { Accept: "application/json" } });
      if(response.ok){
        const data = await response.json();
        dynamicReviews = data.reviews || [];
      }
    }catch(error){}
    render(mergeReviews(dynamicReviews));
  }

  if(grid && summary) load();
})();
