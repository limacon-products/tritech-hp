/* ════════════════════════════════════════════
   game-loader.js — 隠しゲームの遅延ローダー
   ロゴ (#nav-logo-game-btn) クリック時に初めて
   game.css / ゲーム用DOM / game.js (約2,700行) を動的ロードする。
   これにより通常閲覧時のページからゲーム関連の
   転送・パース・実行コストを完全に排除する。

   起動フロー:
     1回目クリック → 本スクリプトが CSS/DOM/JS を注入
                    → game.js 末尾の _gameAutoOpen フックで自動起動
     2回目以降     → game.js 自身のリスナーが直接起動
   ════════════════════════════════════════════ */
(function(){
'use strict';

const OVERLAY_HTML=
  '<div id="game-overlay">'+
    '<canvas id="game-canvas"></canvas>'+
    '<div id="ghud">'+
      '<span>SCORE <span id="gs">000000</span></span>'+
      '<span class="gst" id="gstg">STAGE 1</span>'+
      '<span class="ghi">HI <span id="gh">999999</span></span>'+
      '<span>SHIP <span id="gl">♦ ♦ ♦</span></span>'+
    '</div>'+
    '<div id="gesc">[ ESC ] 終了</div>'+
  '</div>';

let loading=false;

function loadCss(){
  return new Promise(res=>{
    if(document.getElementById('game-css')){res();return}
    const l=document.createElement('link');
    l.id='game-css';l.rel='stylesheet';l.href='/assets/css/game.css';
    l.onload=res;l.onerror=res; /* CSS失敗でもゲーム自体は起動させる */
    document.head.appendChild(l);
  });
}

function loadGame(){
  return new Promise((res,rej)=>{
    if(document.getElementById('game-js')){res();return}
    if(!document.getElementById('game-overlay')){
      document.body.insertAdjacentHTML('beforeend',OVERLAY_HTML);
    }
    const s=document.createElement('script');
    s.id='game-js';s.src='/assets/js/game.js';
    s.onload=res;s.onerror=()=>rej(new Error('game.js load failed'));
    document.body.appendChild(s);
  });
}

function launch(){
  if(loading)return;
  if(document.getElementById('game-js'))return; /* ロード済み: game.js側のリスナーが起動を担当 */
  loading=true;
  window._gameAutoOpen=true; /* game.js がロード完了時に自動で openGame() する */
  loadCss().then(loadGame).catch(e=>{
    console.warn('[game-loader]',e);
    window._gameAutoOpen=false;
    loading=false;
  });
}

function bind(){
  const nl=document.querySelector('#nav-logo-game-btn');
  if(nl&&!nl._gameLoaderBound){
    nl._gameLoaderBound=true;
    nl.addEventListener('click',launch);
  }
}
bind();
/* 共通ヘッダーが後から注入されるページでは partials:loaded を待って再バインド */
document.addEventListener('partials:loaded',bind);
})();
