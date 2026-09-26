(function(){
  const header=document.querySelector(".page-header");
  const button=document.querySelector(".menu-btn");
  const nav=document.querySelector(".page-links");
  if(!header||!button||!nav)return;
  button.addEventListener("click",()=>{
    const open=header.classList.toggle("open");
    button.setAttribute("aria-expanded",String(open));
  });
  nav.addEventListener("click",event=>{
    if(!event.target.closest("a"))return;
    header.classList.remove("open");
    button.setAttribute("aria-expanded","false");
  });
})();
