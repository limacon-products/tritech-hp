/* ════════════════════════════════════════════
   index.html の CONTACT セクション (#contact) を
   各 service ページ末尾に動的に注入する
   <div data-embed="contact"></div> マーカーを
   置いた箇所に挿入する。

   ※デザイン (.cta-sec .s-chip .s-title .s-sub
     .cta-btns .btn-ghost .btn-next-stage 等) は
     index.css に定義済み。service ページでも
     index.css を読み込む必要がある。
   ════════════════════════════════════════════ */
(function(){
  'use strict';

  const slots = document.querySelectorAll('[data-embed="contact"]');
  if(!slots.length) return;

  fetch('/',{cache:'no-store'})
    .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})
    .then(html=>{
      const doc=new DOMParser().parseFromString(html,'text/html');
      const section=doc.querySelector('#contact');
      if(!section){console.warn('[contact-embed] #contact not found');return;}
      slots.forEach(slot=>{
        const clone=section.cloneNode(true);
        slot.replaceWith(clone);
      });
      /* reveal アニメ用の IntersectionObserver を再アタッチ */
      const reveals=document.querySelectorAll('#contact .reveal');
      if(reveals.length){
        const io=new IntersectionObserver(es=>{
          es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
        },{threshold:.12});
        reveals.forEach(el=>io.observe(el));
      }
    })
    .catch(e=>console.warn('[contact-embed] failed:',e));
})();
