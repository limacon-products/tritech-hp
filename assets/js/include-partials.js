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
    cache[name] = fetch('/_partials/' + name + '.html')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .catch(e => { console.warn('[partials] fetch failed:', name, e); return ''; });
    return cache[name];
  }

  /* カレントページに該当する nav リンクに class="cur" を自動付与
     - クリーンURL対応: /about-detail/ のようなディレクトリ URL も
       /about-detail と正規化して比較
     - ハッシュ付きリンクは初期 .cur 対象外 (ページ内アンカー扱い) */
  function normalize(path){
    // index.html の有無、末尾スラッシュの有無を吸収して比較キーに揃える
    let p = path.split('?')[0].split('#')[0];
    p = p.replace(/index\.html$/, '');           // /about-detail/index.html → /about-detail/
    p = p.replace(/\.html$/, '');                 // /about-detail.html       → /about-detail (旧URL互換)
    p = p.replace(/\/$/, '');                     // /about-detail/           → /about-detail
    if (p === '') p = '/';
    return p;
  }
  function markCurrent(root){
    const here = normalize(location.pathname);
    root.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      const [file, hash] = href.split('#');
      if (file === undefined || file === null) return;
      const linkPath = normalize(file);
      if (linkPath !== here) return;
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
