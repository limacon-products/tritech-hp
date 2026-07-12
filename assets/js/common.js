/* ==========================================================
   common.js — Group A 共通スクリプト
   対象: index / about-detail / service-list / service-detail /
         service-ses / service-quality / service-dx
   機能:
     - スクロールプログレスバー & ナビの背景変化
     - カスタムカーソル（ドット + リング追従）
     - IntersectionObserver による .reveal フェードイン
     - ハンバーガーメニュー開閉

   注意:
     ナビ・ハンバーガー・カーソル要素は include-partials.js で
     後から注入されるため、初期化は "partials:loaded" イベント
     発火後に実行する。reveal アニメは body 内の独立要素なので
     DOMContentLoaded で OK。
   ========================================================== */
(function(){
  'use strict';

  /* ── Reveal IntersectionObserver（partial に依存しない） ── */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  function observeReveals(){
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .s-title').forEach(el => io.observe(el));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeReveals);
  } else {
    observeReveals();
  }

  /* ── 注入後初期化（nav/hamburger/cursor/progress 関連） ── */
  function initPartialDependent(){
    /* Scroll progress + nav background toggle */
    const prog = document.getElementById('hp-progress');
    const navEl = document.querySelector('nav');
    if (prog && navEl) {
      window.addEventListener('scroll', () => {
        const st = window.scrollY;
        const total = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.width = (total > 0 ? st / total * 100 : 0) + '%';
        navEl.classList.toggle('hp-scrolled', st > 40);
      }, { passive: true });
    }

    /* Custom cursor: トライテックロゴ統一の3つ菱形 (オレンジ→水色→紺)
       それぞれ異なる追従速度(イージング)で軌跡を作る
       ※タッチ専用端末では追従不可のため起動しない (CSS側で非表示) */
    const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const diamonds = document.querySelectorAll('.hp-diamond');
    if (diamonds.length === 3 && !touchOnly) {
      const items = [];
      const mx = window.innerWidth / 2;
      const my = window.innerHeight / 2;
      /* 先頭(オレンジ)は素早く、後ろ(紺)は遅く追従 */
      const easings = [0.32, 0.18, 0.10];
      diamonds.forEach((el, i) => {
        items.push({ el, x: mx, y: my, ease: easings[i] });
      });
      let tx = mx, ty = my;
      document.addEventListener('mousemove', e => {
        tx = e.clientX;
        ty = e.clientY;
      }, { passive: true });
      (function tick() {
        items.forEach(it => {
          it.x += (tx - it.x) * it.ease;
          it.y += (ty - it.y) * it.ease;
          it.el.style.left = it.x + 'px';
          it.el.style.top  = it.y + 'px';
        });
        requestAnimationFrame(tick);
      })();
    }

    /* タップ菱形バースト: タッチ位置からブランドカラーの菱形3つが
       弾けて消える (タッチ端末での追従カーソルの代替演出)。
       スタイルは common.css の .hp-burst / hp-burst-fly を参照 */
    document.addEventListener('touchstart', e => {
      const t = e.touches[0];
      if (!t) return;
      const b = document.createElement('div');
      b.className = 'hp-burst';
      b.style.left = t.clientX + 'px';
      b.style.top  = t.clientY + 'px';
      /* 3方向 + 少しランダムに散らす */
      [[-16,-24],[20,-14],[-2,22]].forEach(d => {
        const s = document.createElement('span');
        s.style.setProperty('--dx', (d[0] + (Math.random() * 10 - 5)) + 'px');
        s.style.setProperty('--dy', (d[1] + (Math.random() * 10 - 5)) + 'px');
        b.appendChild(s);
      });
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 700);
    }, { passive: true });

    /* Hamburger menu
       スクロールロック時はスクロールバー幅を padding-right で補填する。
       これをしないと vertical scrollbar が消えた瞬間にページ幅が広がり、
       nav の padding:0 5vw が再計算されて nav 内要素（特に右端の
       ハンバーガーボタン）が数px 横にズレる。 */
    const hamburger = document.getElementById('hamburger');
    const mm = document.getElementById('mobile-menu');
    function lockScroll(){
      const sbw = window.innerWidth - document.documentElement.clientWidth;
      if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
      document.body.style.overflow = 'hidden';
    }
    function unlockScroll(){
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    if (hamburger && mm) {
      hamburger.addEventListener('click', () => {
        const open = mm.classList.toggle('open');
        hamburger.classList.toggle('open', open);
        hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) lockScroll(); else unlockScroll();
      });
      document.querySelectorAll('.mobile-menu a').forEach(a => {
        a.addEventListener('click', () => {
          mm.classList.remove('open');
          hamburger.classList.remove('open');
          unlockScroll();
        });
      });
    }
  }

  document.addEventListener('partials:loaded', initPartialDependent);
})();
