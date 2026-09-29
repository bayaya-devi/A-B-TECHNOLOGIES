(()=>{
  const ready=()=>{
    const header=document.querySelector('.ab-site-header');
    if(header){
      const toggle=header.querySelector('.ab-menu-toggle'),menu=header.querySelector('.ab-menu-panel');
      const backdrop=document.createElement('div');
      backdrop.className='ab-menu-backdrop';
      document.body.append(backdrop);
      const setMenu=open=>{menu.classList.toggle('is-open',open);backdrop.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open))};
      toggle.addEventListener('click',()=>setMenu(!menu.classList.contains('is-open')));
      header.querySelector('.ab-menu-close').addEventListener('click',()=>setMenu(false));
      backdrop.addEventListener('click',()=>setMenu(false));
      document.addEventListener('keydown',event=>{if(event.key==='Escape')setMenu(false)});
    }
    const footer=document.querySelector('.ab-site-footer');
    document.querySelectorAll('.ab-theme-switcher').forEach(el=>el.remove());
    const reveal=document.querySelectorAll('main section, main article, .trust, .project-row, .audit-shell > *, .shell > *');
    if('IntersectionObserver'in window){
      const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.12});
      reveal.forEach((el,index)=>{el.dataset.abReveal='';el.style.transitionDelay=`${Math.min(index%5,3)*55}ms`;observer.observe(el)});
    }else reveal.forEach(el=>el.classList.add('is-visible'));
    if(document.body.querySelector('.shell,.audit-shell'))document.body.classList.add('ab-form-page');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
