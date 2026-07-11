/* ==========================================================
   index.js — トップページ固有スクリプト
     - スクロールプログレス / カスタムカーソル
     - reveal IntersectionObserver
     - カウンターアニメーション / カード3Dチルト
     - Canvas チャート（棒グラフ・ドーナツ）
     - ハンバーガーメニュー
     - 会社概要+アクセス を about-detail.html から fetch+inject（ダブルメンテ回避）
   ========================================================== */

/* ── 会社概要・アクセスのミラー注入 ──
   data-source="about-detail.html#sec-overview" などを持つ要素を探索し、
   about-detail.html を fetch、対象セクションの内容を移植する。
   - host の id を sec の id に書き換え、innerHTML を移植
   - これにより <style> 内の #sec-overview スコープセレクタが正しく適用される
   - <style> タグも innerHTML 経由で追加されると自動的にスタイル適用される */
function mirrorCompanyInfoSections(){
  const targets=[...document.querySelectorAll('[data-source]')];
  if(!targets.length)return Promise.resolve();
  const cache={};
  function fetchDoc(url){
    if(cache[url])return cache[url];
    cache[url]=fetch(url)
      .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text()})
      .then(html=>new DOMParser().parseFromString(html,'text/html'))
      .catch(e=>{console.warn('[mirror] fetch failed:',url,e);return null});
    return cache[url];
  }
  return Promise.all(targets.map(host=>{
    const src=host.getAttribute('data-source')||'';
    const [url,frag]=src.split('#');
    if(!url||!frag){console.warn('[mirror] invalid data-source:',src);return null}
    return fetchDoc(url).then(doc=>{
      if(!doc){console.warn('[mirror] no doc for',url);return}
      const sec=doc.querySelector('#'+frag);
      if(!sec){console.warn('[mirror] section not found in fetched doc:','#'+frag);return}
      try{
        host.id=sec.id;
        if(sec.className)host.className=sec.className;
        host.innerHTML=sec.innerHTML;
        const newReveals=host.querySelectorAll('.reveal,.reveal-left,.reveal-right,.s-title');
        if(typeof io!=='undefined'&&io&&io.observe){
          newReveals.forEach(el=>io.observe(el));
        } else {
          newReveals.forEach(el=>el.classList.add('in'));
        }
      }catch(e){
        console.error('[mirror] inject error:',e);
      }
    });
  }));
}

/* mirror 注入後に URL ハッシュへ再スクロール
   理由: ci-mirror セクションが後から fetch+inject されると
   ターゲット要素 (#transition-zone 等) の位置が下にズレる。
   別ページから index.html#transition-zone で来た場合、ブラウザは
   注入前の位置にスクロール済み → ズレが残る。注入後に再スクロール
   して正しい位置に補正する。 */
function rescrollToHash(){
  const hash=location.hash;
  if(!hash||hash.length<2)return;
  const target=document.querySelector(hash);
  if(!target)return;
  // requestAnimationFrame で次フレームに（レイアウト確定後）
  requestAnimationFrame(()=>{
    target.scrollIntoView({behavior:'auto',block:'start'});
  });
}

function initMirrorAndScroll(){
  const p=mirrorCompanyInfoSections();
  if(p&&p.then){
    p.then(rescrollToHash);
  }
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initMirrorAndScroll);
} else {
  initMirrorAndScroll();
}

/* スクロールプログレスバー / カスタムカーソル / ハンバーガーメニュー /
   .reveal IntersectionObserver は common.js（partials:loaded 待ち）に集約。
   index 固有の処理だけここに残す。 */

/* ─── Intersection Observer（reveal + s-title + ns-item） ──
   注: common.js も同名の io を持つが、index 固有の .ns-item を含めるため
   ここでも一部要素を観察する。同じ要素が二重に observe されても
   in クラスが付くだけで実害なし。 */
const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.s-title,.ns-item').forEach(el=>io.observe(el));

/* ─── カウンターアニメーション ─── */
function animCount(id,target,dec=0){
  const el=document.getElementById(id);if(!el)return;
  let start=null;const dur=1800;
  const step=ts=>{
    if(!start)start=ts;
    const p=Math.min((ts-start)/dur,1),ease=1-Math.pow(1-p,4);
    el.textContent=dec?(ease*target).toFixed(dec):Math.floor(ease*target);
    if(p<1)requestAnimationFrame(step);
    else el.textContent=dec?target.toFixed(dec):target;
  };
  requestAnimationFrame(step);
}
const sIo=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){animCount('n-eng',2400);animCount('n-rate',98);animCount('n-cli',120);animCount('n-score',8);sIo.disconnect()}})},{threshold:.3});
const sEl=document.querySelector('.numbers-strip');if(sEl)sIo.observe(sEl);

const oIo=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){animCount('ov-eng',2400);animCount('ov-cli',120);animCount('ov-rate',98);animCount('ov-score',8);oIo.disconnect()}})},{threshold:.3});
const oEl=document.querySelector('.ov-panel');if(oEl)oIo.observe(oEl);

/* ─── カード3Dチルト ─── */
function addTilt(sel,deg=6){
  document.querySelectorAll(sel).forEach(card=>{
    card.addEventListener('mousemove',e=>{
      const r=card.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5;
      const y=(e.clientY-r.top)/r.height-.5;
      card.style.transform=`perspective(700px) rotateX(${-y*deg}deg) rotateY(${x*deg}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave',()=>{card.style.transform=''});
  });
}
addTilt('.vc',5);
addTilt('.mc',4);
addTilt('.member-card',5);

/* ─── 磁石ボタン（body 直下の CTA のみ。nav 内ボタンは common.js が処理） ─── */
function bindMagnet(){
  document.querySelectorAll('.btn-fill,.btn-orange,.btn-stroke,.nav-recruit').forEach(btn=>{
    if(btn._magnetBound)return;btn._magnetBound=true;
    btn.addEventListener('mousemove',e=>{
      const r=btn.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)*.22;
      const y=(e.clientY-r.top-r.height/2)*.22;
      btn.style.transform=`translate(${x}px,${y}px)`;
    });
    btn.addEventListener('mouseleave',()=>{btn.style.transform=''});
  });
}
bindMagnet();
document.addEventListener('partials:loaded',bindMagnet);

/* ハンバーガーメニュー開閉は common.js 側で処理 */

/* ─── スムーズスクロール ─── */
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const t=document.querySelector(a.getAttribute('href'));if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'})}}));

/* ═══ DATA SECTION: カウントアップ + グラフ ═══ */
(function(){
  function countUp(el,target,dur){
    let start=null;
    const step=ts=>{
      if(!start)start=ts;
      const p=Math.min((ts-start)/dur,1);
      const ease=1-Math.pow(1-p,3);
      el.textContent=Math.floor(ease*target);
      if(p<1)requestAnimationFrame(step);
      else el.textContent=target;
    };
    requestAnimationFrame(step);
  }

  const countEls=document.querySelectorAll('.data-sec .cnum');
  if(countEls.length){
    const cIo=new IntersectionObserver(es=>{
      es.forEach(e=>{
        if(!e.isIntersecting)return;
        countEls.forEach(el=>countUp(el,+el.dataset.target,2000));
        cIo.disconnect();
      });
    },{threshold:.3});
    const dg=document.querySelector('.data-sec .data-grid');
    if(dg)cIo.observe(dg);
  }

  function setupDPR(canvas){
    const dpr=window.devicePixelRatio||1;
    const r=canvas.getBoundingClientRect();
    if(r.width<=0||r.height<=0)return false;
    canvas.width=Math.round(r.width*dpr);
    canvas.height=Math.round(r.height*dpr);
    canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
    return true;
  }

  /* チャートデータは assets/data/stats.json が唯一の真実
     (recruit ページも同じ JSON を参照 — ダブルメンテ防止) */
  let barData=[],donutData=[];

  function drawBar(canvas,progressInput){
    const ctx=canvas.getContext('2d');
    const r=canvas.getBoundingClientRect();
    const W=r.width,H=r.height;
    ctx.clearRect(0,0,W,H);
    const progresses=Array.isArray(progressInput)?progressInput:barData.map(()=>progressInput);
    const max=40;
    const pL=44,pR=20,pT=26,pB=36;
    const cW=W-pL-pR,cH=H-pT-pB;
    ctx.strokeStyle='rgba(0,0,0,.08)';ctx.lineWidth=1;
    ctx.font='10px "Noto Sans JP",sans-serif';
    ctx.fillStyle='#888888';
    ctx.textAlign='right';ctx.textBaseline='middle';
    for(let i=0;i<=4;i++){
      const y=pT+cH*(i/4);
      ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
      ctx.fillText(String(Math.round(max-max*(i/4))),pL-8,y);
    }
    const slot=cW/barData.length;
    const bW=slot*.5;
    barData.forEach((d,i)=>{
      const bp=progresses[i];
      const fH=cH*(d.v/max);
      const h=fH*bp;
      const x=pL+slot*i+(slot-bW)/2;
      const by=pT+cH-h;
      ctx.fillStyle='#00ffcc';
      ctx.shadowColor='rgba(0,200,160,.35)';ctx.shadowBlur=8;
      ctx.fillRect(x,by,bW,h);
      ctx.shadowBlur=0;
      if(bp>.88){
        ctx.globalAlpha=Math.min(1,(bp-.88)/.12);
        ctx.font='bold 13px "Syne",sans-serif';
        ctx.fillStyle='#111111';
        ctx.textAlign='center';ctx.textBaseline='bottom';
        ctx.fillText(d.v+'名'+(d.note?'（'+d.note+'）':''),x+bW/2,by-6);
        ctx.globalAlpha=1;
      }
      ctx.font='11px "Noto Sans JP",sans-serif';
      ctx.fillStyle='#888888';
      ctx.textAlign='center';ctx.textBaseline='top';
      ctx.fillText(d.y,x+bW/2,pT+cH+8);
    });
  }

  function animateBar(canvas){
    const stagger=180,barDur=900;
    const totalDur=barDur+stagger*(barData.length-1);
    let start=null;
    const step=ts=>{
      if(!start)start=ts;
      const elapsed=ts-start;
      const progresses=barData.map((_,i)=>{
        const be=elapsed-i*stagger;
        if(be<=0)return 0;
        const p=Math.min(be/barDur,1);
        return 1-Math.pow(1-p,3);
      });
      drawBar(canvas,progresses);
      if(elapsed<totalDur)requestAnimationFrame(step);
      else drawBar(canvas,1);
    };
    requestAnimationFrame(step);
  }

  function drawDonut(canvas,progress){
    const ctx=canvas.getContext('2d');
    const r=canvas.getBoundingClientRect();
    const W=r.width,H=r.height;
    ctx.clearRect(0,0,W,H);
    const data=donutData;
    const cx=W/2,cy=H/2;
    const oR=Math.min(W,H)*.44;
    const iR=oR*.62;
    const startAng=-Math.PI/2;
    const sweep=Math.PI*2*progress;
    let covered=0;
    data.forEach(d=>{
      const ang=(d.v/100)*Math.PI*2;
      const s=startAng+covered;
      const e=Math.min(startAng+covered+ang,startAng+sweep);
      if(e>s){
        ctx.beginPath();
        ctx.arc(cx,cy,oR,s,e);
        ctx.arc(cx,cy,iR,e,s,true);
        ctx.closePath();
        ctx.fillStyle=d.c;
        ctx.fill();
      }
      covered+=ang;
    });
    if(progress>.80){
      ctx.globalAlpha=Math.min(1,(progress-.80)/.20);
      ctx.font='bold 22px "Syne",sans-serif';
      ctx.fillStyle='#111111';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('100%',cx,cy-4);
      ctx.font='10px "Noto Sans JP",sans-serif';
      ctx.fillStyle='#888888';
      ctx.fillText('Skills',cx,cy+16);
      ctx.globalAlpha=1;
    }
  }

  function animateLegendCounts(){
    const lnums=document.querySelectorAll('.data-sec .donut-legend .lnum');
    lnums.forEach(el=>countUp(el,+el.dataset.target,800));
  }

  function animateDonut(canvas){
    const dur=1500;let start=null,fired=false;
    const step=ts=>{
      if(!start)start=ts;
      const p=Math.min((ts-start)/dur,1);
      drawDonut(canvas,1-Math.pow(1-p,3));
      if(p<1)requestAnimationFrame(step);
      else if(!fired){fired=true;animateLegendCounts();}
    };
    requestAnimationFrame(step);
  }

  function initChart(id,drawFn,animateFn){
    const cv=document.getElementById(id);
    if(!cv)return;
    requestAnimationFrame(()=>setupDPR(cv));
    const io=new IntersectionObserver(es=>{
      es.forEach(e=>{
        if(e.isIntersecting){
          if(setupDPR(cv))animateFn(cv);
          io.disconnect();
        }
      });
    },{threshold:.3});
    io.observe(cv);
    let rT=null;
    window.addEventListener('resize',()=>{
      clearTimeout(rT);
      rT=setTimeout(()=>{if(setupDPR(cv))drawFn(cv,1)},150);
    });
  }

  /* 凡例も stats.json から生成 (fetch 失敗時は index.html の静的凡例が残る) */
  function renderLegend(skills){
    const box=document.querySelector('.data-sec .donut-legend');
    if(!box||!skills.length)return;
    box.innerHTML=skills.map(s=>
      `<div class="legend-item"><span class="legend-dot" style="background:${s.color}"></span><span class="legend-label">${s.label}</span><span class="legend-value"><span class="lnum" data-target="${s.value}">0</span>%</span></div>`
    ).join('');
  }

  fetch('/assets/data/stats.json')
    .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(j=>{
      barData=j.employees||[];
      donutData=(j.skills||[]).map(s=>({v:s.value,c:s.color}));
      renderLegend(j.skills||[]);
      initChart('chart-bar',drawBar,animateBar);
      initChart('chart-donut',drawDonut,animateDonut);
    })
    .catch(e=>console.warn('[stats] stats.json の読み込みに失敗:',e));
})();

/* ═══════════════════════════════════════════════════════
   スクロール監視: トランジションゾーンに入ったら body に
   .recruit-mode を付与 → ナビが暗テーマ（緑）に自動切替
   トランジションゾーンの下端がビューポート中央に達したら
   .rm-hero-show を付与 → recruit ヒーローのフェードイン
   さらに recruit-mode 中はナビの「ホーム」と「エンジニアの方へ」の
   .cur 状態を入れ替える（recruit エリアに居ることを示す）
   ═══════════════════════════════════════════════════════ */
(function(){
  const tz=document.getElementById('transition-zone');
  if(!tz)return;
  const NAV_OFFSET=68; // 実 nav 高さ

  function swapNavCur(inRecruit){
    // PC ナビ + モバイルメニューの両方が対象
    document.querySelectorAll('nav .nav-links a,.mobile-menu a').forEach(a=>{
      const nav=a.getAttribute('data-nav');
      if(nav==='home'){a.classList.toggle('cur',!inRecruit)}
      else if(nav==='for-engineers'){a.classList.toggle('cur',inRecruit)}
    });
  }

  function check(){
    const r=tz.getBoundingClientRect();
    const inRecruit=r.top<=NAV_OFFSET+20;
    document.body.classList.toggle('recruit-mode',inRecruit);
    document.body.classList.toggle('rm-hero-show',r.bottom<=window.innerHeight/2);
    swapNavCur(inRecruit);
  }
  // partial 注入後に nav が現れるので、partials:loaded を待ってからも一度実行
  window.addEventListener('scroll',check,{passive:true});
  window.addEventListener('resize',check);
  document.addEventListener('partials:loaded',check);
  check();
})();

/* ═══════════════════════════════════════════════════════
   VOICE モーダル: 社員の声カード → モーダル開閉
   recruit-detail.html から index.html に統合したため、
   iframe / postMessage は不要。普通の DOM で完結する。
   ═══════════════════════════════════════════════════════ */
/* 社員の声データは assets/data/voices.json が唯一の真実。
   人の追加・入れ替え・削除は voices.json の members 配列の編集だけで完結する
   (下のコードがカードを自動生成し、recruit ページも同じ JSON を参照する)。
   編集手順は assets/data/README.md を参照 */
let VOICE_DATA={},AVATARS={};
const VOICES_READY=fetch('/assets/data/voices.json')
  .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
  .then(j=>{
    (j.members||[]).forEach(m=>{
      VOICE_DATA[m.id]={name:m.name||'',initial:m.initial||'',avatar:m.id,role:m.role||'',chapters:m.chapters||[]};
      AVATARS[m.id]=m.avatarSvg||'';
    });
    return j.members||[];
  });

/* reveal アニメ：recruit-section 内の .reveal を io で観察
   (voices.json の読込結果に関わらず必ず実行する) */
(function(){
  if(typeof io!=='undefined'&&io&&io.observe){
    document.querySelectorAll('.recruit-section .reveal').forEach(el=>io.observe(el));
  }
})();

VOICES_READY.then(members=>{
  /* カードは voices.json から自動生成 (index.html に静的カードは持たない) */
  const track=document.querySelector('.recruit-section .voice-track');
  if(track&&members.length){
    track.innerHTML=members.map(m=>
      '<div class="voice-card" data-member="'+m.id+'">'
      +'<div class="voice-svg">'+(m.avatarSvg||'')+'</div>'
      +'<div class="voice-avatar">'+(m.initial||'')+'</div>'
      +'<div class="voice-role">'+(m.role||'')+'</div>'
      +'<div class="voice-catch">'+(m.catch||'')+'</div>'
      +'</div>').join('');
    /* 無限ループ用：カードを複製して2周分にする */
    [...track.children].forEach(c=>track.appendChild(c.cloneNode(true)));
  }
  const cards=document.querySelectorAll('.recruit-section .voice-card[data-member]');
  const modal=document.getElementById('voice-modal');
  if(!modal||!cards.length)return;
  const modalAvatar=document.getElementById('voice-modal-avatar');
  const modalSvg=document.getElementById('voice-modal-svg');
  const modalName=document.getElementById('voice-modal-name');
  const modalRole=document.getElementById('voice-modal-role');
  const modalChapters=document.getElementById('voice-modal-chapters');
  const closeBtn=document.getElementById('voice-modal-close');

  function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

  function openVoiceModal(member){
    const d=VOICE_DATA[member];
    if(!d)return;
    modalAvatar.textContent=d.initial;
    if(modalSvg)modalSvg.innerHTML=AVATARS[d.avatar||member]||'';
    modalName.textContent=d.name;
    modalRole.textContent=d.role;
    modalChapters.innerHTML=d.chapters.map((ch,i)=>{
      const paras=ch.body.split(/\n{2,}/).map(p=>'<p>'+escapeHtml(p).replace(/\n/g,'<br>')+'</p>').join('');
      return '<div class="voice-chapter'+(i===0?' open':'')+'">'
        +'<div class="voice-chapter-title"><span>'+(i+1)+'. '+escapeHtml(ch.title)+'</span><span class="voice-chapter-icon">▼</span></div>'
        +'<div class="voice-chapter-body"><div class="voice-chapter-content">'+paras+'</div></div>'
        +'</div>';
    }).join('');
    modalChapters.querySelectorAll('.voice-chapter-title').forEach(t=>{
      t.addEventListener('click',()=>t.parentElement.classList.toggle('open'));
    });
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    // 別の社員を開いた時、前回のスクロール位置を引き継がないよう先頭にリセット
    modal.scrollTop=0;
    const mBody=modal.querySelector('.voice-modal-body');
    if(mBody)mBody.scrollTop=0;
  }
  function closeVoiceModal(){
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }
  cards.forEach(c=>c.addEventListener('click',()=>openVoiceModal(c.dataset.member)));
  closeBtn.addEventListener('click',closeVoiceModal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeVoiceModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeVoiceModal()});
}).catch(e=>console.warn('[voices] voices.json の読み込みに失敗:',e));

/* ── HERO 背景アニメーション (Geometric Motion)
      流れる小菱形を3行ぶんSVGで生成 ── */
(function(){
  const stream=document.getElementById('hero-bg-stream');
  if(!stream)return;
  const colors=['#E07830','#44AADB','#2A5A9A','#C8521A','#2888B8','#1A3A6A'];
  const sizes=[16,22,18,24,14,20];
  const rows=['r1','r2','r3'];
  rows.forEach(rowCls=>{
    const row=document.createElement('div');
    row.className='stream-row '+rowCls;
    const html=Array.from({length:60},()=>{
      const c=colors[Math.floor(Math.random()*colors.length)];
      const s=sizes[Math.floor(Math.random()*sizes.length)];
      const op=(.4+Math.random()*.4).toFixed(2);
      return `<svg width="${s}" height="${s}" viewBox="0 0 100 100"><polygon points="50,5 95,50 50,95 5,50" fill="${c}" opacity="${op}"/></svg>`;
    }).join('');
    row.innerHTML=html;
    stream.appendChild(row);
  });
})();
