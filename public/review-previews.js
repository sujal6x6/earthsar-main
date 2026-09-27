(function(){
  let nextId=0;
  let popup,previousOverflow;
  function showReview(copy){
    if(!popup){
      popup=document.createElement('dialog');
      popup.className='review-popup';
      popup.id='full-review-popup';
      popup.setAttribute('aria-labelledby','full-review-title');
      popup.innerHTML='<div class="review-popup-head"><h2 id="full-review-title"></h2><button type="button" aria-label="Close full review" autofocus>×</button></div><p class="review-popup-text"></p>';
      document.body.append(popup);
      popup.querySelector('button').onclick=()=>popup.close();
      popup.addEventListener('click',event=>{if(event.target===popup){const rect=popup.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)popup.close()}});
      popup.addEventListener('close',()=>{document.body.style.overflow=previousOverflow});
    }
    const card=copy.closest('.rev,.review-page-card');
    popup.querySelector('h2').textContent=card.querySelector('.rev-name,h3').textContent+' — Full review';
    popup.querySelector('.review-popup-text').textContent=copy.textContent;
    previousOverflow=document.body.style.overflow;
    popup.showModal();
    popup.scrollTop=0;
    document.body.style.overflow='hidden';
  }
  window.setupReviewPreviews=function(grid){
    if(grid.reviewPreviewObserver)grid.reviewPreviewObserver.disconnect();
    const observer=new ResizeObserver(()=>{
      grid.querySelectorAll('.review-copy').forEach(copy=>{
        const button=copy.nextElementSibling;
        button.hidden=copy.scrollHeight<=copy.clientHeight+1;
      });
    });
    grid.reviewPreviewObserver=observer;
    grid.querySelectorAll('.review-copy').forEach(copy=>{
      copy.id='review-copy-'+(++nextId);
      const button=document.createElement('button');
      button.type='button';
      button.className='review-toggle';
      button.textContent='Read more';
      button.setAttribute('aria-haspopup','dialog');
      button.onclick=()=>showReview(copy);
      copy.after(button);
      observer.observe(copy);
    });
  };
})();
