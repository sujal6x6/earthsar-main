(function(){
  let nextId=0;
  window.setupReviewPreviews=function(grid){
    if(grid.reviewPreviewObserver)grid.reviewPreviewObserver.disconnect();
    const observer=new ResizeObserver(()=>{
      grid.querySelectorAll('.review-copy').forEach(copy=>{
        const button=copy.nextElementSibling;
        button.hidden=!copy.classList.contains('is-expanded')&&copy.scrollHeight<=copy.clientHeight+1;
      });
    });
    grid.reviewPreviewObserver=observer;
    grid.querySelectorAll('.review-copy').forEach(copy=>{
      copy.id='review-copy-'+(++nextId);
      const button=document.createElement('button');
      button.type='button';
      button.className='review-toggle';
      button.textContent='Read more';
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-controls',copy.id);
      button.onclick=()=>{
        const expanded=copy.classList.toggle('is-expanded');
        button.setAttribute('aria-expanded',String(expanded));
        button.textContent=expanded?'Read less':'Read more';
      };
      copy.after(button);
      observer.observe(copy);
    });
  };
})();
