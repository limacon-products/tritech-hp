/* ==========================================================
   include-partials.js — 共通ヘッダー/フッター注入
     <div data-include="header"></div> → _partials/header.html
     <div data-include="footer"></div> → _partials/footer.html
   注入完了後、document に "partials:loaded" カスタムイベントを発火。
   common.js / index.js / game.js は partials:loaded を待って
   注入要素（nav / hp-progress / hamburger / nav-logo-game-btn 等）に
   バインドする。
   ========================================================== */
(function(){
  'use strict';

  const cache = {};
  function fetchPartial(name){
    if (cache[name]) return cache[name];
    cache[name] = fetch('_partials/' + name + '.html', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .catch(e => { console.warn('[partials] fetch failed:', name, e); return ''; });
    return cache[name];
  }

  /* カレントページに該当する nav リンクに class="cur" を自動付与
     - 同じページを指すリンクが複数ある場合（例: index.html と
       index.html#transition-zone）は「ハッシュ無し」のリンクだけを
       初期 .cur 対象にする（ハッシュ付きはページ内アンカー扱い）
     - ハッシュ付きリンクは index.js のスクロール監視で動的に .cur 付与 */
  function markCurrent(root){
    const here = location.pathname.split('/').pop() || 'index.html';
    root.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      const [file, hash] = href.split('#');
      const linkFile = (file || '').split('/').pop();
      if (!linkFile) return;
      if (linkFile !== here) return;
      // CTA ボタン（採用情報）は色を維持
      if (a.classList.contains('nav-recruit') || a.classList.contains('mob-recruit')) return;
      // ハッシュ付き（ページ内アンカー）は初期 .cur 対象外
      if (hash) return;
      a.classList.add('cur');
    });
  }

  function injectAll(){
    const slots = [...document.querySelectorAll('[data-include]')];
    if (!slots.length) {
      // partial 利用ページではないので即発火
      document.dispatchEvent(new CustomEvent('partials:loaded'));
      return;
    }
    Promise.all(slots.map(slot => {
      const name = slot.getAttribute('data-include');
      return fetchPartial(name).then(html => {
        if (html) {
          slot.outerHTML = html;
        }
      });
    })).then(() => {
      // 注入後の nav に .cur を付ける
      const nav = document.querySelector('nav');
      if (nav) markCurrent(nav);
      const mm = document.getElementById('mobile-menu');
      if (mm) markCurrent(mm);
      document.dispatchEvent(new CustomEvent('partials:loaded'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAll);
  } else {
    injectAll();
  }
})();
