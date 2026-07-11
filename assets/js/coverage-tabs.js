/* ════════════════════════════════════════════
   service-ses / service-quality / service-dx の対応領域タブ
   ・PC: マウスホバーで切替
   ・モバイル/タッチ: タップで切替
   ・キーボード: Tab でフォーカス → ←→↑↓/Home/End で移動+切替、
     Enter/Space で選択 (WAI-ARIA タブパターン・ロービングtabindex)
   ・data-coverage-tabs 属性を持つ section 内で動作
   ════════════════════════════════════════════ */
(function(){
  'use strict';

  const sections=document.querySelectorAll('[data-coverage-tabs]');
  if(!sections.length)return;

  /* タッチデバイス判定 (ホバーが効かないデバイス) */
  const isTouch=window.matchMedia('(hover:none)').matches||'ontouchstart' in window;

  sections.forEach(sec=>{
    const tags=[...sec.querySelectorAll('.sd-tag[data-tab]')];
    const imgs=sec.querySelectorAll('.sd-cov-img[data-tab]');
    const descs=sec.querySelectorAll('.sd-coverage-desc[data-tab]');
    if(!tags.length)return;

    /* ── ARIA: タブUIであることを支援技術に伝える ── */
    const tablist=tags[0].parentElement;
    if(tablist)tablist.setAttribute('role','tablist');
    tags.forEach(t=>{
      const on=t.classList.contains('is-active');
      t.setAttribute('role','tab');
      t.setAttribute('aria-selected',on?'true':'false');
      t.setAttribute('tabindex',on?'0':'-1');
    });

    function activate(key,focus){
      tags.forEach(t=>{
        const on=t.dataset.tab===key;
        t.classList.toggle('is-active',on);
        t.setAttribute('aria-selected',on?'true':'false');
        t.setAttribute('tabindex',on?'0':'-1');
        if(on&&focus)t.focus();
      });
      imgs.forEach(i=>i.classList.toggle('is-active',i.dataset.tab===key));
      descs.forEach(d=>d.classList.toggle('is-active',d.dataset.tab===key));
    }

    tags.forEach((tag,i)=>{
      const key=tag.dataset.tab;
      /* タップ/クリックは常に有効 */
      tag.addEventListener('click',()=>activate(key));
      /* ホバーはタッチデバイスでは無効 */
      if(!isTouch){
        tag.addEventListener('mouseenter',()=>activate(key));
      }
      /* キーボード操作 */
      tag.addEventListener('keydown',e=>{
        let to=null;
        if(e.key==='ArrowRight'||e.key==='ArrowDown')to=(i+1)%tags.length;
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp')to=(i-1+tags.length)%tags.length;
        else if(e.key==='Home')to=0;
        else if(e.key==='End')to=tags.length-1;
        else if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(key);return;}
        if(to!==null){e.preventDefault();activate(tags[to].dataset.tab,true);}
      });
    });
  });
})();
