(()=>{
  const ready=()=>{
    const path=location.pathname.toLowerCase();
    const audit=path.includes('demander-audit');
    const config=path.includes('configurateur');
    const home='index.html';
    const oldHeader=document.querySelector('header');
    if(oldHeader){
      const header=document.createElement('header');
      header.className='ab-site-header';
      const cta=(!audit&&!config)?'<a class="ab-primary-cta" href="configurateur.html">Démarrer un projet</a>':'';
      header.innerHTML=`<div class="ab-site-nav">
        <a class="ab-logo-link" href="${home}" aria-label="Accueil A&B Technologies"><img src="assets/ab-technologies-logo.png" alt="A&B Technologies — Créer. Développer. Faire grandir."></a>
        <span class="ab-nav-spacer"></span>${cta}
        <button class="ab-menu-toggle" type="button" aria-label="Ouvrir la navigation" aria-controls="abMenu" aria-expanded="false"><span></span></button>
        <nav id="abMenu" class="ab-menu-panel" aria-label="Navigation principale">
          <div class="ab-menu-heading"><span>Navigation</span><button class="ab-menu-close" type="button" aria-label="Fermer la navigation">×</button></div>
          <a href="${home}#services">Services</a><a href="${home}#process">Process</a><a href="${home}#why">Pourquoi nous</a><a href="${home}#collaborations">Nos projets</a><a href="${home}#contact">Contact</a>
          <i class="ab-menu-divider"></i>
          <div class="ab-menu-section"><span class="ab-menu-label">Langue</span><div class="ab-menu-group" aria-label="Langue"><button type="button" data-lang="fr">Français</button><button type="button" data-lang="en">English</button><button type="button" data-lang="ar">العربية</button></div></div>
          <div class="ab-menu-section"><span class="ab-menu-label">Thème</span><div class="ab-menu-group" aria-label="Thème"><button type="button" data-theme-choice="auto">Auto</button><button type="button" data-theme-choice="light">Clair</button><button type="button" data-theme-choice="dark">Sombre</button></div></div>
        </nav>
      </div>`;
      oldHeader.replaceWith(header);
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
    const oldFooter=document.querySelector('footer');
    const footer=document.createElement('footer');
    footer.className='ab-site-footer';
    footer.innerHTML='<div class="ab-footer-inner"><span>© A&amp;B Technologies — Tous droits réservés.</span><a href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=aetbconseil%40gmail.com" target="_blank" rel="noopener" aria-label="Écrire à A&B Technologies par e-mail">aetbconseil@gmail.com</a><a class="ab-whatsapp" href="https://wa.me/212767722203" target="_blank" rel="noopener" aria-label="Écrire à A&B Technologies sur WhatsApp">+212 767 722 203</a></div>';
    if(oldFooter)oldFooter.replaceWith(footer);else document.body.append(footer);
    document.querySelectorAll('.ab-theme-switcher').forEach(el=>el.remove());
    const reveal=document.querySelectorAll('main section, main article, .trust, .project-row, .audit-shell > *, .shell > *');
    if('IntersectionObserver'in window){
      const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.12});
      reveal.forEach((el,index)=>{el.dataset.abReveal='';el.style.transitionDelay=`${Math.min(index%5,3)*55}ms`;observer.observe(el)});
    }else reveal.forEach(el=>el.classList.add('is-visible'));
    if(config||audit)document.body.classList.add('ab-form-page');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
