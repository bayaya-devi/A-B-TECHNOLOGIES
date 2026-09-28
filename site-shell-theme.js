(()=>{
  const init=()=>{
    const header=document.querySelector('.ab-site-header');
    if(!header)return;
    const media=matchMedia('(prefers-color-scheme: dark)');
    const applyTheme=choice=>{
      const safe=['light','dark'].includes(choice)?choice:'auto';
      const resolved=safe==='auto'?(media.matches?'dark':'light'):safe;
      document.documentElement.dataset.theme=resolved;
      document.documentElement.dataset.themeChoice=safe;
      document.documentElement.style.colorScheme=resolved;
      header.querySelectorAll('[data-theme-choice]').forEach(button=>{
        const active=button.dataset.themeChoice===safe;
        button.classList.toggle('active',active);
        button.setAttribute('aria-pressed',String(active));
      });
    };
    applyTheme(localStorage.getItem('ab-theme')||'auto');
    header.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>{
      const choice=button.dataset.themeChoice;
      if(choice==='auto')localStorage.removeItem('ab-theme');else localStorage.setItem('ab-theme',choice);
      applyTheme(choice);
    }));
    header.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>window.ABLanguage?.set(button.dataset.lang)));
    media.addEventListener('change',()=>{if(!localStorage.getItem('ab-theme'))applyTheme('auto')});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
