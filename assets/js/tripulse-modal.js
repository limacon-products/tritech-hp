/* ════════════════════════════════════════════
   tripulse-modal.js — TriPulse 紹介動画のポップアップ

   使い方: リンクやボタンに data-tripulse-video を付けるだけ。
     <a href="/tripulse/" data-tripulse-video>TriPulse を 80 秒で見る</a>
   - JS 無効時・<dialog> 非対応ブラウザでは href (/tripulse/) へ遷移する
   - モーダルの DOM は初回クリック時に生成する (各ページに HTML を書かない
     = ダブルメンテ防止。動画ファイルも初回クリックまで読み込まない)
   - 閉じる: × ボタン / Esc / 背景クリック。閉じたら停止して先頭へ戻す
   - スタイルは assets/css/tripulse.css の .tp-modal
   ════════════════════════════════════════════ */
(function(){
'use strict';

const VIDEO_BASE='/assets/video/tripulse-intro';
const POSTER='/assets/images/tripulse/tripulse-intro-poster.jpg';

let dlg=null,video=null,lastFocus=null;

function build(){
  dlg=document.createElement('dialog');
  dlg.className='tp-modal';
  dlg.setAttribute('aria-label','TriPulse 紹介動画');
  dlg.innerHTML=
    '<div class="tp-modal-bar">'+
      '<span class="tp-modal-title">TriPulse 紹介動画（80 秒）</span>'+
      '<button type="button" class="tp-modal-close" aria-label="閉じる">×</button>'+
    '</div>'+
    '<video class="tp-modal-video" controls playsinline preload="metadata" poster="'+POSTER+'">'+
      '<source src="'+VIDEO_BASE+'.webm" type="video/webm">'+
      '<source src="'+VIDEO_BASE+'.mp4" type="video/mp4">'+
    '</video>'+
    '<div class="tp-modal-foot">'+
      '<span>BGM が流れます（ナレーションなし・字幕つき）</span>'+
      '<a class="tp-more on-dark" href="/tripulse/">TriPulse について詳しく見る →</a>'+
    '</div>';
  document.body.appendChild(dlg);
  video=dlg.querySelector('video');

  dlg.querySelector('.tp-modal-close').addEventListener('click',()=>dlg.close());
  /* 背景 (::backdrop) のクリックは dialog 自身が target になる */
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
  /* Esc・× ・背景クリックのどれで閉じても close イベントに集約される */
  dlg.addEventListener('close',()=>{
    video.pause();
    try{video.currentTime=0}catch(_){}
    document.body.style.overflow='';
    if(lastFocus&&lastFocus.focus)lastFocus.focus();
  });
}

function open(trigger){
  if(!dlg)build();
  if(dlg.open)return;
  lastFocus=trigger;
  document.body.style.overflow='hidden';
  dlg.showModal();
  /* クリック起点なので音ありで再生できる。動きを減らす設定の人には自動再生しない */
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    const p=video.play();
    if(p&&p.catch)p.catch(()=>{}); /* 再生を拒否されたら controls で手動再生 */
  }
}

/* 委譲で拾うので、後から注入される要素 (partials / ミラー) にも効く */
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-tripulse-video]');
  if(!t)return;
  if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return; /* 新規タブ等は通常遷移 */
  if(typeof HTMLDialogElement==='undefined')return; /* 非対応: href へ遷移 */
  e.preventDefault();
  open(t);
});
})();
