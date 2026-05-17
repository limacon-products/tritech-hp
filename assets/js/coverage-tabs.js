/* ════════════════════════════════════════════
   service-quality / service-dx の対応領域タブ
   ・PC: マウスホバーで切替
   ・モバイル/タッチ: タップで切替
   ・data-coverage-tabs 属性を持つ section 内で動作
   ════════════════════════════════════════════ */
(function(){
  'use strict';

  const sections=document.querySelectorAll('[data-coverage-tabs]');
  if(!sections.length)return;

  /* タッチデバイス判定 (ホバーが効かないデバイス) */
  const isTouch=window.matchMedia('(hover:none)').matches||'ontouchstart' in window;

  sections.forEach(sec=>{
    const tags=sec.querySelectorAll('.sd-tag[data-tab]');
    const imgs=sec.querySelectorAll('.sd-cov-img[data-tab]');
    const descs=sec.querySelectorAll('.sd-coverage-desc[data-tab]');
    if(!tags.length)return;

    function activate(key){
      tags.forEach(t=>t.classList.toggle('is-active',t.dataset.tab===key));
      imgs.forEach(i=>i.classList.toggle('is-active',i.dataset.tab===key));
      descs.forEach(d=>d.classList.toggle('is-active',d.dataset.tab===key));
    }

    tags.forEach(tag=>{
      const key=tag.dataset.tab;
      /* タップ/クリックは常に有効 */
      tag.addEventListener('click',()=>activate(key));
      /* ホバーはタッチデバイスでは無効 */
      if(!isTouch){
        tag.addEventListener('mouseenter',()=>activate(key));
      }
    });
  });
})();
