/* ==========================================================
   service-detail.js — 事業内容詳細ページ専用
     - .reveal フェードイン
     - 棒グラフ / 円グラフ風バーのアニメーション
     - ハンバーガーメニュー
   ========================================================== */
(function(){
  'use strict';

  /* reveal observer */
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* chart animations: only fire once when the data section enters view */
  let barsAnimated = false;
  const barsObs = new IntersectionObserver(es => {
    if (es[0].isIntersecting && !barsAnimated) {
      barsAnimated = true;
      document.querySelectorAll('#bars .bar').forEach(b => {
        b.style.height = b.dataset.h + 'px';
      });
      document.querySelectorAll('.pie-bar-fill').forEach(b => {
        b.style.width = b.dataset.w + '%';
      });
    }
  }, { threshold: 0.3 });
  const dataSection = document.getElementById('sec-data');
  if (dataSection) barsObs.observe(dataSection);

  /* hamburger */
  const hb = document.getElementById('hamburger');
  const mm = document.getElementById('mobile-menu');
  if (hb && mm) {
    hb.addEventListener('click', () => {
      hb.classList.toggle('open');
      mm.classList.toggle('open');
    });
    mm.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        hb.classList.remove('open');
        mm.classList.remove('open');
      });
    });
  }
})();
