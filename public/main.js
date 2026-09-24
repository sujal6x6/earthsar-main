/* earthsar website — main script.
   Static content lives in config.js. Reviews, the gallery and enquiries go through the server API. */
(function(){
"use strict";
document.body.classList.remove("no-js");
const C=window.EARTHSAR_CONFIG||{};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const icon=(id,cls="")=>`<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const safeUrl=u=>{try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:""}catch(e){return ""}};
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove("show"),3200)}
$("#yr").textContent=new Date().getFullYear();

function initCursorRing(){
  const ring=$("#cursorRing");
  if(!ring||reduce||!matchMedia("(hover: hover) and (pointer: fine)").matches)return;
  let x=innerWidth/2,y=innerHeight/2,tx=x,ty=y,running=false;
  const paint=()=>{
    x+=(tx-x)*.22;y+=(ty-y)*.22;
    ring.style.left=x+"px";ring.style.top=y+"px";
    requestAnimationFrame(paint);
  };
  addEventListener("pointermove",e=>{
    tx=e.clientX;ty=e.clientY;
    ring.classList.add("on");
    if(!running){running=true;x=tx;y=ty;requestAnimationFrame(paint)}
  },{passive:true});
  addEventListener("pointerdown",()=>ring.classList.add("down"),{passive:true});
  addEventListener("pointerup",()=>ring.classList.remove("down"),{passive:true});
  addEventListener("pointerleave",()=>ring.classList.remove("on"));
  addEventListener("blur",()=>ring.classList.remove("on"));
}

function setMeta(selector, attr, value){
  if(!value)return;
  let el=document.head.querySelector(selector);
  if(!el){
    el=document.createElement(selector.startsWith("link")?"link":"meta");
    if(selector.includes("[name="))el.setAttribute("name",(selector.match(/\[name="([^"]+)"/)||[])[1]||"");
    if(selector.includes("[property="))el.setAttribute("property",(selector.match(/\[property="([^"]+)"/)||[])[1]||"");
    if(selector.startsWith("link"))el.setAttribute("rel",(selector.match(/\[rel="([^"]+)"/)||[])[1]||"canonical");
    document.head.appendChild(el);
  }
  el.setAttribute(attr,value);
}
function absoluteAsset(url){
  if(!url)return "";
  try{return new URL(url,location.origin+"/").href}catch(e){return url}
}
function applySEO(seo){
  if(!seo)return;
  const title=seo.title||seo.ogTitle||seo.twitterTitle;
  const desc=seo.description||seo.ogDescription||seo.twitterDescription;
  if(title)document.title=title;
  setMeta('meta[name="description"]',"content",desc);
  setMeta('meta[name="keywords"]',"content",seo.keywords);
  setMeta('meta[name="robots"]',"content",seo.robots);
  setMeta('link[rel="canonical"]',"href",seo.canonicalUrl||location.origin+location.pathname);
  setMeta('meta[property="og:url"]',"content",seo.canonicalUrl||location.origin+location.pathname);
  setMeta('meta[property="og:title"]',"content",seo.ogTitle||title);
  setMeta('meta[property="og:description"]',"content",seo.ogDescription||desc);
  setMeta('meta[property="og:image"]',"content",absoluteAsset(seo.ogImage||S.hero.image));
  setMeta('meta[property="og:image:alt"]',"content",seo.ogImageAlt||S.hero.alt);
  setMeta('meta[name="twitter:title"]',"content",seo.twitterTitle||seo.ogTitle||title);
  setMeta('meta[name="twitter:description"]',"content",seo.twitterDescription||seo.ogDescription||desc);
  setMeta('meta[name="twitter:image"]',"content",absoluteAsset(seo.ogImage||S.hero.image));
}

/* ================= THEME ================= */
const themeMedia=matchMedia("(prefers-color-scheme: dark)");
function storedTheme(){try{return localStorage.getItem("earthsar-theme")||""}catch(e){return ""}}
function currentTheme(){
  const forced=document.documentElement.dataset.theme;
  if(forced==="dark"||forced==="light")return forced;
  return themeMedia.matches?"dark":"light";
}
function setTheme(theme){
  if(theme==="dark"||theme==="light"){
    document.documentElement.dataset.theme=theme;
    try{localStorage.setItem("earthsar-theme",theme)}catch(e){}
  }
  paintThemeToggle();
}
function paintThemeToggle(){
  const dark=currentTheme()==="dark";
  $$("[data-theme-toggle]").forEach(btn=>{
    btn.classList.toggle("is-dark",dark);
    btn.setAttribute("aria-pressed",dark?"true":"false");
    btn.setAttribute("aria-label",dark?"Switch to light mode":"Switch to dark mode");
    const txt=$(".theme-text",btn);
    if(txt)txt.textContent=dark?"Light":"Dark";
  });
}
document.addEventListener("click",e=>{
  const btn=e.target.closest("[data-theme-toggle]");
  if(!btn)return;
  setTheme(currentTheme()==="dark"?"light":"dark");
});
themeMedia.addEventListener("change",()=>{if(!storedTheme())paintThemeToggle()});
paintThemeToggle();
initCursorRing();


/* ================= STATE ================= */
/* Static content comes from config.js. Reviews and the gallery come from the server. */
const S={
  partners:C.partners||[],credentials:C.credentials||[],team:C.team||[],
  reviews:[],summary:null,gallery:[],limits:{photoMb:8,videoMb:50},loaded:false,
  settings:Object.assign({},C.stats||{},C.contact||{}),
  hero:{image:C.heroImage||"",alt:C.heroImageAlt||"earthsar advisors with clients"},
  showAll:false,galFilter:"all",galAll:false,cmFilter:"all",cmAll:false
};
async function getJSON(url){const r=await fetch(url,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
async function loadSiteSettings(){
  try{
    const d=await getJSON("/api/settings");
    const x=d.settings||{};
    if(x.contact||x.stats)S.settings=Object.assign({},S.settings,x.stats||{},x.contact||{});
    if(x.hero)S.hero=Object.assign({},S.hero,x.hero,{image:x.hero.image||"",alt:x.hero.imageAlt||x.hero.alt||S.hero.alt});
    if(Array.isArray(x.team))S.team=x.team;
    applySEO(x.seo);
    renderHeroContent();renderHero();renderStats();renderContact();renderTeam();
  }catch(e){}
}

/* ================= HERO ART ================= */
function heroSVG(){
  const W=480,H=560,VP={x:250,y:-900},B=640;
  const at=(bx,y)=>bx+(VP.x-bx)*(B-y)/(B-VP.y);
  const face=(x0,x1,fill,line,op,top)=>{
    let s=`<polygon points="${at(x0,B)},${B} ${at(x1,B)},${B} ${at(x1,top)},${top} ${at(x0,top)},${top}" fill="${fill}"/>`;
    for(let k=1;k<200;k++){const y=VP.y+(B-VP.y)*40/(40+k*1.6);if(y<top)break;s+=`<line x1="${at(x0,y)}" y1="${y}" x2="${at(x1,y)}" y2="${y}" stroke="${line}" stroke-opacity="${op}" stroke-width="1.2"/>`}
    const n=Math.round(Math.abs(x1-x0)/26);
    for(let i=1;i<n;i++){const bx=x0+(x1-x0)*i/n;s+=`<line x1="${bx}" y1="${B}" x2="${at(bx,top)}" y2="${top}" stroke="${line}" stroke-opacity="${op*.7}" stroke-width="1"/>`}
    return s;
  };
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Abstract modern architecture rising into a clear sky">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EAF2FF"/><stop offset="1" stop-color="#F7FAFF"/></linearGradient>
  <linearGradient id="rf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A57C2"/><stop offset="1" stop-color="#003A88"/></linearGradient>
  <linearGradient id="lf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE8FA"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="96" cy="120" r="150" fill="#004AAD" opacity=".06"/>
  <circle cx="92" cy="118" r="30" fill="#F1770A"/>
  ${face(-60,70,"#C9DBF5","#004AAD",.25,250)}
  ${face(70,250,"url(#lf)","#004AAD",.28,-20)}
  ${face(250,470,"url(#rf)","#FFFFFF",.22,-20)}
  <line x1="${at(250,B)}" y1="${B}" x2="${at(250,-20)}" y2="-20" stroke="#fff" stroke-width="1.5" opacity=".7"/>
  <line x1="0" y1="452" x2="${W}" y2="452" stroke="#F1770A" stroke-width="3"/>
  </svg>`;
}
function renderHero(){
  const f=$("#heroFrame");
  if(S.hero.image){f.innerHTML=`<img src="${esc(S.hero.image)}" alt="${esc(S.hero.alt)}">`}else{f.innerHTML=heroSVG()}
}
function renderHeroContent(){
  const h=S.hero||{};
  if(h.eyebrow)$(".hero .eyebrow").textContent=h.eyebrow;
  if(h.title){
    const lines=String(h.title).split(/\n+/).map(s=>s.trim()).filter(Boolean).slice(0,4);
    $(".hero h1").innerHTML=lines.map(line=>{
      const html=esc(line).replace(/\b(Return)\b/i,'<span class="o">$1</span>');
      return `<span class="ln">${html}</span>`;
    }).join("");
  }
  if(h.lead)$(".hero p.lead").textContent=h.lead;
  if(Array.isArray(h.trust)&&h.trust.length){
    $(".trust-list").innerHTML=h.trust.map(t=>`<li><span class="tick"><svg><use href="#i-tick"/></svg></span>${esc(t)}</li>`).join("");
  }
  const card=$(".hero-card div");
  if(card&&(h.cardTitle||h.cardText))card.innerHTML=`<b>${esc(h.cardTitle||"The 3R value")}</b><span>${esc(h.cardText||"Right property, right time, right return.")}</span>`;
}


/* ================= STATS ================= */
const STAT_DEF={years:{suf:"+"},satisfaction:{suf:"%"},properties:{suf:"K"},clients:{suf:"+"},associations:{suf:"+"}};
function renderStats(){
  $$(".stat-num").forEach(el=>{
    const k=el.dataset.k,v=S.settings[k],def=STAT_DEF[k]||{suf:""},suf=def.suf,n=parseInt(v,10);
    if(!v||isNaN(n)){el.classList.add("ph");el.innerHTML=`XX<sup>${suf}</sup>`;el.dataset.n="";return}
    el.dataset.n=n;el.innerHTML=`0<sup>${suf}</sup>`;
  });
}
function countUp(el){
  const n=+el.dataset.n,def=STAT_DEF[el.dataset.k]||{suf:""},suf=def.suf;
  if(reduce){el.innerHTML=`${n.toLocaleString("en-IN")}<sup>${suf}</sup>`;return}
  const t0=performance.now(),dur=1600;
  (function f(t){const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.innerHTML=`${Math.round(n*e).toLocaleString("en-IN")}<sup>${suf}</sup>`;if(p<1)requestAnimationFrame(f)})(t0);
}

/* ================= CONTACT ================= */
function renderContact(){
  const c=S.settings||{};
  const tbd=t=>`<span class="tbd">${t}</span>`;
  const waDigits=(c.whatsapp||c.phone||"").replace(/\D/g,"");
  const waText=encodeURIComponent("Hello earthsar, I would like to discuss a property requirement.");
  const wa=waDigits?`<a href="https://wa.me/${esc(waDigits)}?text=${waText}" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>`:tbd("WhatsApp number to be added");
  const phone=c.phone?`<a href="tel:${esc(c.phone.replace(/\s+/g,""))}">${esc(c.phone)}</a>`:tbd("Phone number to be added");
  const email=c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:tbd("Email to be added");
  const addr=c.address?`<span>${esc(c.address)}</span>`:tbd("Office address to be added");
  const hrs=c.hours?`<span>${esc(c.hours)}</span>`:tbd("Office hours to be added");
  $("#cinfo").innerHTML=`<li><span class="ic" style="color:var(--heading)">${icon("i-phone")}</span><div><small>Call</small>${phone}</div></li>
  <li><span class="ic" style="color:var(--heading)">${icon("i-support")}</span><div><small>WhatsApp</small>${wa}</div></li>
  <li><span class="ic" style="color:var(--heading)">${icon("i-mail")}</span><div><small>Email</small>${email}</div></li>
  <li><span class="ic" style="color:var(--heading)">${icon("i-building")}</span><div><small>Office</small>${addr}</div></li>
  <li><span class="ic" style="color:var(--heading)">${icon("i-clock")}</span><div><small>Hours</small>${hrs}</div></li>`;
  $("#fContact").innerHTML=`${c.phone?`<li><a href="tel:${esc(c.phone.replace(/\s+/g,""))}">${esc(c.phone)}</a></li>`:""}${waDigits?`<li><a href="https://wa.me/${esc(waDigits)}?text=${waText}" target="_blank" rel="noopener noreferrer">WhatsApp</a></li>`:""}${c.email?`<li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>`:""}${c.address?`<li>${esc(c.address)}</li>`:""}<li><a href="#contact">Send an enquiry</a></li>`;
}


/* ================= PARTNERS (marquee) ================= */
let carTimer=null;
function renderPartners(){
  const box=$("#partners");clearInterval(carTimer);
  if(!S.partners.length){
    box.innerHTML=`<div class="empty"><b>Partner logos will appear here</b>Our network is being updated.</div>`;return}
  /* Build a single tile markup */
  const tile=p=>{
    const w=safeUrl(p.website),tag=w?"a":"div",attrs=w?` href="${esc(w)}" target="_blank" rel="noopener noreferrer"`:"";
    return `<${tag} class="logo-tile"${attrs} title="${esc(p.name)}">${p.logo?`<img src="${esc(p.logo)}" alt="${esc(p.name)} logo" loading="lazy">`:`<span class="txtlogo">${esc(p.name)}</span>`}</${tag}>`;
  };

  /* Single row, duplicated for seamless loop */
  const all=S.partners.map(tile).join("");
  box.innerHTML=`<div class="marquee-track" aria-label="Associated companies">${all}${all}</div>`;
}

/* ================= CREDENTIALS ================= */
function renderCreds(){
  const g=$("#creds");
  const sec=$("#achievements");
  if(!S.credentials.length){
    if(sec)sec.hidden=true;
    g.innerHTML="";
    return;
  }
  if(sec)sec.hidden=false;
  g.innerHTML=S.credentials.map(c=>`<article class="card card-hover cred reveal in"><span class="tag">${esc(c.type||"Credential")}</span><h3>${esc(c.title)}</h3><div class="meta">${esc([c.issuer,c.year].filter(Boolean).join(", "))}</div>${c.description?`<p>${esc(c.description)}</p>`:""}${c.reference?`<div class="ref">Reference: <b>${esc(c.reference)}</b></div>`:""}</article>`).join("");
}

/* ================= TEAM ================= */
function initials(n){return String(n||"?").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase()}
function renderTeam(){
  const g=$("#teamGrid");
  if(!S.team.length){
    g.innerHTML=[1,2,3].map(()=>`<article class="card member ph"><div class="member-photo"><span class="ini">${icon("i-user")}</span></div><div class="member-body"><h3>Advisor name</h3><div class="role">Designation</div><div class="div"></div><p>Placeholder profile — add real team members in js/config.js.</p></div></article>`).join("");
    $$(".member.ph .ini svg",g).forEach(s=>{s.style.width="64px";s.style.height="64px";s.style.color="var(--heading)"});return}
  g.innerHTML=S.team.map((m,idx)=>{
    return `<article class="card card-hover member reveal in"><div class="member-photo">${m.photo?`<img src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy">`:`<span class="ini">${esc(initials(m.name))}</span>`}</div><div class="member-body"><h3>${esc(m.name)}</h3><div class="role">${esc(m.role)}</div><div class="div"></div>${m.experience?`<div class="xp">${esc(m.experience)}</div>`:""}<button class="btn btn-secondary member-read" type="button" data-team="${idx}">Read more</button></div></article>`;
  }).join("");
}
function openTeamModal(i){
  const m=S.team[i];if(!m)return;
  const li=safeUrl(m.linkedin);
  const bio=m.bio?String(m.bio).split(/\n{2,}/).map(p=>{
    const text=String(p).trim();
    return /^Beyond Real Estate$/i.test(text)?`<h4>${esc(text)}</h4>`:`<p>${esc(text)}</p>`;
  }).join(""):"";
  openModal(`<div class="modal-h"><div><h3 id="modalTitle">${esc(m.name)}</h3><p>${esc(m.role||"")}</p></div>${xBtn}</div>
  <div class="modal-b advisor-modal">
    <div class="advisor-modal-photo">${m.photo?`<img src="${esc(m.photo)}" alt="${esc(m.name)}">`:`<span class="ini">${esc(initials(m.name))}</span>`}</div>
    <div class="advisor-modal-copy">
      ${m.experience?`<div class="xp">${esc(m.experience)}</div>`:""}
      ${bio}
      ${li?`<a class="li" href="${esc(li)}" target="_blank" rel="noopener noreferrer">${icon("i-in")}LinkedIn</a>`:""}
    </div>
  </div>`,"advisor-profile");
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-team]");if(b){e.preventDefault();openTeamModal(+b.dataset.team)}});

/* ================= REVIEWS ================= */
const stars=(n,cls="")=>`<span class="stars ${cls}" aria-label="${n} out of 5 stars">${[1,2,3,4,5].map(i=>`<svg class="${i<=Math.floor(n+.25)?"":"off"}" aria-hidden="true"><use href="#i-star"/></svg>`).join("")}</span>`;
const fmtDate=t=>t?new Date(t).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"";
function videoInfo(u){
  if(!u)return null;const s=safeUrl(u);if(!s)return null;
  let m=s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if(m)return{kind:"youtube",url:s};
  m=s.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if(m)return{kind:"vimeo",url:s};
  return{kind:"link",url:s};
}
/* Every photo and video attached to one review, in display order. */
function reviewMedia(r){
  const list=(r.media||[]).map(m=>Object.assign({},m,{review:r}));
  if(r.videoLink)list.push(Object.assign({},r.videoLink,{review:r}));
  return list;
}
function renderReviews(){
  const R=S.reviews,sum=S.summary||{count:0,average:0,distribution:{}},n=sum.count,avg=sum.average;
  $("#summary").removeAttribute("aria-busy");
  $("#summary").innerHTML=n?`<div class="big">${avg.toFixed(1)}</div>${stars(avg)}<div class="based">Based on ${n} published review${n>1?"s":""}</div>
    <div class="bars">${[5,4,3,2,1].map(k=>{const c=sum.distribution[k]||0;return `<div class="bar"><span>${k}★</span><span class="t"><i style="width:${c/n*100}%"></i></span><span>${c}</span></div>`}).join("")}</div>`
    :`<div class="big" style="color:var(--faint)">—</div>${stars(0)}<div class="based">${S.loaded?"No reviews published yet. Be the first to share your experience.":"Reviews could not be loaded. Refresh the page to try again."}</div>`;
  const list=S.showAll?R:R.slice(0,6);
  $("#revGrid").innerHTML=R.length?list.map(r=>{
    const items=reviewMedia(r),hasVideo=items.some(m=>m.type==="video");
    return `<article class="card rev"><div class="rev-h"><span class="avatar">${r.avatar?`<img src="${esc(r.avatar)}" alt="">`:esc(initials(r.name))}</span><div><div class="rev-name">${esc(r.name)}</div>${r.verified?`<span class="badge" style="color:var(--heading)">${icon("i-verified")}Verified Client</span>`:""}</div></div>
    <div class="rev-meta">${stars(+r.rating,"sm")}<span class="rev-date">${esc(fmtDate(r.createdAt))}</span></div>
    <p>${esc(r.message)}</p>
    ${items.length?`<div class="rev-photos">${items.map((m,j)=>`<button class="${m.type==="video"?"vthumb":""}" data-rm="${r.id}:${j}" aria-label="${m.type==="video"?"Play video":"View photo "+(j+1)}">${m.thumb?`<img src="${esc(m.thumb)}" alt="" loading="lazy">`:""}${m.type==="video"?icon("i-play"):""}</button>`).join("")}</div>`:""}
    ${hasVideo?`<button class="rev-video" data-rm="${r.id}:${items.findIndex(m=>m.type==="video")}">${icon("i-video")}<span>Watch video testimonial</span></button>`:""}</article>`}).join("")
    :`<div class="empty" style="grid-column:1/-1"><b>Client reviews will appear here</b>Reviews are published after our team confirms them.</div>`;
  $$(".rev-video > svg").forEach(s=>{s.style.width="20px";s.style.height="20px"});
  $$(".badge svg").forEach(s=>{s.style.width="14px";s.style.height="14px"});
  $("#moreWrap").innerHTML=R.length>6?`<button class="btn btn-secondary" id="moreBtn">${S.showAll?"Show fewer reviews":`Show all ${R.length} reviews`}</button>`:"";
  const mb=$("#moreBtn");if(mb)mb.onclick=()=>{S.showAll=!S.showAll;renderReviews()};
  $$("[data-rm]").forEach(b=>b.onclick=()=>{const[id,j]=b.dataset.rm.split(":").map(Number);const r=S.reviews.find(x=>x.id===id);if(r)openViewer(reviewMedia(r),j)});
}

/* ================= MEDIA GRIDS (gallery + client photos/videos) ================= */
function renderTabs(box,all,current,onPick){
  const nP=all.filter(m=>m.type==="image").length,nV=all.length-nP;
  if(!nP||!nV){box.hidden=true;return}
  box.hidden=false;
  box.innerHTML=[["all","All",all.length],["image","Photos",nP],["video","Videos",nV]].map(([k,l,n])=>`<button role="tab" aria-selected="${k===current}" data-f="${k}">${l}<span class="n">${n}</span></button>`).join("");
  $$("button",box).forEach(b=>b.onclick=()=>onPick(b.dataset.f));
}
function tile(m,i,capHtml,big){
  const vid=m.type==="video";
  return `<button class="mtile${m.thumb?"":" noimg"}${big?" big":""}" data-i="${i}" aria-label="${vid?"Play video":"View photo"}${m.title?": "+esc(m.title):""}">${m.thumb?`<img src="${esc(m.thumb)}" alt="" loading="lazy">`:""}${vid?`<span class="play">${icon("i-play")}</span>`:""}${capHtml?`<span class="cap">${capHtml}</span>`:""}</button>`;
}
function renderGrid({grid,more,list,showAll,setAll,capFn,featureFirst,invite}){
  /* Show 8 at first (9 with an enlarged first tile). The first tile is enlarged (it takes 4 cells) only when
     that leaves no gap in a 4-column row: 5, 9, 13… tiles. */
  const PAGE=featureFirst&&list.length>=9?9:8,shown=showAll?list:list.slice(0,PAGE);
  const big=featureFirst&&shown.length>=5&&(shown.length+3)%4===0;
  grid.innerHTML=shown.map((m,i)=>tile(m,i,capFn(m),big&&i===0)).join("")+(invite||"");
  $$("[data-i]",grid).forEach(b=>b.onclick=()=>openViewer(list,+b.dataset.i));
  more.innerHTML=list.length>PAGE?`<button class="btn btn-secondary">${showAll?"Show less":`Show all ${list.length}`}</button>`:"";
  const mb=$("button",more);if(mb)mb.onclick=()=>setAll(!showAll);
}
function renderGallery(){
  const G=S.gallery,sec=$("#gallery");
  const has=G.length>0;sec.hidden=!has;$("[data-gallery-link]").hidden=!has;
  if(!has)return;
  if(S.galFilter!=="all"&&!G.some(m=>m.type===S.galFilter))S.galFilter="all";
  renderTabs($("#galTabs"),G,S.galFilter,f=>{S.galFilter=f;S.galAll=false;renderGallery()});
  const list=S.galFilter==="all"?G:G.filter(m=>m.type===S.galFilter);
  renderGrid({grid:$("#galGrid"),more:$("#galMore"),list,showAll:S.galAll,setAll:v=>{S.galAll=v;renderGallery()},
    capFn:m=>m.title?`<b>${esc(m.title)}</b>`:"",featureFirst:true});
}
function renderClientMedia(){
  const all=S.reviews.flatMap(reviewMedia);
  if(S.cmFilter!=="all"&&!all.some(m=>m.type===S.cmFilter))S.cmFilter="all";
  renderTabs($("#cmTabs"),all,S.cmFilter,f=>{S.cmFilter=f;S.cmAll=false;renderClientMedia()});
  if(!all.length){
    $("#cmGrid").innerHTML=`<div class="empty"><b>Photos and videos from client reviews will appear here</b>Clients can add photos or a video with their review.</div>`;
    $("#cmMore").innerHTML="";return;
  }
  const list=S.cmFilter==="all"?all:all.filter(m=>m.type===S.cmFilter);
  renderGrid({grid:$("#cmGrid"),more:$("#cmMore"),list,showAll:S.cmAll,setAll:v=>{S.cmAll=v;renderClientMedia()},
    capFn:m=>`<b>${esc(m.review.name)}</b>${stars(+m.review.rating,"sm")}`});
}

async function loadDynamic(){
  const [rv,gl]=await Promise.allSettled([getJSON("/api/reviews"),getJSON("/api/gallery")]);
  if(rv.status==="fulfilled"){S.reviews=rv.value.reviews||[];S.summary=rv.value.summary;if(rv.value.limits)S.limits=rv.value.limits;S.loaded=true}
  if(gl.status==="fulfilled")S.gallery=gl.value.items||[];
  renderReviews();renderClientMedia();renderGallery();
  if(location.hash==="#gallery"&&S.gallery.length)$("#gallery").scrollIntoView();
}

renderHeroContent();renderHero();renderStats();renderContact();renderPartners();renderCreds();renderTeam();loadSiteSettings();loadDynamic();

/* ================= MODAL ================= */
let lastFocus=null,onClose=null;
function openModal(html,cls=""){
  if(onClose){onClose();onClose=null}
  lastFocus=lastFocus||document.activeElement;
  const box=$("#modalBox");box.className="modal-box "+cls;box.innerHTML=html;
  $("#modal").classList.add("open");document.body.style.overflow="hidden";
  const f=box.querySelector("input,button,select,textarea,[tabindex]");if(f)setTimeout(()=>f.focus(),30);
}
function closeModal(){if(onClose){onClose();onClose=null}$("#modal").classList.remove("open");$("#modalBox").innerHTML="";document.body.style.overflow="";if(lastFocus)lastFocus.focus();lastFocus=null}
document.addEventListener("click",e=>{if(e.target.closest("[data-close]"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#modal").classList.contains("open"))closeModal()});
const xBtn=`<button class="modal-x" data-close aria-label="Close">${icon("i-x")}</button>`;

/* Photo / video viewer with previous and next. */
function openViewer(items,start){
  if(!items||!items.length)return;
  let i=Math.max(0,Math.min(start||0,items.length-1));
  const multi=items.length>1;
  openModal(`${xBtn}<div class="viewer">${multi?`<button class="nav-btn prev" aria-label="Previous">${icon("i-left")}</button><button class="nav-btn next" aria-label="Next">${icon("i-right")}</button>`:""}<div class="stage" id="vStage"></div></div><div class="media-alt" id="vAlt"></div>`,"media");
  const draw=()=>{
    const m=items[i],r=m.review;
    let body;
    if(m.type==="video"&&m.embed)body=`<div class="media-frame"><iframe src="${esc(m.embed)}" title="${esc(r?"Video from "+r.name:m.title||"Video")}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
    else if(m.type==="video")body=`<div class="media-frame"><video src="${esc(m.full||m.url)}"${m.thumb?` poster="${esc(m.thumb)}"`:""} controls autoplay playsinline></video></div>`;
    else body=`<img src="${esc(m.full||m.url)}" alt="${esc(r?"Photo shared by "+r.name:m.title||"Gallery photo")}">`;
    $("#vStage").innerHTML=body;
    const label=r?`${esc(r.name)}${r.verified?" · Verified Client":""}`:[m.title&&`<b style="color:#fff">${esc(m.title)}</b>`,m.caption&&esc(m.caption)].filter(Boolean).join(" — ");
    const ext=m.embed?`<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">Open on ${/vimeo/.test(m.url)?"Vimeo":"YouTube"}</a>`:"";
    $("#vAlt").innerHTML=`<span>${label}</span><span>${ext}${multi?`<span class="count"${ext?' style="margin-left:14px"':""}>${i+1} / ${items.length}</span>`:""}</span>`;
  };
  const go=d=>{i=(i+d+items.length)%items.length;draw()};
  if(multi){$(".viewer .prev").onclick=()=>go(-1);$(".viewer .next").onclick=()=>go(1)}
  const key=e=>{if(e.key==="ArrowLeft"&&multi)go(-1);if(e.key==="ArrowRight"&&multi)go(1)};
  document.addEventListener("keydown",key);onClose=()=>document.removeEventListener("keydown",key);
  draw();
}

/* ================= FORM SENDING ================= */
/* XHR rather than fetch so we can show upload progress for photos and videos. */
function postForm(url,body,onProgress){
  return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest();x.open("POST",url);x.setRequestHeader("Accept","application/json");
    if(!(body instanceof FormData))x.setRequestHeader("Content-Type","application/json");
    if(onProgress)x.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total)};
    x.onload=()=>{let d={};try{d=JSON.parse(x.responseText)}catch(e){}
      if(x.status>=200&&x.status<300)resolve(d);else{const er=new Error(d.error||"failed");er.fields=d.fields||{};er.status=x.status;reject(er)}};
    x.onerror=()=>reject(new Error("network"));
    x.send(body instanceof FormData?body:JSON.stringify(body));
  });
}

/* ================= REVIEW FORM ================= */
function openReviewForm(){
  const L=S.limits;
  openModal(`<div class="modal-h"><div><h3 id="modalTitle">Share your experience</h3><p>Your review will appear after our team confirms it.</p></div>${xBtn}</div>
  <div class="modal-b"><form id="revForm" novalidate><div class="form-grid">
    <div class="hp" aria-hidden="true"><label>Leave this empty <input id="r-website" tabindex="-1" autocomplete="off"></label></div>
    <div class="fld"><label for="r-name">Name</label><input id="r-name" autocomplete="name" required maxlength="80"><div class="emsg">Enter your name.</div></div>
    <div class="fld"><label for="r-email">Email</label><input id="r-email" type="email" autocomplete="email" required><div class="hint">Not shown publicly.</div><div class="emsg">Enter a valid email address.</div></div>
    <div class="fld full"><label for="r-phone">Phone <span class="opt">(optional, not shown publicly)</span></label><input id="r-phone" type="tel" autocomplete="tel" maxlength="30"></div>
    <div class="fld full" id="rateFld"><label id="rateLbl">Your rating</label><div style="display:flex;flex-wrap:wrap"><div class="star-pick" role="radiogroup" aria-labelledby="rateLbl">${[1,2,3,4,5].map(i=>`<button type="button" role="radio" aria-checked="false" aria-label="${i} star${i>1?"s":""}" data-s="${i}">${icon("i-star")}</button>`).join("")}</div><span class="star-txt" id="starTxt"></span></div><div class="emsg">Choose a rating from 1 to 5 stars.</div></div>
    <div class="fld full"><label for="r-msg">Your review</label><textarea id="r-msg" required maxlength="1500" placeholder="What did earthsar help you with, and how was the experience?"></textarea><div class="emsg">Write a few words about your experience.</div></div>
    <div class="fld"><label>Profile photo <span class="opt">(optional)</span></label><label class="drop"><input type="file" accept="image/*" id="r-photo"><span class="dic" style="color:var(--heading)">${icon("i-user")}</span><span><b id="r-photo-l">Add a photo</b><span>JPG or PNG, up to ${L.photoMb} MB</span></span></label></div>
    <div class="fld"><label>Photos <span class="opt">(up to 4)</span></label><label class="drop"><input type="file" accept="image/*" multiple id="r-photos"><span class="dic" style="color:var(--heading)">${icon("i-image")}</span><span><b id="r-photos-l">Add photos</b><span>From your experience</span></span></label></div>
    <div class="fld full"><label>Video testimonial <span class="opt">(optional, up to ${L.videoMb} MB)</span></label><label class="drop"><input type="file" accept="video/mp4,video/webm,video/quicktime" id="r-video"><span class="dic" style="color:var(--heading)">${icon("i-video")}</span><span><b id="r-video-l">Upload a video</b><span>MP4, MOV or WebM</span></span></label></div>
    <div class="fld full"><label for="r-vurl">Or a YouTube or Vimeo link <span class="opt">(optional)</span></label><input id="r-vurl" type="url" placeholder="https://youtu.be/…"><div class="emsg">Paste a full YouTube or Vimeo link.</div></div>
  </div>
  <div class="progress" id="rProg"><i></i></div>
  <div class="form-foot"><span class="note-err" id="rErr" role="alert"></span><button class="btn btn-primary" type="submit" id="rBtn">Submit review</button></div></form></div>`);
  const f={rating:0};
  const labels=["","Poor","Fair","Good","Very good","Excellent"];
  const paint=n=>$$(".star-pick button").forEach(b=>{b.classList.toggle("on",+b.dataset.s<=n);b.setAttribute("aria-checked",+b.dataset.s===f.rating?"true":"false")});
  $$(".star-pick button").forEach(b=>{b.onclick=()=>{f.rating=+b.dataset.s;paint(f.rating);$("#starTxt").textContent=labels[f.rating];$("#rateFld").classList.remove("err")};b.onmouseenter=()=>paint(+b.dataset.s);b.onmouseleave=()=>paint(f.rating)});
  const label=(inp,lbl,def)=>$(inp).onchange=e=>{const fs=Array.from(e.target.files);$(lbl).textContent=fs.length?(fs.length>1?`${fs.length} files selected`:fs[0].name):def};
  label("#r-photo","#r-photo-l","Add a photo");label("#r-photos","#r-photos-l","Add photos");label("#r-video","#r-video-l","Upload a video");
  const FIELD={name:"#r-name",email:"#r-email",message:"#r-msg",videoLink:"#r-vurl"};
  $("#revForm").onsubmit=async e=>{
    e.preventDefault();$("#rErr").textContent="";
    const name=$("#r-name").value.trim(),email=$("#r-email").value.trim(),msg=$("#r-msg").value.trim(),vurl=$("#r-vurl").value.trim();
    const bad=[];const mark=(id,ok)=>{$(id).closest(".fld").classList.toggle("err",!ok);if(!ok)bad.push(id)};
    mark("#r-name",name.length>=2);mark("#r-email",/^\S+@\S+\.\S+$/.test(email));mark("#r-msg",msg.length>=3);
    $("#rateFld").classList.toggle("err",!f.rating);if(!f.rating)bad.push("rate");
    const vi=vurl?videoInfo(vurl):null;mark("#r-vurl",!vurl||(vi&&vi.kind!=="link"));
    if(bad.length){$("#rErr").textContent="Check the highlighted fields.";return}
    const avatar=$("#r-photo").files[0],photos=Array.from($("#r-photos").files),video=$("#r-video").files[0];
    const MB=1024*1024,bigPhoto=[avatar,...photos].filter(Boolean).find(p=>p.size>L.photoMb*MB);
    if(photos.length>4){$("#rErr").textContent="Choose up to 4 photos.";return}
    if(bigPhoto){$("#rErr").textContent=`${bigPhoto.name} is larger than ${L.photoMb} MB. Choose a smaller photo.`;return}
    if(video&&video.size>L.videoMb*MB){$("#rErr").textContent=`That video is larger than ${L.videoMb} MB. Use a shorter clip or a YouTube link.`;return}
    const fd=new FormData();
    fd.append("name",name);fd.append("email",email);fd.append("phone",$("#r-phone").value.trim());
    fd.append("rating",f.rating);fd.append("message",msg);fd.append("videoLink",vi?vi.url:"");fd.append("website",$("#r-website").value);
    if(avatar)fd.append("avatar",avatar);photos.forEach(p=>fd.append("photos",p));if(video)fd.append("video",video);
    const hasFiles=!!(avatar||photos.length||video);
    const btn=$("#rBtn"),prog=$("#rProg"),bar=$("i",prog);btn.disabled=true;btn.textContent=hasFiles?"Uploading…":"Sending…";
    prog.classList.add("show");bar.style.width=hasFiles?"2%":"40%";
    try{
      await postForm("/api/reviews",fd,p=>{bar.style.width=Math.round(p*90)+"%";if(p>=1)btn.textContent="Processing…"});
      bar.style.width="100%";
      setTimeout(()=>{$("#modalBox").innerHTML=`<div class="modal-h"><div><h3>Thank you, ${esc(name.split(" ")[0])}.</h3><p>Your review has been sent. It will appear on the site after our team confirms it.</p></div>${xBtn}</div><div class="modal-b"><button class="btn btn-primary" data-close>Done</button></div>`},300);
    }catch(er){
      btn.disabled=false;btn.textContent="Submit review";prog.classList.remove("show");
      Object.entries(er.fields||{}).forEach(([k])=>{if(FIELD[k])$(FIELD[k]).closest(".fld").classList.add("err");if(k==="rating")$("#rateFld").classList.add("err")});
      $("#rErr").textContent=er.message==="network"?"The review could not be sent. Check your connection and try again.":er.message==="failed"?"The review could not be sent. Try again in a moment.":er.message;
    }
  };
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-review]");if(b){e.preventDefault();openReviewForm()}});

/* ================= ENQUIRY ================= */
$("#enqForm").onsubmit=async e=>{
  e.preventDefault();$("#enqErr").textContent="";$("#enqOk").classList.remove("show");
  const g=id=>$(id).value.trim();const bad=[];
  const mark=(id,ok)=>{$(id).closest(".fld").classList.toggle("err",!ok);if(!ok)bad.push(id)};
  mark("#e-name",!!g("#e-name"));mark("#e-phone",g("#e-phone").replace(/\D/g,"").length>=7);mark("#e-email",!g("#e-email")||/^\S+@\S+\.\S+$/.test(g("#e-email")));
  $("#consentFld").classList.toggle("err",!$("#e-consent").checked);if(!$("#e-consent").checked)bad.push("c");
  if(bad.length){$("#enqErr").textContent="Check the highlighted fields.";return}
  const btn=$("#enqBtn");btn.disabled=true;btn.textContent="Sending…";
  try{
    await postForm("/api/enquiries",{name:g("#e-name"),phone:g("#e-phone"),email:g("#e-email"),topic:$("#e-topic").value,message:g("#e-msg"),consent:true,website:$("#e-website").value});
    $("#enqForm").reset();$("#enqOk").classList.add("show");
  }catch(er){
    const call=S.settings.phone?` You can also call us on ${S.settings.phone}.`:"";
    $("#enqErr").textContent=(er.message==="network"||er.message==="failed"?"The enquiry could not be sent. Check your connection and try again.":er.message)+call;
  }
  btn.disabled=false;btn.textContent="Send enquiry";
};

/* ================= LEGAL ================= */
document.addEventListener("click",e=>{const b=e.target.closest("[data-legal]");if(!b)return;
  const url=C.legal&&C.legal[b.dataset.legal];if(url){b.href=url;return}
  e.preventDefault();
  const t={privacy:"Privacy policy",terms:"Terms of use",disclaimer:"Disclaimer"}[b.dataset.legal];
  openModal(`<div class="modal-h"><div><h3 id="modalTitle">${t}</h3><p>This page will hold earthsar's approved ${t.toLowerCase()}.</p></div>${xBtn}</div><div class="modal-b"><p style="color:var(--muted)">The final wording is being prepared.</p></div>`)});

/* ================= NAV / SCROLL / REVEAL ================= */
const hdr=$("#hdr");
const onScroll=()=>hdr.classList.toggle("scrolled",scrollY>8);addEventListener("scroll",onScroll,{passive:true});onScroll();
$("#menuBtn").onclick=()=>{const o=hdr.classList.toggle("open");$("#menuBtn").setAttribute("aria-expanded",o)};
$$("#nav a").forEach(a=>a.addEventListener("click",()=>{hdr.classList.remove("open");$("#menuBtn").setAttribute("aria-expanded","false")}));
$$("[data-talk]").forEach(a=>a.addEventListener("click",()=>setTimeout(()=>$("#e-name").focus({preventScroll:true}),600)));
const navMap=["about","expertise","why","associations","achievements","gallery","reviews","contact"];
const setActive=id=>$$("#nav a:not(.btn)").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+id));
const secIO=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)setActive(e.target.id)})},{rootMargin:"-45% 0px -50% 0px"});
navMap.forEach(id=>{const el=document.getElementById(id);if(el)secIO.observe(el)});
const rIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");rIO.unobserve(e.target)}}),{threshold:.12});
$$(".reveal").forEach(el=>rIO.observe(el));
new IntersectionObserver((es,o)=>{if(es[0].isIntersecting){$("#processRow").classList.add("in");o.disconnect()}},{threshold:.4}).observe($("#processRow"));
new IntersectionObserver((es,o)=>{if(es[0].isIntersecting){$$(".stat-num").forEach(el=>{if(el.dataset.n)countUp(el)});o.disconnect()}},{threshold:.5}).observe($("#stats"));
$$(".acc-btn").forEach(b=>b.onclick=()=>{const it=b.closest(".acc-item"),o=!it.classList.contains("open");it.classList.toggle("open",o);b.setAttribute("aria-expanded",o)});
requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add("loaded")));


})();
