(function(){
'use strict';

/* ── AUDIO ── */
let ac=null;
function initAC(){try{if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}
function beep(f,d,t,v){if(!ac)return;try{const o=ac.createOscillator(),g=ac.createGain();o.type=t||'square';o.frequency.value=f;g.gain.setValueAtTime(v||.08,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}
const sShoot=()=>beep(800,.06,'square',.07);
const sBoom=()=>{beep(180,.12,'sawtooth',.14);setTimeout(()=>beep(90,.18,'square',.08),30)};
const sHit=()=>beep(400,.05,'square',.05);
const sReveal=()=>beep(660,.1,'sine',.07);
const sClear=()=>[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.1,'sine',.09),i*70));
const sEnd=()=>[523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>beep(f,.15,'sine',.12),i*100));

/* ── CANVAS ── */
const OV=document.getElementById('game-overlay');
const CV=document.getElementById('game-canvas');
const c=CV.getContext('2d');
const HUD=document.getElementById('ghud');

/* 仮想キャンバス: ゲーム描画は常に固定解像度(1280x720)で行い、
   表示は CSS でアスペクト比を保ったままビューポートにフィットさせる。
   どんな端末でも同じ見た目・同じフォントサイズを実現する。 */
const VIRTUAL_W=1280, VIRTUAL_H=720;
let W=VIRTUAL_W,H=VIRTUAL_H;     // ゲーム内部座標（常に固定）
let scaleX=1,scaleY=1;            // 表示→仮想 変換倍率（マウス/タッチ座標補正用）
let _lastCssW=0,_lastCssH=0;      // CSS書き込みの最適化用

function resize(){
  // 内部解像度は常に固定（フォントもレイアウトも安定）
  if(CV.width!==VIRTUAL_W){CV.width=VIRTUAL_W;gridDirty=true}
  if(CV.height!==VIRTUAL_H){CV.height=VIRTUAL_H;gridDirty=true}
  W=VIRTUAL_W;H=VIRTUAL_H;
  // CSS サイズはアスペクト比を保ってビューポートにフィット（レターボックス）
  const vw=OV.clientWidth||window.innerWidth;
  const vh=OV.clientHeight||window.innerHeight;
  if(!vw||!vh)return;
  const aspectVirtual=VIRTUAL_W/VIRTUAL_H;
  const aspectView=vw/vh;
  let cssW,cssH;
  if(aspectView>aspectVirtual){
    // 横が広い → 高さフィット、左右に黒帯
    cssH=vh; cssW=vh*aspectVirtual;
  } else {
    // 縦が長い → 幅フィット、上下に黒帯
    cssW=vw; cssH=vw/aspectVirtual;
  }
  // 変化があった時だけ CSS とスケール倍率を更新（layout thrashing 回避）
  if(cssW!==_lastCssW||cssH!==_lastCssH){
    CV.style.width=cssW+'px';
    CV.style.height=cssH+'px';
    _lastCssW=cssW;_lastCssH=cssH;
    scaleX=VIRTUAL_W/cssW;
    scaleY=VIRTUAL_H/cssH;
  }
}

/* ── STATE ── */
let state='idle';
let stageIdx=0,frame=0,score=0,lives=3;
let blk=null;
let clearTimer=0,clearPhase=0,endTimer=0,shakeF=0;
let clearLocked=true;
let bossIntroTimer=0;
let endingBtns=[];
let bonusWords=[],bonusSpawnTimer=0;
// ── ポータル退場アニメーション ──
let portalTimer=0,portalDest=null;
let introTimer=0; // ゲーム開始イントロ
let playerX=400,playerY=500;
const PW=60,PH=60,PS=5;
let bullets=[],parts=[],stars=[],bProj=[];
let keys={},mouseX=null,lastShot=0;
let logoImg=null,logoOK=false;
// CEO 写真（BOSS で表示）
let ceoPhotoImg=null,ceoPhotoOK=false,ceoPhotoLoadingSrc=null;
function loadCeoPhoto(src){
  if(!src)return;
  if(ceoPhotoLoadingSrc===src && ceoPhotoImg)return; // 同じソースは再ロードしない
  ceoPhotoLoadingSrc=src;
  ceoPhotoOK=false;
  const img=new Image();
  img.onload=()=>{ceoPhotoOK=true; ceoPhotoImg=img;};
  img.onerror=()=>{ceoPhotoOK=false; ceoPhotoImg=null;};
  img.src=src;
  ceoPhotoImg=img;
}
// CEO エンディングスクロール
let ceoEndingTimer=0;
let ceoEndingLineCache=null;
// BOSS 撃破時の爆発演出
let bossDefeatTimer=0;
let rafID=0;
// death / retry / gameover
let dyingTimer=0,deathX=400,deathY=500;
let powerUp=false;
let retryHover=-1;
let retryBtns=[];

/* ══ DOM → GAME CONTENT SYNC ══
   各STAGEのコンテンツは下記の正典ソースから自動取得されます：
     STAGE 1 (Mission)  ← index.html        #about (私たちについて)
     STAGE 2 (Values)   ← about-detail.html #sec-mvv
     STAGE 3 (Reasons)  ← index.html        #sec-reason (5つの理由)
     STAGE 4 (Data)     ← index.html        #data (数字で見るトライテック)
     STAGE 5 (Reward)   ← index.html        #sec-reward (報酬が決まる仕組み)
     BOSS    (CEO)      ← about-detail.html #sec-ceo
   ※ recruit-detail.html は index.html に統合済み（.recruit-section）
   ※ ゲームはどのページからでも起動可能なため、必要な
      ソースHTMLは fetch() で取得・キャッシュします。
      file:// では CORS により fetch が失敗するため、その場合は
      ハードコードのフォールバック値で動作します。 */

let gc={};
const pageDocs={}; // fetch 結果キャッシュ

function fetchPageDoc(url){
  if(pageDocs[url])return Promise.resolve(pageDocs[url]);
  // すでに現在のページなら fetch せずに document を使う
  return fetch(url).then(r=>{
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.text();
  }).then(html=>{
    const doc=new DOMParser().parseFromString(html,'text/html');
    pageDocs[url]=doc;
    return doc;
  }).catch(e=>{
    console.warn('[game] fetch failed:',url,e);
    pageDocs[url]=null;
    return null;
  });
}

function applyDefaults(){
  // STAGE 1 (index.html #about "私たちについて")
  gc.m={
    chip:'About Us',
    title:'私たちについて',
    catchParts:[
      {text:'エンジニアの', color:null},
      {text:'力',         color:'orange'},
      {text:'で、常識を超え、', color:null},
      {br:true},
      {text:'未来',        color:'teal'},
      {text:'を創る。',    color:null}
    ],
    heading:'トライテック(Tritech)の使命',
    missions:[
      '常に先進技術に挑戦(トライ：try)し続け、最先端の技術集団であり続ける。',
      'お客様のビジネスに貢献し、成功・勝利(トライアンフ：triumph)に導く。',
      'お客様とエンジニアをマッチングさせ、ビジネスを加速させることで社会貢献するといったトライアングル(triangle)を構築する。'
    ],
    closing:'経験豊富なエンジニアと専門家からなるチームが、お客様の信頼と満足を第一に考え、長期的なパートナーシップの構築のために、お客様の課題に真摯に向き合い、革新的なソリューションを提供することをお約束します。'
  };
  // STAGE 2 (about-detail.html #sec-mvv "私たちが大切にすること")
  gc.v={
    chip:'Mission · Vision · Values',
    title:'私たちが大切にすること',
    mission:{
      num:'01', label:'MISSION', wm:'M',
      headline:'新たな視点と技術力で、社会とビジネスの在り方を再定義する。',
      sub:'― 私たちは、現場で生まれる気づきと挑戦を起点に、革新的な価値を創出します。'
    },
    vision:{
      num:'02', label:'VISION', wm:'V',
      headline:'エンジニア一人ひとりの挑戦が、次の世界を動かす力になる。',
      sub:'― エンジニアの成長と創意が、社会の変化と未来の可能性を切り拓いていきます。'
    },
    values:{
      num:'03', label:'VALUES', wm:'V',
      items:[
        {title:'Engineer First｜エンジニアを主役に。',     desc:'現場に立つエンジニアの声を最優先に、働きやすさ・成長・納得のある環境をつくる。'},
        {title:'革新は現場から生まれる。',                 desc:'目の前の課題に向き合い、現場発のアイデアと技術で本質的な変化を生み出す。'},
        {title:'三位一体の信頼。',                         desc:'エンジニア・クライアント・社会貢献、全員の成功と成長が連動する関係を築く。'},
        {title:'透明で、正当な評価。',                     desc:'努力と成果を正しく評価し、昇給・待遇・キャリアに反映。納得感ある働き方を支える。'},
        {title:'変化を楽しみ、スピードを大切に。',         desc:'変化を歓迎し、誠実かつ迅速に動くことで、チャンスを逃さず成長を加速させる。'}
      ]
    }
  };
  // STAGE 3 (index.html #sec-reason「トライテックを選ぶ5つの理由」— フォールバック)
  gc.o={
    chip:'WHY TRITECH',
    title:'トライテックを選ぶ5つの理由',
    rows:[
      {label:'POINT 01',val:'エンジニア社長の考える、エンジニアファーストの報酬設計',body:'売上の高い割合をエンジニアへ還元する仕組みを採用。市場価値を正しく反映した給与水準を実現し、スキルアップや案件単価の向上が直接収入に繋がります。昇給制度も完備しており、頑張りが見える化される文化です。'},
      {label:'POINT 02',val:'自分で選べる案件・技術スタック',body:'「やりたいことがある」「この技術を伸ばしたい」という希望を最優先に案件をマッチング。金融・製造・EC・SaaS など多様な業界の上流〜運用フェーズまで、キャリアプランに合わせて選択できます。希望と合わない案件は断ることができます。'},
      {label:'POINT 03',val:'成長を止めないラーニング環境',body:'社内勉強会、資格取得支援(費用全額補助)を提供。また現役エンジニアがあなたのメンターとなり定例1on1を開催し、あなたのキャリアプランを全面的に支援します。'},
      {label:'POINT 04',val:'エンジニアを不安にさせない透明性',body:'参画案件の単価はもちろん、あなたの報酬の算出根拠も開示します。現場で活躍するエンジニアが不安にならないように、常に透明性を意識した会社運営をしています。'},
      {label:'POINT 05',val:'充実した福利厚生・働き方の柔軟性',body:'リモートワーク対応案件多数・フレックスタイム制・社会保険完備・交通費支給(上限3万円)など、安心して長く働くための制度を整備。「エンジニアとして、人として」尊重される職場環境を追求しています。'}
    ]
  };
  // STAGE 4 (index.html #data「数字で見るトライテック」— フォールバック)
  gc.h={
    chip:'Data',
    title:'数字で見るトライテック',
    events:[
      {year:'01',title:'15',  unit:'名',     text:'社員数'},
      {year:'02',title:'91',  unit:'%',      text:'定着率'},
      {year:'03',title:'131', unit:'日',     text:'年間休日'},
      {year:'04',title:'10',  unit:'%+',     text:'昇給率'},
      {year:'05',title:'80',  unit:'%',      text:'リモート率'},
      {year:'06',title:'100', unit:'%',      text:'育休復帰率'}
    ]
  };
  // STAGE 5 (index.html #sec-reward "報酬が決まる仕組み")
  gc.r={
    chip:'REWARD STRUCTURE',
    title:'報酬が決まる仕組み、すべてお見せします。',
    steps:[
      {num:'STEP 01', label:'市場単価'},
      {num:'STEP 02', label:'会社利益率 30%'},
      {num:'STEP 03', label:'各種税・保険料'},
      {num:'RESULT',  label:'あなたの報酬', isFinal:true}
    ],
    note:'あなたのスキル・経験に応じて市場単価を設定し、そこからあなたの報酬が決まるまでのロジックを明示します。給与の不透明感に悩むことは、もうありません。前職給与の保証＋年10%以上の昇給を毎年目標にしています。'
  };
  // BOSS (about-detail.html #sec-ceo)
  gc.ceo={
    name:'清水 幸秀',
    role:'代表取締役 CEO',
    tagline:'「エンジニアの未来を、共に描く」',
    photoSrc:'/assets/images/photos/ceo.jpg',
    msg1:'トライテックは「エンジニアファースト」を掲げ、技術者一人ひとりが理想のキャリアを築ける環境を本気で追求しています。',
    msg2:'私自身、現役エンジニアとして10年以上現場に立ち続けてきた経験をもとに、エンジニアの気持ちや課題を誰よりも理解していると自負しています。',
    msg3:'エンジニアが主役の未来を、ここから一緒に創っていきましょう。',
    paragraphs:[
      'トライテックは、「エンジニアファースト」を掲げ、技術者一人ひとりが理想のキャリアを築ける環境を本気で追求しています。',
      '私自身、現役エンジニアとして10年以上現場に立ち続けてきた経験をもとに、エンジニアの気持ちや課題を誰よりも理解していると自負しています。その実感があるからこそ、誰もが安心して長く働き、挑戦し続けられる会社をつくることが私の使命です。',
      '私たちのチームは、先進技術に果敢に挑み続ける「トライ（try）」の精神を持ち、クライアントの成功をともに喜び合える「トライアンフ（triumph）」の瞬間を生み出し、そしてエンジニア・企業・社会を結ぶ「トライアングル（triangle）」の関係を構築することに全力を注いでいます。',
      'エンジニアが活躍し続けるために必要なのは、技術力だけではありません。働く環境、待遇、成長の機会、そして人として尊重される文化があってこそ、その力が最大限に発揮されると私たちは信じています。',
      'トライテックでは、リモートワークや副業の推奨、年間131日の休日など、柔軟な働き方を実現しながらも、昇給率10%以上を目標とした年次給与改定など、公正かつ透明な評価制度を整えています。',
      'スピーディーな選考プロセスで、あなたの次の一歩を後押しし、入社後は定期的な1on1でキャリアの悩みや展望をしっかり受け止め、共に成長していける関係性を大切にしています。',
      '「開発やテストが好きだ」「もっと成長したい」「安心して働きたい」そんな思いを持つあなたへ。',
      'トライテックは、あなたの挑戦を心から応援します。エンジニアが主役の未来を、ここから一緒に創っていきましょう。'
    ]
  };
  // CEO 写真の事前ロード
  loadCeoPhoto(gc.ceo.photoSrc);
}

function extractContent(){
  // まずは即座にデフォルト値をセット（ゲーム開始をブロックしないため）
  applyDefaults();

  const txt=el=>el?.textContent?.trim()||'';

  // ─ 同期: 現在のページの DOM を優先 ─
  applyFromDoc(document);

  // ─ 非同期: 正典ソースを fetch して上書き ─
  // 旧 recruit-detail.html は index.html に統合済み（.recruit-section）
  fetchPageDoc('/').then(doc=>{if(doc)applyFromDoc(doc)});
  fetchPageDoc('/about-detail/').then(doc=>{if(doc)applyFromDoc(doc)});

  function applyFromDoc(doc){
    // ── STAGE 1: index.html #about (私たちについて) ──
    const aboutEntry=doc.querySelector('#about.about-entry, #about');
    if(aboutEntry&&aboutEntry.querySelector('.about-catch')){
      // chip
      const chipEl=aboutEntry.querySelector('.s-chip');
      if(chipEl)gc.m.chip=txt(chipEl).replace(/^[●・]\s*/,''); // 先頭の記号は除去
      // title
      const titleEl=aboutEntry.querySelector('.s-title');
      if(titleEl)gc.m.title=txt(titleEl);
      // catch（色付きスパンを構造的に分解）
      const catchEl=aboutEntry.querySelector('.about-catch');
      if(catchEl){
        const parts=[];
        catchEl.childNodes.forEach(node=>{
          if(node.nodeType===3){ // TEXT_NODE
            const t=node.textContent.replace(/\s+/g,'');
            if(t)parts.push({text:t,color:null});
          } else if(node.nodeName==='BR'){
            parts.push({br:true});
          } else if(node.nodeName==='SPAN'){
            let color=null;
            if(node.classList.contains('o'))color='orange';
            else if(node.classList.contains('t'))color='teal';
            else if(node.classList.contains('n'))color='navy';
            const t=node.textContent.replace(/\s+/g,'');
            if(t)parts.push({text:t,color});
          }
        });
        if(parts.length)gc.m.catchParts=parts;
      }
      // 使命見出し
      const headEl=aboutEntry.querySelector('.mission-heading');
      if(headEl)gc.m.heading=txt(headEl);
      // 使命リスト3項目
      const items=[...aboutEntry.querySelectorAll('.mission-list li')].slice(0,3);
      if(items.length)gc.m.missions=items.map(li=>txt(li));
      // 締め文
      const closingEl=aboutEntry.querySelector('.mission-closing');
      if(closingEl)gc.m.closing=txt(closingEl);
    }

    // ── STAGE 2: #sec-mvv (MVV) ──
    const mvvSec=doc.querySelector('#sec-mvv');
    if(mvvSec){
      // chip ("// MISSION · VISION · VALUES" → 先頭の "// " を除去)
      const chipEl=mvvSec.querySelector('.sec-chip');
      if(chipEl)gc.v.chip=txt(chipEl).replace(/^\/\/\s*/,'');
      // title
      const st=mvvSec.querySelector('.sec-title');
      if(st)gc.v.title=txt(st);
      // Mission 行
      const mRow=mvvSec.querySelector('.mvv-row.mission');
      if(mRow){
        const h3=mRow.querySelector('.mvv-body h3');
        const sub=mRow.querySelector('.mvv-sub');
        const wm=mRow.querySelector('.mvv-watermark');
        gc.v.mission={
          num:'01', label:'MISSION',
          wm:wm?txt(wm):'M',
          headline:h3?txt(h3):'',
          sub:sub?txt(sub):''
        };
      }
      // Vision 行
      const vRow=mvvSec.querySelector('.mvv-row.vision');
      if(vRow){
        const h3=vRow.querySelector('.mvv-body h3');
        const sub=vRow.querySelector('.mvv-sub');
        const wm=vRow.querySelector('.mvv-watermark');
        gc.v.vision={
          num:'02', label:'VISION',
          wm:wm?txt(wm):'V',
          headline:h3?txt(h3):'',
          sub:sub?txt(sub):''
        };
      }
      // Values 行（5項目リスト）
      const vlRow=mvvSec.querySelector('.mvv-row.values');
      if(vlRow){
        const wm=vlRow.querySelector('.mvv-watermark');
        const lis=[...vlRow.querySelectorAll('.vals-list li')];
        gc.v.values={
          num:'03', label:'VALUES',
          wm:wm?txt(wm):'V',
          items:lis.map(li=>({
            title:txt(li.querySelector('.val-title')),
            desc:txt(li.querySelector('.val-desc'))
          }))
        };
      }
    }

    // ── STAGE 3: #sec-reason (index.html「トライテックを選ぶ5つの理由」) ──
    const reasonSec=doc.querySelector('#sec-reason');
    if(reasonSec){
      // chip: "// WHY TRITECH" → "WHY TRITECH"
      const chipEl=reasonSec.querySelector('.sec-chip');
      if(chipEl)gc.o.chip=txt(chipEl).replace(/^\/\/\s*/,'');
      // title: ".ac" を含むため innerText で取得（"トライテックを選ぶ5つの理由"）
      const titleEl=reasonSec.querySelector('.sec-title');
      if(titleEl)gc.o.title=txt(titleEl);
      const cards=[...reasonSec.querySelectorAll('.reason-card')].slice(0,5);
      if(cards.length){
        gc.o.rows=cards.map((c,i)=>({
          label:txt(c.querySelector('.reason-point'))||('POINT 0'+(i+1)),
          val:txt(c.querySelector('.reason-title'))||'',
          body:txt(c.querySelector('.reason-body'))||''
        }));
      }
    }

    // ── STAGE 4: #data (index.html「数字で見るトライテック」) ──
    const dataSec=doc.querySelector('#data');
    if(dataSec){
      // chip "● Data" → "Data"（先頭の dot/中黒を除去して大文字化用に保持）
      const chipEl=dataSec.querySelector('.s-chip');
      if(chipEl)gc.h.chip=txt(chipEl).replace(/^[●・]\s*/,'');
      // title "数字で見るトライテック"
      const titleEl=dataSec.querySelector('.s-title');
      if(titleEl)gc.h.title=txt(titleEl);
      const cards=[...dataSec.querySelectorAll('.dc')].slice(0,6);
      if(cards.length){
        gc.h.events=cards.map((c,i)=>{
          const num=c.querySelector('.cnum')?.getAttribute('data-target')||txt(c.querySelector('.cnum'));
          const u=txt(c.querySelector('.u'));
          const p=txt(c.querySelector('.p'));
          return {
            year:'0'+(i+1),
            title:num||'',
            unit:(u||'')+(p||''),
            text:txt(c.querySelector('.dc-label'))
          };
        });
      }
    }

    // ── STAGE 5: #sec-reward (報酬が決まる仕組み) ──
    const rewardSec=doc.querySelector('#sec-reward');
    if(rewardSec){
      // chip
      const chipEl=rewardSec.querySelector('.sec-chip');
      if(chipEl)gc.r.chip=txt(chipEl).replace(/^\/\/\s*/,'');
      // title
      const titleEl=rewardSec.querySelector('.sec-title');
      if(titleEl)gc.r.title=txt(titleEl);
      // 4ステップ
      const boxes=[...rewardSec.querySelectorAll('.rf-box')];
      if(boxes.length){
        gc.r.steps=boxes.map(box=>{
          const numEl=box.querySelector('.rf-num');
          const lblEl=box.querySelector('.rf-label');
          // <br> を半角スペースに置換してテキスト取得
          let labelTxt='';
          if(lblEl){
            const clone=lblEl.cloneNode(true);
            clone.querySelectorAll('br').forEach(br=>br.replaceWith(' '));
            labelTxt=clone.textContent.trim().replace(/\s+/g,' ');
          }
          return {
            num:numEl?txt(numEl):'',
            label:labelTxt,
            isFinal:box.classList.contains('rf-final')
          };
        });
      }
      // 締め文
      const noteEl=rewardSec.querySelector('.reward-note');
      if(noteEl)gc.r.note=txt(noteEl);
    }

    // ── (旧) STAGE 5: #sec-voices (社員の声) - 現在は未使用 ──
    const voiceSec=doc.querySelector('#sec-voices');
    if(voiceSec){
      const cards=[...voiceSec.querySelectorAll('.voice-card')].slice(0,5);
      if(cards.length){
        gc.mem.list=cards.map(c=>{
          const av=c.querySelector('.voice-avatar');
          let col='#888888';
          if(av){
            const m=(av.getAttribute('style')||'').match(/background\s*:\s*([^;]+)/i);
            if(m)col=m[1].trim();
          }
          return {
            init:txt(av).charAt(0)||'?',
            name:txt(c.querySelector('.voice-name')),
            role:txt(c.querySelector('.voice-role')).replace(/\s+/g,' '),
            text:txt(c.querySelector('.voice-catch')),
            col
          };
        });
      }
    }

    // ── BOSS: #sec-ceo (代表メッセージ) ──
    const ceoSec=doc.querySelector('#sec-ceo');
    if(ceoSec){
      // 名前と肩書きは .ceo-photo-cap small（例: "代表取締役 清水 幸秀"）から抽出
      const capSmall=ceoSec.querySelector('.ceo-photo-cap small');
      if(capSmall){
        const capTxt=txt(capSmall);
        const parts=capTxt.split(/\s+/);
        if(parts.length>=2){
          gc.ceo.role=parts[0]+' CEO';
          gc.ceo.name=parts.slice(1).join(' ');
        } else {
          gc.ceo.name=capTxt;
        }
      } else {
        const sign=ceoSec.querySelector('.ceo-sign');
        if(sign){
          const m=txt(sign).match(/代表取締役\s*(.+)$/);
          if(m)gc.ceo.name=m[1].trim();
        }
      }
      const ttl=ceoSec.querySelector('.ceo-ttl');
      if(ttl)gc.ceo.tagline=txt(ttl);
      // 写真パス + 全パラグラフを取得
      const ceoImgEl=ceoSec.querySelector('.ceo-photo img');
      if(ceoImgEl){
        const src=ceoImgEl.getAttribute('src');
        if(src){
          gc.ceo.photoSrc=src;
          loadCeoPhoto(src);
        }
      }
      const paras=[...ceoSec.querySelectorAll('.ceo-body p')].map(txt).filter(s=>s.length);
      if(paras.length){
        gc.ceo.paragraphs=paras;
        gc.ceo.msg1=paras[0]||gc.ceo.msg1;
        gc.ceo.msg2=paras[1]||gc.ceo.msg2;
        const closing=[...paras].reverse().find(p=>/未来|一緒|ましょう|応援/.test(p));
        gc.ceo.msg3=closing||paras[paras.length-1]||gc.ceo.msg3;
      }
    }
  }
}

// テキストを指定文字数で折り返す
function splitLines(text,maxChars){
  const lines=[];let cur='';
  for(const ch of text){cur+=ch;if(cur.length>=maxChars&&(ch==='。'||ch==='、'||ch==='.')){lines.push(cur);cur='';}}
  if(cur)lines.push(cur);
  return lines.length?lines:[text];
}


/* ── PRE-RENDERED GRID (offscreen) ── */
let gridCanvas=null,gridDirty=true;
function getGrid(){
  if(!gridDirty&&gridCanvas)return gridCanvas;
  gridCanvas=document.createElement('canvas');
  gridCanvas.width=W;gridCanvas.height=H;
  const g=gridCanvas.getContext('2d');
  g.strokeStyle='rgba(0,255,136,.035)';g.lineWidth=1;
  for(let x=0;x<W;x+=55){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()}
  for(let y=0;y<H;y+=55){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
  gridDirty=false;
  return gridCanvas;
}

/* ── STARS (square, fast) ── */
function initStars(){
  stars=[];
  for(let i=0;i<60;i++)stars.push({x:Math.random()*W,y:Math.random()*H,s:Math.random()<.4?2:1,v:.4+Math.random()*1.1});
}
function drawStars(){
  c.fillStyle='rgba(255,255,255,.55)';
  stars.forEach(s=>{s.y+=s.v;if(s.y>H){s.y=0;s.x=Math.random()*W}c.fillRect(s.x,s.y,s.s,s.s)});
}

/* ── ボーナスワード「トライテック」 ── */
function updateDrawBonusWords(){
  // スポーン（playing中のみ）
  if(state==='playing'){
    bonusSpawnTimer++;
    if(bonusSpawnTimer>280&&Math.random()<.65){
      bonusSpawnTimer=0;
      bonusWords.push({x:40+Math.random()*(W-80),y:-18,spd:.6+Math.random()*.7,a:.55+Math.random()*.35});
    }
  }
  const fs=Math.min(W*.017,12);
  c.font=`bold ${fs}px "Noto Sans JP",sans-serif`;
  c.textAlign='center';c.textBaseline='middle';
  const tw=fs*7.5; // 「トライテック」7文字の概算幅
  bonusWords=bonusWords.filter(w=>{
    w.y+=w.spd;
    if(w.y>H+20)return false;
    // 弾との当たり判定
    let hit=false;
    bullets=bullets.filter(b=>{
      if(!hit&&Math.abs(b.x-w.x)<tw/2&&Math.abs(b.y-w.y)<fs*1.2){
        hit=true;
        score+=100;updateHUD();
        explode(w.x,w.y,'#ffcc44');
        beep(1200,.08,'sine',.1);setTimeout(()=>beep(1500,.08,'sine',.08),60);
        // +100 パーティクルテキスト
        parts.push({x:w.x,y:w.y-10,vx:0,vy:-1.5,l:1,ml:50,r:0,col:'#ffcc44',sq:false,txt:'+100'});
        return false;
      }
      return true;
    });
    if(hit)return false;
    // 描画
    c.save();
    c.globalAlpha=w.a*(0.6+Math.sin(frame*.08+w.x)*.4);
    c.fillStyle='#ffcc44';
    c.shadowColor='#ffcc44';c.shadowBlur=4;
    c.fillText('トライテック',w.x,w.y);
    c.shadowBlur=0;
    c.restore();
    return true;
  });
}

/* ── PARTICLES (minimal) ── */
function explode(x,y,col){
  for(let i=0;i<10;i++){
    const a=Math.random()*Math.PI*2,s=1.5+Math.random()*3.5;
    parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,l:1,ml:22+Math.random()*16,r:2+Math.random()*3,col});
  }
  parts.push({x,y,vx:0,vy:-2,l:1,ml:30,r:8,col:'#ffee44',sq:true});
}
function drawParts(){
  parts=parts.filter(p=>{
    p.x+=p.vx;p.y+=p.vy;p.vy+=.15;p.l-=1/p.ml;
    if(p.l<=0)return false;
    c.globalAlpha=p.l;c.fillStyle=p.col;
    if(p.txt){
      // +100 スコアテキスト
      c.font=`bold ${Math.min(W*.018,12)}px "Press Start 2P",monospace`;
      c.textAlign='center';c.textBaseline='middle';
      c.shadowColor=p.col;c.shadowBlur=6;
      c.fillText(p.txt,p.x,p.y);
      c.shadowBlur=0;
    } else {
      p.sq?c.fillRect(p.x-p.r/2,p.y-p.r/2,p.r,p.r):(c.beginPath(),c.arc(p.x,p.y,p.r,0,Math.PI*2),c.fill());
    }
    return true;
  });
  c.globalAlpha=1;
}

/* ── ROUNDED RECT PATH ── */
function rr(x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.arcTo(x+w,y,x+w,y+r,r);
  c.lineTo(x+w,y+h-r);c.arcTo(x+w,y+h,x+w-r,y+h,r);
  c.lineTo(x+r,y+h);c.arcTo(x,y+h,x,y+h-r,r);
  c.lineTo(x,y+r);c.arcTo(x,y,x+r,y,r);
  c.closePath();
}

/* ── REVEAL DRAW HELPER ──
   rev=0: only grey placeholder
   0<rev<1: grey + colored overlay blended
   rev=1: full color only
   No ctx.filter used at all! */
function withRev(rev,greyFn,colorFn){
  if(rev<.02){greyFn();return}
  if(rev>.98){colorFn();return}
  greyFn();
  c.save();c.globalAlpha=rev;colorFn();c.restore();
}

/* グレープレースホルダー（ゾーン内に自己クリップ） */
function greyBox(x,y,w,h,lines){
  c.save();
  rr(x,y,w,h,8);c.clip(); // ゾーン境界内にクリップ
  c.fillStyle='rgba(50,55,65,.75)';rr(x,y,w,h,8);c.fill();
  c.strokeStyle='rgba(120,130,150,.4)';c.lineWidth=1;rr(x,y,w,h,8);c.stroke();
  if(lines){
    c.fillStyle='rgba(100,110,130,.5)';
    lines.forEach((lw,i)=>c.fillRect(x+w*.08,y+h*(.25+i*.22),w*lw,Math.min(h*.12,10)));
  }
  c.restore();
}

/* カード内テキスト折り返し helper */
function fitLines(text,font,maxW){
  c.save();c.font=font;
  const lines=[];let line='';
  for(const ch of text){
    const test=line+ch;
    if(c.measureText(test).width>maxW&&line){lines.push(line);line=ch}
    else line=test;
  }
  if(line)lines.push(line);
  c.restore();return lines;
}

/* ══════════ STAGE DEFINITIONS ══════════ */
const STAGES=[

/* ─── STAGE 1: ABOUT (index.html #about / 私たちについて) ─── */
/* HTMLの縦並びレイアウトに準拠：
   chip → title → catch(色付き) → 使命見出し → 3つの使命項目 → 締め文 */
{idx:0,name:'STAGE 1',sub:'ABOUT',col:'#d95f1a',isBoss:false,hF:.88,spd:1.18,
 mkZ(bw,bh){return[
   {id:'chip',    rx:.05, ry:.02, rw:.28, rh:.055, hp:2,mhp:2},
   {id:'title',   rx:.05, ry:.09, rw:.55, rh:.08,  hp:3,mhp:3},
   {id:'catch',   rx:.05, ry:.18, rw:.90, rh:.21,  hp:5,mhp:5},
   {id:'heading', rx:.05, ry:.41, rw:.70, rh:.065, hp:2,mhp:2},
   {id:'m1',      rx:.05, ry:.480,rw:.90, rh:.100, hp:2,mhp:2},
   {id:'m2',      rx:.05, ry:.595,rw:.90, rh:.100, hp:2,mhp:2},
   {id:'m3',      rx:.05, ry:.710,rw:.90, rh:.100, hp:2,mhp:2},
   {id:'closing', rx:.05, ry:.825,rw:.90, rh:.165, hp:3,mhp:3}
 ]},
 draw(bx,by,bw,bh,zr,hideBg){
   const m=gc.m||{};
   if(!hideBg){c.fillStyle='rgba(8,4,18,.95)';rr(bx,by,bw,bh,14);c.fill();c.strokeStyle='rgba(217,95,26,.22)';c.lineWidth=1.5;rr(bx,by,bw,bh,14);c.stroke();}

   // ── chip "● About Us" ──
   withRev(zr.chip,
     ()=>greyBox(bx+bw*.05,by+bh*.02,bw*.28,bh*.055,[[.7]]),
     ()=>{
       const cx=bx+bw*.05, cy=by+bh*.02, cw=bw*.28, ch=bh*.055;
       c.fillStyle='rgba(217,95,26,.18)';rr(cx,cy,cw,ch,ch*.5);c.fill();
       c.strokeStyle='#d95f1a';c.lineWidth=1.5;rr(cx,cy,cw,ch,ch*.5);c.stroke();
       // dot
       c.fillStyle='#d95f1a';c.beginPath();c.arc(cx+ch*.55,cy+ch*.5,ch*.18,0,Math.PI*2);c.fill();
       c.font=`bold ${ch*.42}px "Noto Sans JP",sans-serif`;c.fillStyle='#d95f1a';c.textAlign='left';c.textBaseline='middle';
       c.fillText((m.chip||'About Us').toUpperCase(),cx+ch*1.0,cy+ch*.55);
     });

   // ── title "私たちについて" ──
   withRev(zr.title,
     ()=>greyBox(bx+bw*.05,by+bh*.09,bw*.55,bh*.08,[[.7]]),
     ()=>{
       c.font=`800 ${bh*.055}px "Syne","Noto Sans JP",sans-serif`;c.fillStyle='#fff';c.textAlign='left';c.textBaseline='top';
       c.fillText(m.title||'私たちについて',bx+bw*.05,by+bh*.095);
       // accent under-bar
       c.fillStyle='#d95f1a';c.fillRect(bx+bw*.05,by+bh*.165,bw*.08,3);
     });

   // ── catch (大型・色付きテキスト) ──
   withRev(zr.catch,
     ()=>greyBox(bx+bw*.05,by+bh*.18,bw*.90,bh*.21,[[.85],[.65]]),
     ()=>{
       const fs=Math.min(bw*.054,bh*.085);
       c.font=`800 ${fs}px "Noto Sans JP","Syne",sans-serif`;
       c.textAlign='left';c.textBaseline='top';
       const lineH=fs*1.45;
       let curX=bx+bw*.05;
       let curY=by+bh*.20;
       (m.catchParts||[]).forEach(part=>{
         if(part.br){curY+=lineH;curX=bx+bw*.05;return;}
         const color=part.color==='orange'?'#d95f1a'
                    :part.color==='teal'  ?'#1e8fa0'
                    :part.color==='navy'  ?'#1d3557'
                    :'#ffffff';
         c.fillStyle=color;
         c.fillText(part.text||'',curX,curY);
         curX+=c.measureText(part.text||'').width;
       });
     });

   // ── 使命見出し（左ボーダー + テキスト） ──
   withRev(zr.heading,
     ()=>greyBox(bx+bw*.05,by+bh*.41,bw*.70,bh*.065,[[.85]]),
     ()=>{
       const hx=bx+bw*.05, hy=by+bh*.41, hw=bw*.70, hh=bh*.065;
       c.fillStyle='#d95f1a';c.fillRect(hx,hy+hh*.12,3,hh*.76);
       c.font=`bold ${hh*.55}px "Noto Sans JP",sans-serif`;c.fillStyle='#fff';c.textAlign='left';c.textBaseline='middle';
       c.fillText(m.heading||'トライテック(Tritech)の使命',hx+12,hy+hh*.5);
     });

   // ── 使命3項目（▸ プレフィックス付き・複数行折返し対応） ──
   const missY=[.480,.595,.710];
   ['m1','m2','m3'].forEach((zid,i)=>{
     withRev(zr[zid],
       ()=>greyBox(bx+bw*.05,by+bh*missY[i],bw*.90,bh*.100,[[.95],[.85]]),
       ()=>{
         const mx=bx+bw*.05, my=by+bh*missY[i], mw=bw*.90, mh=bh*.100;
         const fs=Math.max(13,Math.min(bw*.020,mh*.32));
         const lh=fs*1.45;
         const text=(m.missions||[])[i]||'';
         const indent=bw*.030; // ▸の右側からテキスト開始
         const textMaxW=mw-indent-bw*.01;
         const font=`${fs}px "Noto Sans JP",sans-serif`;
         c.font=font;
         // 複数行に折返し（最大3行）
         const lines=fitLines(text,font,textMaxW).slice(0,3);
         // ▸ marker（縦中央寄せ）
         const blockH=lines.length*lh;
         const startY=my+(mh-blockH)/2+fs*0.1;
         c.font=`bold ${fs*1.05}px "Noto Sans JP",sans-serif`;
         c.fillStyle='#d95f1a';c.textAlign='left';c.textBaseline='top';
         c.fillText('▸',mx,startY);
         // 本文（複数行）
         c.font=font;c.fillStyle='rgba(255,255,255,.92)';
         lines.forEach((l,li)=>c.fillText(l,mx+indent,startY+li*lh));
       });
   });

   // ── 締め文（複数行折返し） ──
   // ゾーン: ry:.825, rh:.165 （使命項目の拡大に合わせて下にシフト済み）
   withRev(zr.closing,
     ()=>greyBox(bx+bw*.05,by+bh*.825,bw*.90,bh*.165,[[.9],[.85],[.7],[.55]]),
     ()=>{
       const fs=Math.min(bw*.019,bh*.024);
       const font=`${fs}px "Noto Sans JP",sans-serif`;
       c.font=font;c.fillStyle='rgba(255,255,255,.55)';c.textAlign='left';c.textBaseline='top';
       const lines=fitLines(m.closing||'',font,bw*.88);
       const lh=fs*1.55;
       // ゾーン上端から少し余白を取って描画開始
       lines.slice(0,4).forEach((l,li)=>c.fillText(l,bx+bw*.05,by+bh*.840+li*lh));
     });
 }
},

/* ─── STAGE 2: MVV (about-detail.html #sec-mvv / 私たちが大切にすること) ─── */
/* 上段: Mission + Vision（横並び2カード）  下段: Values（1カード, 5項目リスト） */
{idx:1,name:'STAGE 2',sub:'MVV',col:'#1e8fa0',isBoss:false,hF:.92,spd:1.18,
 mkZ(bw,bh){return[
   {id:'chip',   rx:.04, ry:.02, rw:.40, rh:.055, hp:2,mhp:2},
   {id:'title',  rx:.04, ry:.09, rw:.65, rh:.08,  hp:3,mhp:3},
   // 上段 2カード
   {id:'mission',rx:.03, ry:.19, rw:.465,rh:.27, hp:5,mhp:5},
   {id:'vision', rx:.505,ry:.19, rw:.465,rh:.27, hp:5,mhp:5},
   // 下段 1カード（Values, 5項目）
   {id:'values', rx:.03, ry:.48, rw:.94, rh:.51, hp:6,mhp:6}
 ]},
 draw(bx,by,bw,bh,zr,hideBg){
   const v=gc.v||{};
   if(!hideBg){
     c.fillStyle='rgba(8,4,18,.95)';rr(bx,by,bw,bh,14);c.fill();
     c.strokeStyle='rgba(30,143,160,.22)';c.lineWidth=1.5;rr(bx,by,bw,bh,14);c.stroke();
   }

   // ── chip ──
   withRev(zr.chip,
     ()=>greyBox(bx+bw*.04,by+bh*.02,bw*.40,bh*.055,[[.7]]),
     ()=>{
       const cx=bx+bw*.04, cy=by+bh*.02, cw=bw*.40, ch=bh*.055;
       c.fillStyle='rgba(30,143,160,.18)';rr(cx,cy,cw,ch,ch*.5);c.fill();
       c.strokeStyle='#1e8fa0';c.lineWidth=1.5;rr(cx,cy,cw,ch,ch*.5);c.stroke();
       c.fillStyle='#1e8fa0';c.beginPath();c.arc(cx+ch*.55,cy+ch*.5,ch*.18,0,Math.PI*2);c.fill();
       c.font=`bold ${ch*.40}px "Noto Sans JP",sans-serif`;c.fillStyle='#1e8fa0';c.textAlign='left';c.textBaseline='middle';
       c.fillText((v.chip||'MISSION · VISION · VALUES').toUpperCase(),cx+ch*1.0,cy+ch*.55);
     });

   // ── title ──
   withRev(zr.title,
     ()=>greyBox(bx+bw*.04,by+bh*.09,bw*.65,bh*.08,[[.75]]),
     ()=>{
       c.font=`800 ${bh*.055}px "Syne","Noto Sans JP",sans-serif`;c.fillStyle='#fff';c.textAlign='left';c.textBaseline='top';
       c.fillText(v.title||'私たちが大切にすること',bx+bw*.04,by+bh*.095);
       c.fillStyle='#1e8fa0';c.fillRect(bx+bw*.04,by+bh*.165,bw*.08,3);
     });

   // ── Mission / Vision カード（共通描画ヘルパー）──
   function drawMVVCard(rev,data,zx,zy,zw,zh,col){
     withRev(rev,
       ()=>greyBox(zx,zy,zw,zh,[[.4],[.7],[.85],[.65]]),
       ()=>{
         c.save();rr(zx,zy,zw,zh,12);c.clip();
         // bg + border
         c.fillStyle='rgba(255,255,255,.03)';rr(zx,zy,zw,zh,12);c.fill();
         c.strokeStyle=col+'66';c.lineWidth=1.5;rr(zx,zy,zw,zh,12);c.stroke();
         // 大型透かしロゴ（M/V）
         const wmFs=Math.min(zh*1.0,zw*.55);
         c.font=`800 ${wmFs}px "Syne",sans-serif`;c.fillStyle=col+'14';c.textAlign='right';c.textBaseline='middle';
         c.fillText(data.wm||'',zx+zw-zh*.02,zy+zh*.55);
         // ── 01 番号 + MISSION/VISION ラベル を横並び（同じ行） ──
         const nfs=zh*.20;
         const lblFs=zh*.050;
         c.font=`800 ${nfs}px "Syne",sans-serif`;
         c.fillStyle=col;c.textAlign='left';c.textBaseline='alphabetic';
         const numTxt=data.num||'';
         const headerBaseY=zy+zh*.24; // 番号下端の Y（=ベースライン）
         c.fillText(numTxt,zx+zw*.05,headerBaseY);
         const numW=c.measureText(numTxt).width;
         // ラベルを番号の右隣に配置（ベースライン揃え）
         c.font=`bold ${lblFs}px "Press Start 2P",monospace`;
         c.fillStyle=col;c.textBaseline='alphabetic';
         c.fillText(data.label||'',zx+zw*.05+numW+zw*.030,headerBaseY-lblFs*0.12);
         // h3 headline (multi-line) — ヘッダー圧縮で位置を上にシフト
         const hfs=Math.max(15,Math.min(zw*.048,zh*.110));
         const hfont=`bold ${hfs}px "Noto Sans JP",sans-serif`;
         c.font=hfont;c.fillStyle='#fff';c.textBaseline='top';
         const hlines=fitLines(data.headline||'',hfont,zw*.88).slice(0,3);
         hlines.forEach((l,li)=>c.fillText(l,zx+zw*.05,zy+zh*.34+li*hfs*1.40));
         // sub paragraph — フォント拡大
         const sfs=Math.max(13,Math.min(zw*.036,zh*.080));
         const sfont=`${sfs}px "Noto Sans JP",sans-serif`;
         c.font=sfont;c.fillStyle='rgba(255,255,255,.60)';c.textBaseline='top';
         const subBaseY=zy+zh*.34+hlines.length*hfs*1.40+zh*.04;
         const slines=fitLines(data.sub||'',sfont,zw*.92).slice(0,3);
         slines.forEach((l,li)=>c.fillText(l,zx+zw*.05,subBaseY+li*sfs*1.40));
         c.restore();
       });
   }
   drawMVVCard(zr.mission, v.mission||{}, bx+bw*.03,  by+bh*.19, bw*.465, bh*.30, '#d95f1a');
   drawMVVCard(zr.vision,  v.vision||{},  bx+bw*.505, by+bh*.19, bw*.465, bh*.30, '#44AADB');

   // ── Values カード（5項目リスト, 大型） ──
   withRev(zr.values,
     ()=>greyBox(bx+bw*.03,by+bh*.48,bw*.94,bh*.51,[[.4],[.9],[.85],[.7],[.8],[.75]]),
     ()=>{
       const zx=bx+bw*.03, zy=by+bh*.48, zw=bw*.94, zh=bh*.51;
       const col='#3a78c9'; // navy 系（HTMLの --navy/blue にあわせる）
       const vdata=v.values||{};
       c.save();rr(zx,zy,zw,zh,12);c.clip();
       c.fillStyle='rgba(255,255,255,.03)';rr(zx,zy,zw,zh,12);c.fill();
       c.strokeStyle=col+'66';c.lineWidth=1.5;rr(zx,zy,zw,zh,12);c.stroke();
       // 大型透かしロゴ（V）
       const wmFs=Math.min(zh*1.0,zw*.30);
       c.font=`800 ${wmFs}px "Syne",sans-serif`;c.fillStyle=col+'12';c.textAlign='right';c.textBaseline='middle';
       c.fillText(vdata.wm||'V',zx+zw-zh*.05,zy+zh*.5);
       // ── 03 番号 + VALUES ラベル を横並び（同じ行） ──
       const vnfs=zh*.14;
       const vlblFs=zh*.045;
       c.font=`800 ${vnfs}px "Syne",sans-serif`;
       c.fillStyle=col;c.textAlign='left';c.textBaseline='alphabetic';
       const vnumTxt=vdata.num||'03';
       const vheaderBaseY=zy+zh*.16;
       c.fillText(vnumTxt,zx+zw*.025,vheaderBaseY);
       const vnumW=c.measureText(vnumTxt).width;
       c.font=`bold ${vlblFs}px "Press Start 2P",monospace`;
       c.fillStyle=col;c.textBaseline='alphabetic';
       c.fillText(vdata.label||'VALUES',zx+zw*.025+vnumW+zw*.018,vheaderBaseY-vlblFs*0.10);
       // 5項目リスト（ヘッダー圧縮で listTop を上にシフト → 各項目に余裕）
       const items=(vdata.items||[]).slice(0,5);
       const listTop=zy+zh*.21;
       const listH=zh*.76;
       const perItem=listH/Math.max(items.length,5);
       const tfs=Math.max(16,Math.min(zw*.024,perItem*.38));
       const dfs=Math.max(14,Math.min(zw*.020,perItem*.32));
       const titleLh=tfs*1.35;
       items.forEach((it,i)=>{
         const iy=listTop+i*perItem;
         // ▸ marker
         c.font=`bold ${tfs}px "Noto Sans JP",sans-serif`;c.fillStyle=col;c.textAlign='left';c.textBaseline='top';
         c.fillText('▸',zx+zw*.025,iy+perItem*.08);
         // title (bold white)
         c.fillStyle='#fff';
         let tTxt=it.title||'';
         const tMaxW=zw*.92;
         if(c.measureText(tTxt).width>tMaxW){
           let t='';for(const ch of tTxt){if(c.measureText(t+ch+'…').width>tMaxW)break;t+=ch}
           tTxt=t+'…';
         }
         c.fillText(tTxt,zx+zw*.055,iy+perItem*.08);
         // desc (small muted) - title の直下にタイトに配置
         c.font=`${dfs}px "Noto Sans JP",sans-serif`;c.fillStyle='rgba(255,255,255,.55)';c.textBaseline='top';
         let dTxt=it.desc||'';
         const dMaxW=zw*.92;
         if(c.measureText(dTxt).width>dMaxW){
           let t='';for(const ch of dTxt){if(c.measureText(t+ch+'…').width>dMaxW)break;t+=ch}
           dTxt=t+'…';
         }
         c.fillText(dTxt,zx+zw*.055,iy+perItem*.08+titleLh);
       });
       c.restore();
     });
 }
},

/* ─── STAGE 3: WHY US (index.html #sec-reason / 選ばれる5つの理由) ─── */
/* 5つの理由カードを縦並びフルワイドで配置（HTMLの読み順を再現） */
{idx:2,name:'STAGE 3',sub:'WHY US',col:'#d95f1a',isBoss:false,hF:.94,spd:1.10,
 mkZ(bw,bh){return[
   {id:'chip',  rx:.04, ry:.01, rw:.40, rh:.045, hp:2,mhp:2},
   {id:'title', rx:.04, ry:.065,rw:.70, rh:.07,  hp:3,mhp:3},
   // 5理由カード（縦並びフルワイド）
   {id:'r1',    rx:.03, ry:.16, rw:.94, rh:.155, hp:3,mhp:3},
   {id:'r2',    rx:.03, ry:.325,rw:.94, rh:.155, hp:3,mhp:3},
   {id:'r3',    rx:.03, ry:.49, rw:.94, rh:.155, hp:3,mhp:3},
   {id:'r4',    rx:.03, ry:.655,rw:.94, rh:.155, hp:3,mhp:3},
   {id:'r5',    rx:.03, ry:.82, rw:.94, rh:.155, hp:3,mhp:3}
 ]},
 draw(bx,by,bw,bh,zr,hideBg){
   if(!hideBg){
     c.fillStyle='rgba(8,4,18,.95)';rr(bx,by,bw,bh,14);c.fill();
     c.strokeStyle='rgba(217,95,26,.22)';c.lineWidth=1.5;rr(bx,by,bw,bh,14);c.stroke();
   }
   const o=gc.o||{};

   // ── chip "● WHY TRITECH"（index.html #sec-reason .sec-chip から取得） ──
   withRev(zr.chip,
     ()=>greyBox(bx+bw*.04,by+bh*.01,bw*.40,bh*.045,[[.7]]),
     ()=>{
       const cx=bx+bw*.04, cy=by+bh*.01, cw=bw*.40, ch=bh*.045;
       c.fillStyle='rgba(217,95,26,.18)';rr(cx,cy,cw,ch,ch*.5);c.fill();
       c.strokeStyle='#d95f1a';c.lineWidth=1.5;rr(cx,cy,cw,ch,ch*.5);c.stroke();
       c.fillStyle='#d95f1a';c.beginPath();c.arc(cx+ch*.55,cy+ch*.5,ch*.18,0,Math.PI*2);c.fill();
       c.font=`bold ${ch*.42}px "Noto Sans JP",sans-serif`;c.fillStyle='#d95f1a';c.textAlign='left';c.textBaseline='middle';
       c.fillText(o.chip||'WHY TRITECH',cx+ch*1.0,cy+ch*.55);
     });

   // ── title「トライテックを選ぶ5つの理由」（index.html #sec-reason .sec-title から取得） ──
   withRev(zr.title,
     ()=>greyBox(bx+bw*.04,by+bh*.065,bw*.70,bh*.07,[[.75]]),
     ()=>{
       c.font=`800 ${bh*.050}px "Syne","Noto Sans JP",sans-serif`;c.fillStyle='#fff';c.textAlign='left';c.textBaseline='top';
       c.fillText(o.title||'トライテックを選ぶ5つの理由',bx+bw*.04,by+bh*.070);
       c.fillStyle='#d95f1a';c.fillRect(bx+bw*.04,by+bh*.135,bw*.08,3);
     });

   // ── 5理由カード（縦並び） ──
   const cardIds=['r1','r2','r3','r4','r5'];
   const cardYs=[.16,.325,.49,.655,.82];
   (o.rows||[]).slice(0,5).forEach((row,i)=>{
     const zid=cardIds[i];
     const zx=bx+bw*.03, zy=by+bh*cardYs[i], zw=bw*.94, zh=bh*.155;
     withRev(zr[zid],
       ()=>greyBox(zx,zy,zw,zh,[[.45],[.85],[.7],[.55]]),
       ()=>{
         c.save();rr(zx,zy,zw,zh,12);c.clip();
         // 背景 + 枠
         c.fillStyle='rgba(255,255,255,.04)';rr(zx,zy,zw,zh,12);c.fill();
         c.strokeStyle='#d95f1a55';c.lineWidth=1.5;rr(zx,zy,zw,zh,12);c.stroke();
         // 左サイドの縦アクセントバー（太い1本）
         c.fillStyle='#d95f1a';c.fillRect(zx,zy,4,zh);

         // 左サイドの装飾アイコンは削除（テキストスペース確保のため）
         // 細い縦アクセントバー（先に描画した zx の 4px バー）のみ残す

         // コンテンツエリア（左端寄せ・最大幅活用）
         const contentX=zx+zw*.030;
         const contentW=zw*.94;

         // ── POINT 0X ラベル + タイトルを同一行に配置 ──
         const lfs=Math.max(11,Math.min(zh*.16,zw*.013));
         const lfont=`bold ${lfs}px "Press Start 2P",monospace`;
         c.font=lfont;c.fillStyle='#d95f1a';c.textBaseline='middle';c.textAlign='left';
         const labelTxt=row.label||('POINT 0'+(i+1));
         const labelW=c.measureText(labelTxt).width;
         const labelGap=zw*.020; // ラベルとタイトルの間隔
         const headerY=zy+zh*.20; // 1行目の縦中央
         c.fillText(labelTxt,contentX,headerY);

         // タイトル（POINT ラベルの右隣に配置）
         const tfs=Math.max(15,Math.min(zh*.22,zw*.022));
         const tfont=`bold ${tfs}px "Noto Sans JP",sans-serif`;
         c.font=tfont;c.fillStyle='#fff';c.textBaseline='middle';
         const titleX=contentX+labelW+labelGap;
         const titleMaxW=contentW-labelW-labelGap;
         let titleTxt=row.val||'';
         if(c.measureText(titleTxt).width>titleMaxW){
           let t='';for(const ch of titleTxt){if(c.measureText(t+ch+'…').width>titleMaxW)break;t+=ch}
           titleTxt=t+'…';
         }
         c.fillText(titleTxt,titleX,headerY);

         // ── 本文（最大3行で折返し・拡大したスペースを活用） ──
         const bfs=Math.max(13,Math.min(zh*.18,zw*.018));
         const bfont=`${bfs}px "Noto Sans JP",sans-serif`;
         c.font=bfont;c.fillStyle='rgba(255,255,255,.70)';c.textBaseline='top';
         const bodyLines=fitLines(row.body||'',bfont,contentW).slice(0,3);
         bodyLines.forEach((l,li)=>c.fillText(l,contentX,zy+zh*.40+li*bfs*1.5));
         c.restore();
       });
   });
 }
},

/* ─── STAGE 4: DATA (数字で見るトライテック) ─── */
/* 6つの数値カードを 3×2 グリッドで配置（HTMLレイアウトに準拠） */
{idx:3,name:'STAGE 4',sub:'DATA',col:'#b07830',isBoss:false,hF:.88,spd:1.08,
 mkZ(bw,bh){return[
   {id:'chip',  rx:.04, ry:.02, rw:.28, rh:.055, hp:2,mhp:2},
   {id:'title', rx:.04, ry:.09, rw:.92, rh:.08,  hp:3,mhp:3},
   // 上段 3カード
   {id:'s1', rx:.025,ry:.20,rw:.30, rh:.36,hp:3,mhp:3},
   {id:'s2', rx:.345,ry:.20,rw:.30, rh:.36,hp:3,mhp:3},
   {id:'s3', rx:.665,ry:.20,rw:.30, rh:.36,hp:3,mhp:3},
   // 下段 3カード
   {id:'s4', rx:.025,ry:.60,rw:.30, rh:.36,hp:3,mhp:3},
   {id:'s5', rx:.345,ry:.60,rw:.30, rh:.36,hp:3,mhp:3},
   {id:'s6', rx:.665,ry:.60,rw:.30, rh:.36,hp:3,mhp:3},
 ]},
 draw(bx,by,bw,bh,zr,hideBg){
   const h=gc.h||{};
   if(!hideBg){c.fillStyle='rgba(8,4,18,.95)';rr(bx,by,bw,bh,14);c.fill();c.strokeStyle='rgba(176,120,48,.22)';c.lineWidth=1.5;rr(bx,by,bw,bh,14);c.stroke();}

   // ── chip "● DATA"（index.html #data .s-chip から取得） ──
   withRev(zr.chip,
     ()=>greyBox(bx+bw*.04,by+bh*.02,bw*.28,bh*.055,[[.7]]),
     ()=>{
       const cx=bx+bw*.04, cy=by+bh*.02, cw=bw*.28, ch=bh*.055;
       c.fillStyle='rgba(217,95,26,.18)';rr(cx,cy,cw,ch,ch*.5);c.fill();
       c.strokeStyle='#d95f1a';c.lineWidth=1.5;rr(cx,cy,cw,ch,ch*.5);c.stroke();
       c.fillStyle='#d95f1a';c.beginPath();c.arc(cx+ch*.55,cy+ch*.5,ch*.18,0,Math.PI*2);c.fill();
       c.font=`bold ${ch*.42}px "Noto Sans JP",sans-serif`;c.fillStyle='#d95f1a';c.textAlign='left';c.textBaseline='middle';
       c.fillText((h.chip||'Data').toUpperCase(),cx+ch*1.0,cy+ch*.55);
     });

   // ── title「数字で見るトライテック」（index.html #data .s-title から取得） ──
   withRev(zr.title,
     ()=>greyBox(bx+bw*.04,by+bh*.09,bw*.92,bh*.08,[[.7]]),
     ()=>{
       c.font=`800 ${bh*.055}px "Syne","Noto Sans JP",sans-serif`;c.fillStyle='#fff';c.textAlign='left';c.textBaseline='top';
       c.fillText(h.title||'数字で見るトライテック',bx+bw*.04,by+bh*.095);
       c.fillStyle='#d95f1a';c.fillRect(bx+bw*.04,by+bh*.165,bw*.08,3);
     });
   // ── 6数値カード ──
   const cardIds=['s1','s2','s3','s4','s5','s6'];
   const colors=['#E07830','#44AADB','#ffcc44','#E07830','#44AADB','#ffcc44'];
   const positions=[
     [.025,.20],[.345,.20],[.665,.20],
     [.025,.60],[.345,.60],[.665,.60]
   ];
   (h.events||[]).slice(0,6).forEach((ev,i)=>{
     const id=cardIds[i];
     const [px,py]=positions[i];
     const cx=bx+bw*px, cy=by+bh*py, cw=bw*.30, ch=bh*.36, col=colors[i];
     withRev(zr[id],
       ()=>greyBox(cx,cy,cw,ch,[[.6]]),
       ()=>{
         c.save();rr(cx,cy,cw,ch,14);c.clip();
         c.fillStyle='rgba(255,255,255,.04)';rr(cx,cy,cw,ch,14);c.fill();
         c.strokeStyle=col+'66';c.lineWidth=1.5;rr(cx,cy,cw,ch,14);c.stroke();

         // ── 大きな数字 + 単位（カード幅に収まるよう動的スケール） ──
         const numTxt=ev.title||'';
         const unitTxt=ev.unit||'';
         // 希望サイズ（最大）: カード幅・高さ両方を考慮
         let nfs=Math.min(cw*.42,ch*.46);
         let ufs=nfs*.32;
         const gap=cw*.015;
         // 計測してオーバーフローしたら縮小
         const avail=cw*.86; // カード内の利用可能幅
         c.font=`800 ${nfs}px "Syne",sans-serif`;
         let numW=c.measureText(numTxt).width;
         c.font=`bold ${ufs}px "Noto Sans JP",sans-serif`;
         let unitW=c.measureText(unitTxt).width;
         let totalW=numW+gap+unitW;
         if(totalW>avail){
           const scale=avail/totalW;
           nfs*=scale; ufs*=scale;
           c.font=`800 ${nfs}px "Syne",sans-serif`;
           numW=c.measureText(numTxt).width;
           c.font=`bold ${ufs}px "Noto Sans JP",sans-serif`;
           unitW=c.measureText(unitTxt).width;
           totalW=numW+gap+unitW;
         }
         const startX=cx+cw/2-totalW/2;
         const baseY=cy+ch*.58;
         c.fillStyle=col;c.textAlign='left';c.textBaseline='alphabetic';
         // 数字
         c.font=`800 ${nfs}px "Syne",sans-serif`;
         c.fillText(numTxt,startX,baseY);
         // 単位（数字より小さく、ベースライン揃え）
         c.font=`bold ${ufs}px "Noto Sans JP",sans-serif`;
         c.fillText(unitTxt,startX+numW+gap,baseY);

         // ── ラベル（社員数 / 定着率 など） ──
         const lfs=Math.min(cw*.085,ch*.10);
         c.font=`${lfs}px "Noto Sans JP",sans-serif`;c.fillStyle='rgba(255,255,255,.7)';c.textAlign='center';c.textBaseline='top';
         c.fillText(ev.text||'',cx+cw/2,cy+ch*.74);
         c.restore();
       });
   });
 }
},

/* ─── STAGE 5: REWARD (index.html #sec-reward / 報酬が決まる仕組み) ─── */
/* 4ステップフロー（STEP01→STEP02→STEP03→RESULT）と締め文 */
{idx:4,name:'STAGE 5',sub:'REWARD',col:'#d95f1a',isBoss:false,hF:.90,spd:1.14,
 mkZ(bw,bh){return[
   {id:'chip',  rx:.04, ry:.02, rw:.45, rh:.055, hp:2,mhp:2},
   {id:'title', rx:.04, ry:.09, rw:.92, rh:.10,  hp:3,mhp:3},
   // 4ステップ（横並び）
   {id:'step1', rx:.04, ry:.24, rw:.20, rh:.36,  hp:3,mhp:3},
   {id:'step2', rx:.28, ry:.24, rw:.20, rh:.36,  hp:3,mhp:3},
   {id:'step3', rx:.52, ry:.24, rw:.20, rh:.36,  hp:3,mhp:3},
   {id:'result',rx:.76, ry:.24, rw:.20, rh:.36,  hp:4,mhp:4},
   // 締め文
   {id:'note',  rx:.04, ry:.64, rw:.92, rh:.33,  hp:3,mhp:3}
 ]},
 draw(bx,by,bw,bh,zr,hideBg){
   const r=gc.r||{};
   if(!hideBg){
     c.fillStyle='rgba(8,4,18,.95)';rr(bx,by,bw,bh,14);c.fill();
     c.strokeStyle='rgba(217,95,26,.22)';c.lineWidth=1.5;rr(bx,by,bw,bh,14);c.stroke();
   }

   // ── chip "● REWARD STRUCTURE" ──
   withRev(zr.chip,
     ()=>greyBox(bx+bw*.04,by+bh*.02,bw*.45,bh*.055,[[.7]]),
     ()=>{
       const cx=bx+bw*.04, cy=by+bh*.02, cw=bw*.45, ch=bh*.055;
       c.fillStyle='rgba(217,95,26,.18)';rr(cx,cy,cw,ch,ch*.5);c.fill();
       c.strokeStyle='#d95f1a';c.lineWidth=1.5;rr(cx,cy,cw,ch,ch*.5);c.stroke();
       c.fillStyle='#d95f1a';c.beginPath();c.arc(cx+ch*.55,cy+ch*.5,ch*.18,0,Math.PI*2);c.fill();
       c.font=`bold ${ch*.40}px "Noto Sans JP",sans-serif`;c.fillStyle='#d95f1a';c.textAlign='left';c.textBaseline='middle';
       c.fillText((r.chip||'REWARD STRUCTURE').toUpperCase(),cx+ch*1.0,cy+ch*.55);
     });

   // ── title "報酬が決まる仕組み、すべてお見せします。" ──
   withRev(zr.title,
     ()=>greyBox(bx+bw*.04,by+bh*.09,bw*.92,bh*.10,[[.75],[.6]]),
     ()=>{
       // タイトルが長いので 2 行折返し可能に
       const tfs=Math.min(bh*.048,bw*.034);
       const tfont=`800 ${tfs}px "Syne","Noto Sans JP",sans-serif`;
       c.font=tfont;c.fillStyle='#fff';c.textAlign='left';c.textBaseline='top';
       const tlines=fitLines(r.title||'報酬が決まる仕組み、すべてお見せします。',tfont,bw*.90).slice(0,2);
       tlines.forEach((l,li)=>c.fillText(l,bx+bw*.04,by+bh*.10+li*tfs*1.25));
       // アンダーバー
       c.fillStyle='#d95f1a';c.fillRect(bx+bw*.04,by+bh*.10+tlines.length*tfs*1.25+bh*.005,bw*.08,3);
     });

   // ── 矢印（装飾、常時表示） ──
   const arrowY=by+bh*.42;
   const arrowSize=Math.min(bh*.06,bw*.035);
   c.font=`bold ${arrowSize}px "Press Start 2P","Noto Sans JP",sans-serif`;
   c.fillStyle='rgba(217,95,26,.65)';c.textAlign='center';c.textBaseline='middle';
   [bx+bw*.26, bx+bw*.50, bx+bw*.74].forEach(ax=>c.fillText('→',ax,arrowY));

   // ── 4ステップカード描画ヘルパー ──
   function drawStepCard(rev,step,sx,sy,sw,sh,isFinal,labelFs){
     const col=isFinal?'#ffcc44':'#d95f1a';
     withRev(rev,
       ()=>greyBox(sx,sy,sw,sh,[[.4],[.65],[.8]]),
       ()=>{
         c.save();rr(sx,sy,sw,sh,12);c.clip();
         if(isFinal){
           // RESULT: 強調背景 + 太い枠
           c.fillStyle='rgba(255,204,68,.13)';rr(sx,sy,sw,sh,12);c.fill();
           c.strokeStyle=col;c.lineWidth=2.5;rr(sx,sy,sw,sh,12);c.stroke();
           // 上下ハイライトライン
           c.fillStyle=col;c.fillRect(sx,sy,sw,3);c.fillRect(sx,sy+sh-3,sw,3);
         } else {
           c.fillStyle='rgba(255,255,255,.04)';rr(sx,sy,sw,sh,12);c.fill();
           c.strokeStyle=col+'66';c.lineWidth=1.5;rr(sx,sy,sw,sh,12);c.stroke();
           // 上アクセントライン
           c.fillStyle=col;c.fillRect(sx,sy,sw,3);
         }
         // 上部: STEP 番号 or RESULT
         const nfs=Math.min(sw*.13,sh*.10);
         c.font=`bold ${nfs}px "Press Start 2P",monospace`;c.fillStyle=col;c.textAlign='center';c.textBaseline='top';
         c.fillText(step.num||'',sx+sw/2,sy+sh*.15);
         // 中央: ラベル（1行表示・縦中央寄せ）
         const lfont=`bold ${labelFs}px "Noto Sans JP",sans-serif`;
         c.font=lfont;c.fillStyle=isFinal?'#ffcc44':'#fff';
         c.textAlign='center';c.textBaseline='middle';
         c.fillText(step.label||'',sx+sw/2,sy+sh*.66);
         c.restore();
       });
   }
   const steps=r.steps||[];
   const stepZids=[zr.step1,zr.step2,zr.step3,zr.result];
   const stepXs=[.04,.28,.52,.76];
   // 全STEPで統一されたラベルフォントサイズを計算
   // （最も長いラベルがカード幅(余白込み)に1行で収まるサイズを選ぶ）
   const cardW=bw*.20, cardH=bh*.36;
   const maxLabelW=cardW*.86;
   let unifiedLabelFs=Math.min(cardW*.14,cardH*.12); // 希望サイズ
   steps.forEach(step=>{
     c.font=`bold ${unifiedLabelFs}px "Noto Sans JP",sans-serif`;
     const w=c.measureText(step.label||'').width;
     if(w>maxLabelW){
       unifiedLabelFs=unifiedLabelFs*(maxLabelW/w);
     }
   });
   stepZids.forEach((zid,i)=>{
     const data=steps[i]||{};
     const sx=bx+bw*stepXs[i], sy=by+bh*.24, sw=bw*.20, sh=bh*.36;
     drawStepCard(zid,data,sx,sy,sw,sh,!!data.isFinal,unifiedLabelFs);
   });

   // ── 締め文（reward-note） ──
   withRev(zr.note,
     ()=>greyBox(bx+bw*.04,by+bh*.64,bw*.92,bh*.33,[[.9],[.85],[.7],[.55]]),
     ()=>{
       const fs=Math.min(bw*.020,bh*.027);
       const font=`${fs}px "Noto Sans JP",sans-serif`;
       c.font=font;
       const lines=fitLines(r.note||'',font,bw*.86).slice(0,6);
       const lh=fs*1.7;
       const textTopY=by+bh*.68;
       // 実際のテキスト行数に合わせて左ボーダーの高さを動的計算
       const textActualH=(lines.length-1)*lh+fs*1.1;
       c.fillStyle='#d95f1a';
       c.fillRect(bx+bw*.04,textTopY-fs*.25,3,textActualH+fs*.5);
       // テキスト描画
       c.fillStyle='rgba(255,255,255,.65)';c.textAlign='left';c.textBaseline='top';
       lines.forEach((l,li)=>c.fillText(l,bx+bw*.07,textTopY+li*lh));
     });
 }
},

/* ─── BOSS: about-detail.html #sec-ceo の「写真カード」のみ表示 ───
   STAGE プレイ中は代表者の顔写真+CEOキャプションのみ。
   メッセージ本文はクリア後のスクロールエンディングで流す。 */
{idx:5,name:'BOSS',sub:'',col:'#ff2244',isBoss:true,hF:.92,spd:.84,
 mkZ(bw,bh){return[
   {id:'bhdr',  rx:.03, ry:.02, rw:.94, rh:.07, hp:8, mhp:8},
   // 写真を縦長にして頭の見切れを防ぐ（rw を狭めて 3:4 縦長比率に近づける）
   {id:'photo', rx:.27, ry:.11, rw:.46, rh:.85, hp:30,mhp:30}
 ]},
 draw(bx,by,bw,bh,zr,hideBg){
   c.save();
   rr(bx,by,bw,bh,16);c.clip();
   const ceo=gc.ceo||{};
   if(!hideBg){
     c.fillStyle='rgba(20,0,8,.97)';rr(bx,by,bw,bh,16);c.fill();
     c.strokeStyle='rgba(255,34,68,.3)';c.lineWidth=2;rr(bx,by,bw,bh,16);c.stroke();
   }

   // ── BOSS ヘッダーバナー（脈動する赤背景） ──
   withRev(zr.bhdr,
     ()=>greyBox(bx+bw*.03,by+bh*.02,bw*.94,bh*.07,[[.7]]),
     ()=>{
       const hx=bx+bw*.03, hy=by+bh*.02, hw=bw*.94, hh=bh*.07;
       const pulse=(Math.sin(frame*.10)+1)*.5;
       c.fillStyle=`rgba(255,34,68,${.16+pulse*.14})`;
       rr(hx,hy,hw,hh,8);c.fill();
       c.strokeStyle='#ff2244';c.lineWidth=1.5;rr(hx,hy,hw,hh,8);c.stroke();
       // CEO本人の役職+名前を表示（HTMLの .ceo-photo-cap small に対応）
       const bhdrRole=(ceo.role||'代表取締役').replace(/\s*CEO\s*$/i,'');
       const bhdrName=ceo.name||'清水 幸秀';
       c.font=`bold ${Math.min(hh*.50,bw*.028)}px "Noto Sans JP",sans-serif`;
       c.fillStyle='#ff2244';c.textAlign='center';c.textBaseline='middle';
       c.fillText(bhdrRole+'  '+bhdrName,hx+hw/2,hy+hh*.5);
     });

   // ── 写真カード（中央大型・縦長 3:4 でポートレート向き）──
   withRev(zr.photo,
     ()=>greyBox(bx+bw*.27,by+bh*.11,bw*.46,bh*.85,[[.55],[.85],[.7],[.6]]),
     ()=>{
       const px=bx+bw*.27, py=by+bh*.11, pw=bw*.46, ph=bh*.85;
       c.save();
       rr(px,py,pw,ph,12);c.clip();

       // 写真画像（cover-crop, 縦方向は上寄せ＝頭が切れないように） ──
       if(ceoPhotoOK && ceoPhotoImg){
         const imgR=ceoPhotoImg.naturalWidth/ceoPhotoImg.naturalHeight;
         const boxR=pw/ph;
         let dx,dy,dw,dh;
         if(imgR>boxR){
           // 元画像が枠より横長 → 高さフィット、左右にはみ出る分は中央クロップ
           dh=ph; dw=ph*imgR;
           dx=px-(dw-pw)/2; dy=py;
         } else {
           // 元画像が枠より縦長 → 幅フィット、上端を保持して下にはみ出す
           // （顔写真は頭が上にあるため上寄せで頭が見切れない）
           dw=pw; dh=pw/imgR;
           dx=px; dy=py;
         }
         // 軽くグレースケール処理（HTMLの filter:grayscale(.15) を再現）
         try{c.filter='grayscale(15%)';}catch(e){}
         c.drawImage(ceoPhotoImg,dx,dy,dw,dh);
         try{c.filter='none';}catch(e){}
       } else {
         // 画像読込前/失敗時のフォールバック
         const g=c.createLinearGradient(px,py,px,py+ph);
         g.addColorStop(0,'rgba(80,15,30,.95)');
         g.addColorStop(1,'rgba(20,0,8,.95)');
         c.fillStyle=g;c.fillRect(px,py,pw,ph);
         c.font=`bold ${ph*.22}px "Syne",sans-serif`;
         c.fillStyle='rgba(255,34,68,.7)';c.textAlign='center';c.textBaseline='middle';
         const init=(ceo.name||'').replace(/\s+/g,'').substring(0,2)||'CEO';
         c.fillText(init,px+pw/2,py+ph*.40);
       }

       // 下部グラデーション（キャプション可読性）
       const grad=c.createLinearGradient(0,py+ph*.50,0,py+ph);
       grad.addColorStop(0,'rgba(0,0,0,0)');
       grad.addColorStop(1,'rgba(0,0,0,.82)');
       c.fillStyle=grad;c.fillRect(px,py,pw,ph);

       // CEO バッジ + 名前キャプション
       c.textAlign='left';c.textBaseline='bottom';
       c.font=`bold ${Math.min(pw*.060,ph*.065)}px "Syne",sans-serif`;
       c.fillStyle='rgba(255,255,255,.96)';
       c.fillText('CEO',px+pw*.06,py+ph*.91);
       c.font=`bold ${Math.min(pw*.038,ph*.044)}px "Noto Sans JP",sans-serif`;
       c.fillStyle='rgba(255,255,255,.75)';
       const roleClean=(ceo.role||'代表取締役').replace(/\s*CEO\s*$/i,'');
       c.fillText(roleClean+'  '+(ceo.name||'清水 幸秀'),px+pw*.06,py+ph*.97);

       c.restore();
       // 外枠
       c.strokeStyle='#ff2244';c.lineWidth=2.5;
       rr(px,py,pw,ph,12);c.stroke();
       // 角の装飾コーナーマーク（ロックオン感）
       const corner=Math.min(pw,ph)*.05;
       c.strokeStyle='#ff2244';c.lineWidth=3;
       c.beginPath();
       c.moveTo(px-2,py+corner);c.lineTo(px-2,py-2);c.lineTo(px+corner,py-2);
       c.moveTo(px+pw+2,py+corner);c.lineTo(px+pw+2,py-2);c.lineTo(px+pw-corner,py-2);
       c.moveTo(px-2,py+ph-corner);c.lineTo(px-2,py+ph+2);c.lineTo(px+corner,py+ph+2);
       c.moveTo(px+pw+2,py+ph-corner);c.lineTo(px+pw+2,py+ph+2);c.lineTo(px+pw-corner,py+ph+2);
       c.stroke();
     });

   c.restore();
 }
},

]; // end STAGES

/* ══ BLOCK INIT ══ */
function initBlock(){
  const st=STAGES[stageIdx];
  // 全ステージ外枠を統一サイズに
  // 高さ：バナー下端〜機体上端まで（画面サイズに合わせて動的計算）
  const bannerH=54+4+52+14; // HUD+バナー ≈ 124px
  const playerTop=H-100;    // 機体の上端付近
  const bw=Math.min(W*.90,880);
  const bh=playerTop-bannerH; // バナーから機体直上まで
  const bx=(W-bw)/2;
  blk={bx,by:-bh-10,bw,bh,spd:st.spd,
    zones:st.mkZ(bw,bh).map(z=>({...z,ax:0,ay:0,aw:z.rw*bw,ah:z.rh*bh})),
    osc:0,bossShotT:0,done:false};
  bProj=[];
  document.getElementById('gstg').textContent=st.sub?st.name+' · '+st.sub:st.name;
}
function revOf(z){return 1-z.hp/z.mhp}

/* ══ LOGO ══ */
function loadLogo(cb){
  if(logoOK){cb();return}
  logoImg=new Image();logoImg.onload=()=>{logoOK=true;cb()};logoImg.onerror=()=>{logoOK=true;cb()};logoImg.src='/assets/images/logo/tritech-logo.png';
}

/* ══ OPEN ══ */
/* ── モバイル検出 / フルスクリーン / 横向きロック ── */
function isMobileDevice(){
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent)
    || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
}

function enterMobileFullscreen(){
  if(!isMobileDevice())return;
  // iOS Safari の "address bar" を可能な限り隠すためスクロール（古典的トリック）
  try{window.scrollTo(0,1);}catch(e){}
  // OV（game-overlay）でフルスクリーン要求（一部端末で要素単位の方が成功率高い）
  const candidates=[OV, document.documentElement, document.body];
  let requested=false;
  for(const el of candidates){
    if(!el)continue;
    const req=el.requestFullscreen||el.webkitRequestFullscreen||el.webkitEnterFullscreen||el.msRequestFullscreen;
    if(req){
      try{
        const p=req.call(el);
        requested=true;
        if(p&&p.then){
          p.then(()=>tryLockLandscape()).catch(e=>{console.warn('[game] fullscreen failed',e);tryLockLandscape();});
        } else {
          tryLockLandscape();
        }
        break;
      }catch(e){
        console.warn('[game] fullscreen try error',el.id||el.tagName,e);
      }
    }
  }
  if(!requested)tryLockLandscape();
}

function tryLockLandscape(){
  try{
    if(screen.orientation && screen.orientation.lock){
      const p=screen.orientation.lock('landscape');
      if(p&&p.catch)p.catch(e=>{console.warn('[game] orientation lock failed',e);});
    }
  } catch(e){
    console.warn('[game] orientation lock error',e);
  }
}

function exitMobileFullscreen(){
  try{
    if(screen.orientation && screen.orientation.unlock){
      screen.orientation.unlock();
    }
  }catch(e){}
  try{
    if(document.fullscreenElement || document.webkitFullscreenElement){
      const exit=document.exitFullscreen||document.webkitExitFullscreen||document.msExitFullscreen;
      if(exit)exit.call(document);
    }
  }catch(e){}
}

/* ── 縦向き時の「画面を横にしてください」オーバーレイ ── */
let rotateOverlay=null;
function ensureRotateOverlay(){
  if(rotateOverlay)return rotateOverlay;
  rotateOverlay=document.createElement('div');
  rotateOverlay.id='rotate-overlay';
  rotateOverlay.innerHTML=
    '<div class="rotate-icon"></div>'+
    '<div class="rotate-title">ROTATE DEVICE</div>'+
    '<div class="rotate-sub">画面を横向きにしてください</div>'+
    '<div class="rotate-sub2">横向きでゲームが始まります</div>';
  document.body.appendChild(rotateOverlay);
  return rotateOverlay;
}

function checkOrientation(){
  if(!OV.classList.contains('active'))return;
  if(!isMobileDevice())return;
  ensureRotateOverlay();
  const isPortrait=window.innerHeight>window.innerWidth;
  rotateOverlay.classList.toggle('show',isPortrait);
}

window.addEventListener('orientationchange',()=>{
  // 端末回転時はビューポートサイズの確定までに遅延があるので、
  // キャッシュをクリアしつつ複数タイミングで resize を強制実行する
  _lastCssW=-1;_lastCssH=-1;
  resize();
  setTimeout(()=>{_lastCssW=-1;_lastCssH=-1;resize();checkOrientation()},50);
  setTimeout(()=>{_lastCssW=-1;_lastCssH=-1;resize();checkOrientation()},250);
  setTimeout(()=>{_lastCssW=-1;_lastCssH=-1;resize();checkOrientation()},600);
});
window.addEventListener('resize',()=>{checkOrientation()});

function openGame(){
  initAC();
  // モバイルはまずフルスクリーン+横向きロック（ユーザージェスチャー内で実行）
  enterMobileFullscreen();
  loadLogo(()=>{
    // ページをフェードアウト
    const pageFade=document.createElement('div');
    pageFade.style.cssText='position:fixed;inset:0;background:#000;opacity:0;z-index:8900;pointer-events:none;transition:opacity 0.5s ease';
    document.body.appendChild(pageFade);
    pageFade.getBoundingClientRect();
    requestAnimationFrame(()=>{pageFade.style.opacity='1';});

    setTimeout(()=>{
      // ゲームオーバーレイを即座に不透明で表示（フェードなし）
      // pageFadeはゲームオーバーレイの下に残るので一瞬元画面が見えない
      OV.style.transition='none';
      OV.style.opacity='1';
      OV.classList.add('active');
      document.body.style.overflow='hidden';
      // transitionを復元（closeGame時のフェードアウト用）
      requestAnimationFrame(()=>{ OV.style.transition=''; });
      pageFade.remove(); // オーバーレイが覆った後に安全に削除
      // extractContent() でエラーが起きてもゲーム起動を止めない（防御策）
      try{ extractContent(); }
      catch(e){ console.error('[game] extractContent failed, using defaults',e); applyDefaults(); }
      state='intro';introTimer=0;frame=0;score=0;lives=3;
      initStars();resize();getGrid();updateHUD();
      checkOrientation(); // 縦向きならオーバーレイ表示
      if(!rafID)rafID=requestAnimationFrame(loop);
    },550);
  });
}
function startOverlay(){
  extractContent(); // ← HPのDOMからコンテンツを読み込む
  OV.classList.add('active');document.body.style.overflow='hidden';
  state='idle';stageIdx=0;frame=0;score=0;lives=3;
  initStars();resize();getGrid();updateHUD();
  if(!rafID)rafID=requestAnimationFrame(loop);
}
function closeGame(){
  OV.classList.remove('active');HUD.classList.remove('vis');
  document.body.style.overflow='';cancelAnimationFrame(rafID);rafID=0;state='idle';
  window._endClick=false;
  // モバイル: フルスクリーン解除 + 横向きロック解除
  exitMobileFullscreen();
  if(rotateOverlay)rotateOverlay.classList.remove('show');
}
function bindNavLogoGameBtn(){
  const nl=document.querySelector('#nav-logo-game-btn');
  if(nl&&!nl._gameBound){nl._gameBound=true;nl.addEventListener('click',()=>openGame());}
}
bindNavLogoGameBtn();
// 共通ヘッダーが後から注入されるページでは partials:loaded を待って再バインド
document.addEventListener('partials:loaded',bindNavLogoGameBtn);
document.getElementById('gesc').addEventListener('click',()=>{
  // ESC ボタンも ESC キーと同じくポータルアニメーションで離脱
  if(state!=='portal'&&state!=='intro')startPortal('home');
});

/* ══ INPUT ══ */
let cheatBuf='';
document.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='Escape'&&OV.classList.contains('active')){
    // ポータルアニメーションでホームへ離脱（Join Us / ホームボタンと同じ挙動）
    // すでにポータル中・イントロ中は無視
    if(state!=='portal'&&state!=='intro')startPortal('home');
    return;
  }
  if(e.code==='KeyH'&&(state==='clear'||state==='retry'||state==='gameover')){window.scrollTo(0,0);closeGame();return}
  if(e.code==='Space'){e.preventDefault();onAct()}
  // 裏技コマンド「kan」でステージ強制クリア
  if(state==='playing'){
    cheatBuf=(cheatBuf+e.key.toLowerCase()).slice(-3);
    if(cheatBuf==='kan'){cheatBuf='';triggerCheatClear();}
  } else {
    cheatBuf='';
  }
});
document.addEventListener('keyup',e=>{
  keys[e.code]=false;
  if((e.code==='Space')&&(state==='clear'||state==='clearing'))clearLocked=false;
});
CV.addEventListener('mouseup',()=>{if(state==='clear'||state==='clearing')clearLocked=false});
// mousemove handled below with button hover logic
CV.addEventListener('click',e=>{
  initAC();
  const r=CV.getBoundingClientRect();
  // 表示座標 → 仮想座標へ変換
  const mx=(e.clientX-r.left)*(VIRTUAL_W/r.width);
  const my=(e.clientY-r.top)*(VIRTUAL_H/r.height);
  // retry / gameover button click
  if(state==='retry'||state==='gameover'){
    const btn=retryBtns.find(b=>mx>b.x&&mx<b.x+b.w&&my>b.y&&my<b.y+b.h);
    if(btn){btn.action();return}
    return;
  }
  // ending ボタン
  if(state==='ending'){
    const btn=endingBtns.find(b=>mx>b.x&&mx<b.x+b.w&&my>b.y&&my<b.y+b.h);
    if(btn){btn.action();return}
    return;
  }
  onAct();
});
// ── タッチ操作（スマホ対応）──
let touchActive=false;
CV.addEventListener('touchstart',e=>{
  initAC();
  touchActive=true;
  const r=CV.getBoundingClientRect();
  const t=e.touches[0];
  // 表示座標 → 仮想座標
  mouseX=(t.clientX-r.left)*(VIRTUAL_W/r.width);
  // ゲーム中はタップ位置に機体を瞬間移動 + 射撃
  if(state==='playing'){
    playerX=Math.max(PW/2,Math.min(W-PW/2,mouseX));
    shoot();
  } else {
    onAct();
  }
},{passive:true});

CV.addEventListener('touchmove',e=>{
  e.preventDefault(); // スクロール防止
  if(state!=='playing')return;
  const r=CV.getBoundingClientRect();
  const t=e.touches[0];
  mouseX=(t.clientX-r.left)*(VIRTUAL_W/r.width);
  // 指を動かしながら連続射撃
  shoot();
},{passive:false});

CV.addEventListener('touchend',()=>{
  touchActive=false;
},{passive:true});
function onAct(){
  if(state==='idle')startGame();
  else if(state==='intro'){} // アニメーション中は入力無視
  else if(state==='playing')shoot();
  else if(state==='clear'&&clearTimer>150)nextStage();
  else if(state==='clearing'){}
  else if(state==='dying'){}
  else if(state==='retry'){}
  else if(state==='gameover'){}
  else if(state==='portal'){} // アニメーション中は入力無視
  else if(state==='ceoEnding')skipCeoEnding(); // クリックでスクロールを早送り→終了
  else if(state==='ending'){}
}

/* CEO エンディング（スクロールテキスト）スキップ → FULL CLEAR 画面へ */
function skipCeoEnding(){
  state='ending';endTimer=0;sEnd();
  buildEndingBtns();
  document.getElementById('gstg').textContent='FULL CLEAR!';
}

/* ══ BOSS 撃破時の激しい爆発演出 ══ */
function triggerBossExplosion(){
  if(!blk)return;
  // 巨大な多段爆発
  for(let i=0;i<80;i++){
    const a=Math.random()*Math.PI*2;
    const s=2+Math.random()*9;
    parts.push({
      x:blk.bx+blk.bw*.18+Math.random()*blk.bw*.64,
      y:blk.by+blk.bh*.10+Math.random()*blk.bh*.80,
      vx:Math.cos(a)*s,
      vy:Math.sin(a)*s-2,
      l:1, ml:60+Math.random()*80,
      r:3+Math.random()*7,
      col:['#ff4444','#ff8800','#ffcc00','#ffffff','#ff2244'][i%5],
      sq:i%4===0
    });
  }
  // 中央に大きな閃光弾
  parts.push({x:blk.bx+blk.bw/2,y:blk.by+blk.bh/2,vx:0,vy:0,l:1,ml:60,r:30,col:'#ffffff',sq:false});
  parts.push({x:blk.bx+blk.bw/2,y:blk.by+blk.bh/2,vx:0,vy:0,l:1,ml:80,r:50,col:'#ffcc44',sq:false});
  shakeF=60;
  // 重低音の爆発音
  beep(80,.9,'sawtooth',.32);
  setTimeout(()=>beep(50,1.1,'sawtooth',.28),180);
  setTimeout(()=>beep(38,1.4,'sawtooth',.22),420);
  setTimeout(()=>beep(28,1.8,'sawtooth',.18),780);
}

/* ══ START/SHOOT/NEXT ══ */
function startGame(){
  state='playing';HUD.classList.add('vis');
  playerX=W/2;playerY=H-100;
  powerUp=false;stageIdx=0;initBlock();
  [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.1,'sine',.09),i*65));
}
function shoot(){
  const interval=powerUp?60:155;
  if(performance.now()-lastShot<interval)return;
  lastShot=performance.now();
  if(powerUp){
    [-2,0,2].forEach(vx=>bullets.push({x:playerX,y:playerY-PH/2,vx}));
  } else {
    bullets.push({x:playerX,y:playerY-PH/2,vx:0});
  }
  sShoot();
}
function triggerCheatClear(){
  if(!blk)return;
  blk.zones.forEach(z=>z.hp=0);
  blk.done=true;bProj=[];
  const bannerBottom=54+4+52+14;
  blk.targetY=STAGES[stageIdx].isBoss?bannerBottom:Math.max(bannerBottom,(H-blk.bh)/2+20);
  clearLocked=true;
  state='clearing';clearPhase=0;
  sClear();score+=1000;updateHUD();
  shakeF=6;
  parts.push({x:W/2,y:H/2,vx:0,vy:-2,l:1,ml:80,r:0,col:'#00ff88',sq:false,txt:'KAN!'});
  [523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>beep(f,.1,'sine',.1),i*60));
}
function nextStage(){
  // BOSSをクリアしたか判定（stageIdxインクリメント前に記録）
  const wasBoss=STAGES[stageIdx]&&STAGES[stageIdx].isBoss;
  stageIdx++;clearTimer=0;
  if(stageIdx>=STAGES.length){
    if(wasBoss){
      // BOSS クリア後は代表メッセージスクロール演出へ
      state='ceoEnding';ceoEndingTimer=0;ceoEndingLineCache=null;
      document.getElementById('gstg').textContent='CEO MESSAGE';
      // 低音ゴーン的な開始音
      [220,180,140].forEach((f,i)=>setTimeout(()=>beep(f,.6,'sine',.18),i*200));
      return;
    }
    state='ending';endTimer=0;sEnd();
    buildEndingBtns();
    document.getElementById('gstg').textContent='FULL CLEAR!';return
  }
  if(STAGES[stageIdx].isBoss){
    state='bossIntro';bossIntroTimer=0;
    document.getElementById('gstg').textContent='BOSS';
    beep(110,.4,'sawtooth',.22);return;
  }
  state='playing';initBlock();
}

/* ══ BOSS DEFEAT ─ 撃破爆発 → 暗転 → エンドロール ══ */
function drawBossDefeat(){
  bossDefeatTimer++;
  const t=bossDefeatTimer;
  const PHASE1=70;  // 連続爆発フェーズ
  const PHASE2=130; // 暗転完了タイミング

  // 背景
  c.fillStyle='#000510';c.fillRect(0,0,W,H);
  const bgY=(frame*1.3)%55;c.save();c.translate(0,bgY);c.drawImage(getGrid(),0,-55);c.restore();
  drawStars();

  // ブロック（残像として薄く表示）
  if(blk){
    const zr={};blk.zones.forEach(z=>zr[z.id]=revOf(z));
    c.save();
    c.globalAlpha=Math.max(0,1-t/PHASE2);
    rr(blk.bx,blk.by,blk.bw,blk.bh,14);c.clip();
    STAGES[stageIdx].draw(blk.bx,blk.by,blk.bw,blk.bh,zr,true);
    c.restore();
  }

  // PHASE1: 連続爆発を追加生成
  if(t<PHASE1){
    if(t%4===0){
      const ex=blk.bx+blk.bw*.18+Math.random()*blk.bw*.64;
      const ey=blk.by+blk.bh*.10+Math.random()*blk.bh*.80;
      const cols=['#ff4444','#ff8800','#ffcc00','#fff','#ff2244'];
      explode(ex,ey,cols[Math.floor(Math.random()*cols.length)]);
      // 散発的に爆発音
      if(t%12===0)beep(120+Math.random()*200,.18,'sawtooth',.18);
    }
    // 画面の白フラッシュ（強→弱）
    if(t%18<5){
      c.fillStyle=`rgba(255,255,255,${(18-t%18)/18*.50})`;
      c.fillRect(0,0,W,H);
    }
  }

  // パーティクル/プレイヤー描画
  drawParts();
  if(t<PHASE2-30)drawPlayer();

  // PHASE2: 暗転（中央から広がる円形フェード）
  if(t>PHASE1){
    const fadeProg=Math.min(1,(t-PHASE1)/(PHASE2-PHASE1));
    // 中央から黒の円が広がる
    const maxR=Math.hypot(W,H);
    const r=maxR*fadeProg;
    const cx=W/2, cy=H/2;
    c.save();
    // まず全体を薄く黒で
    c.fillStyle=`rgba(0,0,0,${fadeProg*.5})`;
    c.fillRect(0,0,W,H);
    // 円形マスクで中央から濃く
    const grad=c.createRadialGradient(cx,cy,0,cx,cy,r);
    grad.addColorStop(0,'rgba(0,0,0,1)');
    grad.addColorStop(.6,`rgba(0,0,0,${.7*fadeProg})`);
    grad.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=grad;
    c.fillRect(0,0,W,H);
    c.restore();
  }

  // 完了 → エンドロールへ自動遷移
  if(t>=PHASE2){
    state='ceoEnding';
    ceoEndingTimer=0;
    ceoEndingLineCache=null;
    document.getElementById('gstg').textContent='CEO MESSAGE';
    [220,180,140].forEach((f,i)=>setTimeout(()=>beep(f,.6,'sine',.18),i*200));
  }
}

/* ══ CEO ENDING ─ 代表メッセージのスクロールエンディング ══ */
function buildCeoEndingLines(){
  const ceo=gc.ceo||{};
  const lines=[];
  lines.push({type:'space',h:20});
  lines.push({type:'header',text:'代表取締役からのメッセージ'});
  lines.push({type:'space',h:40});
  if(ceo.tagline){
    lines.push({type:'tagline',text:ceo.tagline});
    lines.push({type:'space',h:60});
  }
  const paras=(ceo.paragraphs&&ceo.paragraphs.length)?ceo.paragraphs:[ceo.msg1,ceo.msg2,ceo.msg3].filter(Boolean);
  paras.forEach(p=>{
    lines.push({type:'para',text:p});
    lines.push({type:'space',h:34});
  });
  lines.push({type:'space',h:30});
  // 役職は ceo.role から取得（'代表取締役 CEO' → 'CEO' 接尾辞を除去）
  const signRole=(ceo.role||'代表取締役').replace(/\s*CEO\s*$/i,'').trim()||'代表取締役';
  lines.push({type:'sign',text:signRole+'  '+(ceo.name||'清水 幸秀')});
  lines.push({type:'space',h:160});
  ceoEndingLineCache=lines;
}

function drawCeoEnding(){
  ceoEndingTimer++;
  const ceo=gc.ceo||{};

  // ─ 背景: 黒 + 星 ─
  c.fillStyle='#000510';c.fillRect(0,0,W,H);
  drawStars();

  // ─ 左側に CEO 写真カード（BOSS ステージと同じ大きさ・スタイル） ─
  // BOSS のブロックサイズと写真ゾーン比率を再現
  const blockBw=Math.min(W*.90,880);
  const bannerH=54+4+52+14;
  const playerTop=H-100;
  const blockBh=playerTop-bannerH;
  // BOSS と同じく縦長 3:5 比率（頭の見切れを防ぐ）
  const pw=blockBw*.46;
  const ph=blockBh*.85;
  // 左寄りに配置（左マージン W*.04）
  const px=W*.04;
  const py=(H-ph)/2;

  // 写真のフェードイン（代表メッセージが現れるタイミングに合わせる）
  // テキスト先頭がスクリーン下端を抜けるあたりから 50f かけてフェードイン
  const photoFadeStart=14;       // フェード開始フレーム
  const photoFadeDur=55;         // フェード時間
  const photoAlpha=Math.max(0,Math.min(1,(ceoEndingTimer-photoFadeStart)/photoFadeDur));

  if(photoAlpha>0.01){
    c.save();
    c.globalAlpha=photoAlpha;
    if(ceoPhotoOK && ceoPhotoImg){
      c.save();
      rr(px,py,pw,ph,14);c.clip();
      const imgR=ceoPhotoImg.naturalWidth/ceoPhotoImg.naturalHeight;
      const boxR=pw/ph;
      let dx,dy,dw,dh;
      if(imgR>boxR){dh=ph;dw=ph*imgR;dx=px-(dw-pw)/2;dy=py}
      else{dw=pw;dh=pw/imgR;dx=px;dy=py} // 縦長は上寄せ（頭が見切れない）
      try{c.filter='grayscale(15%)';}catch(e){}
      c.drawImage(ceoPhotoImg,dx,dy,dw,dh);
      try{c.filter='none';}catch(e){}
      // 下部グラデーション + CEO キャプション
      const grad=c.createLinearGradient(0,py+ph*.50,0,py+ph);
      grad.addColorStop(0,'rgba(0,0,0,0)');
      grad.addColorStop(1,'rgba(0,0,0,.82)');
      c.fillStyle=grad;c.fillRect(px,py,pw,ph);
      c.textAlign='left';c.textBaseline='bottom';
      c.font=`bold ${Math.min(pw*.060,ph*.065)}px "Syne",sans-serif`;
      c.fillStyle='rgba(255,255,255,.96)';
      c.fillText('CEO',px+pw*.06,py+ph*.91);
      c.font=`bold ${Math.min(pw*.038,ph*.044)}px "Noto Sans JP",sans-serif`;
      c.fillStyle='rgba(255,255,255,.75)';
      const roleClean=(ceo.role||'代表取締役').replace(/\s*CEO\s*$/i,'');
      c.fillText(roleClean+'  '+(ceo.name||'清水 幸秀'),px+pw*.06,py+ph*.97);
      c.restore();
      // 外枠
      c.strokeStyle='#ff2244';c.lineWidth=2;
      rr(px,py,pw,ph,14);c.stroke();
    } else {
      // フォールバック：枠だけ
      c.fillStyle='rgba(255,34,68,.1)';rr(px,py,pw,ph,14);c.fill();
      c.strokeStyle='#ff2244';c.lineWidth=2;rr(px,py,pw,ph,14);c.stroke();
      c.font=`bold ${ph*.20}px "Syne",sans-serif`;
      c.fillStyle='rgba(255,34,68,.7)';
      c.textAlign='center';c.textBaseline='middle';
      c.fillText((ceo.name||'').replace(/\s+/g,'').substring(0,2)||'CEO',px+pw/2,py+ph*.45);
    }
    c.restore();
  }

  // ─ 右側にスクロールテキスト ─
  if(!ceoEndingLineCache)buildCeoEndingLines();
  const lines=ceoEndingLineCache;
  // 右側カラム
  const colX=px+pw+W*.04;        // 写真の右端 + マージン
  const colW=W-colX-W*.04;        // 右端まで
  const fs=Math.max(14,Math.min(colW*.045,20));
  const headerFs=fs*1.45;
  const taglineFs=fs*1.30;
  const signFs=fs*1.15;
  const lh=fs*1.80;
  // 各行の高さ事前計算
  const positions=[];
  let cy=0;
  lines.forEach(line=>{
    const sy=cy;let h=0;
    if(line.type==='space')h=line.h;
    else if(line.type==='header')h=headerFs*1.6;
    else if(line.type==='tagline'){
      const f=`bold ${taglineFs}px "Noto Sans JP",sans-serif`;
      c.font=f;h=fitLines(line.text,f,colW).length*taglineFs*1.55;
    } else if(line.type==='sign')h=signFs*1.7;
    else {
      const f=`${fs}px "Noto Sans JP",sans-serif`;
      c.font=f;h=fitLines(line.text,f,colW).length*lh;
    }
    positions.push({sy,h,line});cy+=h;
  });
  const totalH=cy;
  // スクロール（右カラムの下から上へ）
  const scrollSpeed=1.05;
  const screenStartY=H-ceoEndingTimer*scrollSpeed;
  c.save();
  // 右カラムにクリップ（写真領域にはみ出さない）
  c.beginPath();c.rect(colX-8,0,colW+16,H);c.clip();
  c.textAlign='left';c.textBaseline='top';
  positions.forEach(p=>{
    const y=screenStartY+p.sy;
    if(y+p.h<-20||y>H+20)return;
    // 上下端フェード
    let alpha=1;
    if(y<H*.10)alpha=Math.max(0,(y+p.h-10)/(H*.18));
    if(y>H*.84)alpha=Math.max(0,(H-y)/(H*.16));
    c.globalAlpha=Math.min(1,Math.max(0,alpha));
    const line=p.line;
    if(line.type==='space')return;
    if(line.type==='header'){
      c.font=`bold ${headerFs}px "Press Start 2P",monospace`;
      c.fillStyle='#ff6644';
      c.fillText(line.text,colX,y);
    } else if(line.type==='tagline'){
      const f=`bold ${taglineFs}px "Noto Sans JP",sans-serif`;
      c.font=f;c.fillStyle='#ffcc44';
      fitLines(line.text,f,colW).forEach((wl,i)=>c.fillText(wl,colX,y+i*taglineFs*1.55));
    } else if(line.type==='sign'){
      c.font=`bold ${signFs}px "Noto Sans JP",sans-serif`;
      c.fillStyle='#ffcc44';
      c.fillText(line.text,colX,y);
    } else {
      const f=`${fs}px "Noto Sans JP",sans-serif`;
      c.font=f;c.fillStyle='rgba(255,255,255,.88)';
      fitLines(line.text,f,colW).forEach((wl,i)=>c.fillText(wl,colX,y+i*lh));
    }
  });
  c.globalAlpha=1;
  c.restore();

  // スクロール完了 → FULL CLEAR へ
  if(screenStartY+totalH<-50){skipCeoEnding();return}

  // SKIP ヒント
  c.font=`${Math.min(W*.013,11)}px "Press Start 2P",monospace`;
  c.fillStyle=`rgba(0,255,136,${(Math.floor(frame/26)%2)?.6:.2})`;
  c.textAlign='center';c.textBaseline='bottom';
  c.fillText('CLICK / SPACE TO SKIP',W/2,H-16);
}
function triggerDeath(){
  deathX=playerX;deathY=playerY;
  state='dying';dyingTimer=0;
  shakeF=20;
  // big burst
  for(let i=0;i<30;i++){const a=Math.random()*Math.PI*2,s=2+Math.random()*6;parts.push({x:deathX,y:deathY,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,l:1,ml:50+Math.random()*30,r:3+Math.random()*5,col:['#ff4444','#ff8800','#ffcc00'][i%3],sq:i%3===0})}
  sfxOver();
}
function sfxOver(){[300,240,180,120,80].forEach((f,i)=>setTimeout(()=>beep(f,.22,'sawtooth',.18),i*80))}


/* ══ DRAW DEATH ANIMATION ══ */
function drawDeathAnim(){
  dyingTimer++;
  // expanding ring
  const r=dyingTimer*3.5;
  const a=Math.max(0,1-dyingTimer/90);
  c.save();
  c.globalAlpha=a*.8;c.strokeStyle='#ff4444';c.lineWidth=3;c.beginPath();c.arc(deathX,deathY,r,0,Math.PI*2);c.stroke();
  c.globalAlpha=a*.4;c.strokeStyle='#ffcc00';c.lineWidth=2;c.beginPath();c.arc(deathX,deathY,r*.6,0,Math.PI*2);c.stroke();
  // red flash overlay
  if(dyingTimer<20){c.globalAlpha=(20-dyingTimer)/20*.35;c.fillStyle='#ff0000';c.fillRect(0,0,W,H)}
  c.restore();
  if(dyingTimer>=90){
    if(lives<=0){state='gameover';buildGameOverBtns()}else{state='retry';retryHover=-1;buildRetryBtns()}
  }
}

/* ══ BUILD BUTTON LAYOUTS ══ */
function buildRetryBtns(){
  const bw=Math.min(W*.62,400),bh=50,gap=12,sx=W/2-bw/2;
  retryBtns=[
    {x:sx,y:H*.48,w:bw,h:bh,label:'▷  そのままコンティニュー',col:'#00ff88',action:()=>{powerUp=false;resumePlay()}},
    {x:sx,y:H*.48+bh+gap,w:bw,h:bh,label:'◆  強い武器でコンティニュー',col:'#ffcc00',action:()=>{powerUp=true;resumePlay()}},
    {x:sx,y:H*.48+(bh+gap)*2,w:bw,h:bh,label:'≫  このステージを強制クリア',col:'#ff8844',action:()=>{
      powerUp=false;
      // 全ゾーンを開放してクリア演出へ（コンテンツを表示してから次へ）
      if(blk){
        blk.zones.forEach(z=>z.hp=0);
        blk.done=true;
        bProj=[];
        const bannerBottom=54+4+52+14;
        blk.targetY=STAGES[stageIdx].isBoss?bannerBottom:Math.max(bannerBottom,(H-blk.bh)/2+20);
        clearLocked=true;
        state='clearing';clearPhase=0;
        sClear();score+=1000;updateHUD();
      }
    }},
    {x:sx,y:H*.48+(bh+gap)*3,w:bw,h:bh,label:'⌂  ホームページに戻る',col:'rgba(200,220,255,.6)',action:()=>{startPortal('home')}},
  ];
}
function buildGameOverBtns(){
  const bw=Math.min(W*.62,400),bh=50,gap=12,sx=W/2-bw/2;
  retryBtns=[
    {x:sx,y:H*.52,w:bw,h:bh,label:'↺  ステージ1からやり直す',col:'#00ff88',action:()=>{powerUp=false;score=0;stageIdx=0;lives=3;updateHUD();resumePlay()}},
    {x:sx,y:H*.52+bh+gap,w:bw,h:bh,label:'▷  続きのステージからやり直す',col:'#4d9fff',action:()=>{powerUp=false;lives=3;updateHUD();resumePlay()}},
    {x:sx,y:H*.52+(bh+gap)*2,w:bw,h:bh,label:'⌂  ホームページに戻る',col:'rgba(200,220,255,.6)',action:()=>{startPortal('home')}},
  ];
}
function resumePlay(){
  state='playing';initBlock();parts=[];bProj=[];
  playerX=W/2;playerY=H-100;bullets=[];
}

/* ══ PORTAL EXIT ANIMATION ══ */
function startPortal(dest){
  portalDest=dest;portalTimer=0;state='portal';
  beep(880,.08,'sine',.09);setTimeout(()=>beep(1100,.08,'sine',.08),80);setTimeout(()=>beep(1400,.1,'sine',.07),160);
}
function drawPortalExit(){
  portalTimer++;
  const t=portalTimer;
  const TOTAL=150; // より長く・ゆっくりに
  const cx=W/2,cy=H/2;

  // 背景フェード
  c.fillStyle=`rgba(0,0,0,${Math.min(1,t/60)*.9})`;c.fillRect(0,0,W,H);

  // ── 扉の枠（t=20から出現）──
  if(t>15){
    const doorW=Math.min(W*.18,120),doorH=doorW*1.7;
    const dx=cx-doorW/2,dy=cy-doorH/2;
    const doorA=Math.min(1,(t-15)/20);
    c.save();c.globalAlpha=doorA;
    const doorGrad=c.createLinearGradient(dx,dy,dx+doorW,dy+doorH);
    doorGrad.addColorStop(0,'#d95f1a');doorGrad.addColorStop(.5,'#ffcc44');doorGrad.addColorStop(1,'#1e8fa0');
    c.strokeStyle=doorGrad;c.lineWidth=3;
    c.shadowColor='#ffcc44';c.shadowBlur=20+Math.sin(t*.12)*10;
    rr(dx,dy,doorW,doorH,8);c.stroke();
    const innerA=Math.min(1,(t-25)/30);
    if(innerA>0){
      const ig=c.createRadialGradient(cx,cy,0,cx,cy,doorW*.6);
      ig.addColorStop(0,`rgba(255,220,100,${innerA*.8})`);ig.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=ig;rr(dx,dy,doorW,doorH,8);c.fill();
    }
    c.shadowBlur=0;c.restore();
  }

  // ── ロゴアニメーション ──
  if(logoImg&&logoOK&&t<TOTAL-15){
    const lw=Math.min(W*.2,130);
    const lh=lw*(logoImg.naturalHeight/logoImg.naturalWidth||.38);

    // 前半（0〜40f）: エンディング画面の位置で小さく揺れる（動き出し感）
    // 後半（40〜120f）: 中央の扉に向かってゆっくり縮んでいく
    const LAUNCH=40;
    if(t<LAUNCH){
      // 動き出し：小刻みに振動してエンジン点火感
      const vib=Math.sin(t*0.8)*( t/LAUNCH)*4;
      const bobY=Math.sin(frame*.04)*6; // 元の浮遊も残す
      c.save();
      c.translate(W/2+vib, H*.3+bobY);
      c.shadowColor='rgba(255,200,50,.5)';c.shadowBlur=10+t*.3;
      c.drawImage(logoImg,-lw/2,-lh/2,lw,lh);
      c.shadowBlur=0;
      c.restore();
    } else {
      // 飛び込み：扉に向かってゆっくり→加速しながら縮む
      const flightProgress=Math.min(1,(t-LAUNCH)/(TOTAL-LAUNCH-20));
      // easeInCubic: ゆっくり始まって加速
      const ease=flightProgress*flightProgress*flightProgress;
      // 位置：エンディングロゴ位置 → 扉中央
      const startX=W/2, startY=H*.3;
      const lx=startX+(cx-startX)*ease;
      const ly=startY+(cy-startY)*ease;
      // サイズ：元サイズ → 0
      const sz=Math.max(2,lw*(1-ease));
      const szH=Math.max(1,lh*(1-ease));
      c.save();
      c.globalAlpha=Math.max(0,1-ease*.7);
      c.shadowColor='#ffcc44';c.shadowBlur=20*(1-ease);
      c.drawImage(logoImg,lx-sz/2,ly-szH/2,sz,szH);
      c.shadowBlur=0;
      c.restore();
    }
  }

  // ── 入り込んだ瞬間のフラッシュ ──
  if(t>TOTAL-35&&t<TOTAL-15){
    const fp=(t-(TOTAL-35))/20;
    const fa=fp<.5?fp*2:2-fp*2;
    c.fillStyle=`rgba(255,230,100,${fa*.8})`;c.fillRect(0,0,W,H);
  }

  // ── 最終フェードアウト ──
  if(t>TOTAL-25){
    const fa=Math.min(1,(t-(TOTAL-25))/25);
    c.fillStyle=`rgba(0,0,0,${fa})`;c.fillRect(0,0,W,H);
  }

  if(t>=TOTAL){
    if(portalDest==='recruit')window.location.href='/recruit/';
    else{
      // 'home' → 現在のページをリロードして、ゲーム起動前の状態に戻す
      // (ESCキーや「ホームに戻る」ボタンの共通動作)
      window.location.reload();
    }
  }
}

/* ══ GAME START INTRO（扉からロゴが飛び出してくる） ══ */
function drawIntro(){
  introTimer++;
  const t=introTimer;
  const TOTAL=150;
  const cx=W/2,cy=H/2;
  c.fillStyle='#000';c.fillRect(0,0,W,H);
  drawStars();
  // 扉の枠（t=8〜）
  if(t>8){
    const doorW=Math.min(W*.18,120),doorH=doorW*1.7;
    const dx=cx-doorW/2,dy=cy-doorH/2;
    const doorA=Math.min(1,(t-8)/20);
    c.save();c.globalAlpha=doorA;
    const dg=c.createLinearGradient(dx,dy,dx+doorW,dy+doorH);
    dg.addColorStop(0,'#d95f1a');dg.addColorStop(.5,'#ffcc44');dg.addColorStop(1,'#1e8fa0');
    c.strokeStyle=dg;c.lineWidth=3;
    c.shadowColor='#ffcc44';c.shadowBlur=20+Math.sin(t*.12)*10;
    rr(dx,dy,doorW,doorH,8);c.stroke();
    const ia=Math.min(1,(t-18)/25);
    if(ia>0){
      const ig=c.createRadialGradient(cx,cy,0,cx,cy,doorW*.6);
      ig.addColorStop(0,`rgba(255,220,100,${ia*.9})`);ig.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=ig;rr(dx,dy,doorW,doorH,8);c.fill();
    }
    c.shadowBlur=0;c.restore();
  }
  // 扉が全開フラッシュ（t=42〜58）
  if(t>42&&t<60){
    const fp=(t-42)/18,fa=fp<.5?fp*2:2-fp*2;
    c.fillStyle=`rgba(255,230,100,${fa*.75})`;c.fillRect(0,0,W,H);
  }
  // ロゴが扉から飛び出してくる（t=48〜）
  if(logoImg&&logoOK&&t>48){
    const lw=Math.min(W*.28,190),lh=lw*(logoImg.naturalHeight/logoImg.naturalWidth||.38);
    const titleY=H*.46;
    const progress=Math.min(1,(t-48)/75);
    const ease=1-Math.pow(1-progress,3); // easeOutCubic
    const sz=8+(lw-8)*ease,szH=8*(lh/lw)+(lh-8*(lh/lw))*ease;
    const posY=cy+(titleY-cy)*ease;
    const bob=progress>.85?Math.sin(frame*.04)*6*((progress-.85)/.15):0;
    c.save();
    c.globalAlpha=Math.min(1,ease*2);
    c.shadowColor='rgba(217,95,26,.5)';c.shadowBlur=20*(1-ease)+8;
    c.drawImage(logoImg,cx-sz/2,posY-szH/2+bob,sz,szH);
    c.shadowBlur=0;c.restore();
  }
  if(t>=TOTAL){state='idle';introTimer=0;}
}

function drawBossIntro(){
  bossIntroTimer++;
  const t=bossIntroTimer;
  const TOTAL=220;
  c.fillStyle='#000';c.fillRect(0,0,W,H);
  drawStars();

  // 赤フラッシュ（0〜30）
  if(t<30){c.fillStyle=`rgba(255,0,0,${Math.sin(t/30*Math.PI)*.5})`;c.fillRect(0,0,W,H)}

  // WARNING ストライプ（20〜90）
  if(t>20&&t<100){
    const wa=Math.min(1,(t-20)/20);
    c.save();c.globalAlpha=wa*.65;
    for(let i=0;i<8;i++){c.fillStyle=i%2===0?'rgba(200,20,20,.8)':'rgba(0,0,0,.8)';c.fillRect(0,H*.3+i*(H*.05),W,H*.05)}
    c.restore();
    c.save();c.globalAlpha=wa;
    c.font=`bold ${Math.min(W*.07,46)}px "Press Start 2P",monospace`;
    c.fillStyle='#ff0';c.textAlign='center';c.textBaseline='middle';
    if(Math.floor(t/8)%2===0)c.fillText('⚠  WARNING  ⚠',W/2,H*.48);
    c.restore();
  }

  // BOSS 登場（80〜160）
  if(t>80&&t<TOTAL-20){
    const ea=Math.min(1,(t-80)/30);
    c.save();c.globalAlpha=ea;
    const g=c.createRadialGradient(W/2,H*.45,0,W/2,H*.45,W*.5);
    g.addColorStop(0,'rgba(255,0,30,.22)');g.addColorStop(1,'transparent');
    c.fillStyle=g;c.fillRect(0,0,W,H);
    c.font=`bold ${Math.min(W*.11,72)}px "Press Start 2P",monospace`;
    c.fillStyle='#ff2244';c.shadowColor='#ff2244';c.shadowBlur=25+Math.sin(t*.12)*12;
    c.textAlign='center';c.textBaseline='middle';c.fillText('BOSS',W/2,H*.46);
    c.shadowBlur=0;
    c.restore();
  }

  // フェードアウト（TOTAL-40 〜 TOTAL）
  if(t>TOTAL-40){
    const fa=Math.min(1,(t-(TOTAL-40))/40);
    c.fillStyle=`rgba(0,0,0,${fa})`;c.fillRect(0,0,W,H);
  }

  if(t>=TOTAL){state='playing';initBlock();}
}
/* ══ 共通ボタン描画ヘルパー ══ */
function drawBtn(x,y,w,h,label,col,isHot){
  c.save();
  // 背景
  c.fillStyle=isHot?col+'33':'rgba(255,255,255,.06)';
  rr(x,y,w,h,h/2);c.fill();
  // 枠線
  c.strokeStyle=isHot?col:'rgba(255,255,255,.2)';
  c.lineWidth=isHot?2:1;
  if(isHot){c.shadowColor=col;c.shadowBlur=10;}
  rr(x,y,w,h,h/2);c.stroke();
  c.shadowBlur=0;
  // テキスト
  c.font=`bold ${Math.min(W*.022,14)}px "Noto Sans JP",sans-serif`;
  c.fillStyle=isHot?col:'rgba(255,255,255,.75)';
  c.textAlign='center';c.textBaseline='middle';
  c.fillText(label,x+w/2,y+h/2);
  c.restore();
}

function drawChoiceScreen(title,titleCol,hint){
  c.save();c.globalAlpha=.82;c.fillStyle='#000';c.fillRect(0,0,W,H);c.restore();
  c.save();c.textAlign='center';c.textBaseline='middle';
  c.font=`bold ${Math.min(W*.055,36)}px "Press Start 2P",monospace`;
  c.fillStyle=titleCol;c.fillText(title,W/2,H*.28);
  if(state==='retry'){
    c.font=`${Math.min(W*.018,11)}px "Press Start 2P",monospace`;
    c.fillStyle='rgba(255,255,255,.45)';
    c.fillText('REMAINING SHIPS: '+[...Array(lives)].map(()=>'♦').join(' '),W/2,H*.40);
  }
  c.font=`${Math.min(W*.016,10)}px "Press Start 2P",monospace`;
  c.fillStyle='rgba(255,255,255,.3)';c.fillText(hint,W/2,H*.46);
  retryBtns.forEach((btn,i)=>drawBtn(btn.x,btn.y,btn.w,btn.h,btn.label,btn.col,retryHover===i));
  c.restore();
}

/* ══ MOUSE HOVER / CLICK FOR BUTTONS ══ */
CV.addEventListener('mousemove',e=>{
  const r=CV.getBoundingClientRect();
  // 表示座標 → 仮想座標
  mouseX=(e.clientX-r.left)*(VIRTUAL_W/r.width);
  const my=(e.clientY-r.top)*(VIRTUAL_H/r.height);
  if(state==='retry'||state==='gameover'){
    retryHover=retryBtns.findIndex(b=>mouseX>b.x&&mouseX<b.x+b.w&&my>b.y&&my<b.y+b.h);
  } else if(state==='ending'){
    // エンディング画面のボタンもホバー検出
    retryHover=endingBtns.findIndex(b=>mouseX>b.x&&mouseX<b.x+b.w&&my>b.y&&my<b.y+b.h);
  } else {
    retryHover=-1;
  }
});

function updateHUD(){
  document.getElementById('gs').textContent=String(score).padStart(6,'0');
  document.getElementById('gh').textContent=String(Math.max(score,0)).padStart(6,'0');
  document.getElementById('gl').innerHTML=[...Array(3)].map((_,i)=>i<lives?'<span style="color:#00ff88">♦</span>':'<span style="color:#222">◇</span>').join(' ');
}

/* ══ DRAW TITLE ══ */
function drawTitle(){
  c.fillStyle='#08040e';c.fillRect(0,0,W,H);drawStars();
  if(logoImg&&logoOK){
    const lw=Math.min(W*.28,190),lh=lw*(logoImg.naturalHeight/logoImg.naturalWidth||.38);
    c.drawImage(logoImg,W/2-lw/2,H*.46-lh/2+Math.sin(frame*.016)*8,lw,lh);
  }
  c.textAlign='center';c.textBaseline='middle';
  c.font=`800 ${Math.min(W*.032,20)}px "Syne","Noto Sans JP",sans-serif`;c.fillStyle='rgba(255,255,255,.9)';c.fillText('株式会社トライテック',W/2,H*.67);
  c.font=`${Math.min(W*.02,13)}px "Noto Sans JP",sans-serif`;c.fillStyle='rgba(255,200,100,.6)';c.fillText('テクノロジーで、未来をつなぐ。',W/2,H*.72);
  if(Math.floor(frame/26)%2===0){c.font=`bold ${Math.min(W*.016,11)}px "Press Start 2P",monospace`;c.fillStyle='#00ff88';c.fillText('▶  PRESS SPACE / CLICK TO START',W/2,H-50)}
  c.font=`${Math.min(W*.012,8)}px "Press Start 2P",monospace`;c.fillStyle='rgba(0,255,136,.25)';
  c.fillText(/Mobi|Android|iPhone/i.test(navigator.userAgent)?'SLIDE TO MOVE   TAP/DRAG TO SHOOT':'← → MOVE   SPACE/CLICK SHOOT',W/2,H-28);
}

/* ══ DRAW STAGE CLEAR ══ */
function drawStageClear(){
  const a=Math.min(1,clearTimer/20);
  const st=STAGES[stageIdx];
  const hudH=54; // HUD height
  const bannerH=52;
  const bannerY=hudH+4; // just below HUD
  c.save();
  c.globalAlpha=a;
  c.fillStyle='rgba(0,0,0,.88)';c.fillRect(0,bannerY,W,bannerH);
  c.strokeStyle=st.col;c.lineWidth=2;
  c.beginPath();c.moveTo(0,bannerY);c.lineTo(W,bannerY);c.stroke();
  c.beginPath();c.moveTo(0,bannerY+bannerH);c.lineTo(W,bannerY+bannerH);c.stroke();
  c.textAlign='center';c.textBaseline='middle';
  const mid=bannerY+bannerH*.38;
  c.font=`bold ${Math.min(W*.04,24)}px "Press Start 2P",monospace`;c.fillStyle=st.col;
  c.fillText('STAGE CLEAR!',W/2,mid);
  if(clearTimer>150){
    c.font=`${Math.min(W*.011,7.5)}px "Press Start 2P",monospace`;
    c.fillStyle=Math.floor(frame/20)%2?'rgba(255,255,255,.9)':'rgba(255,255,255,.28)';
    c.fillText('CLICK OR SPACE TO CONTINUE  ▶',W/2,bannerY+bannerH*.75);
    // ホームへ戻るリンク
    c.font=`${Math.min(W*.01,7)}px "Press Start 2P",monospace`;
    c.fillStyle='rgba(255,255,255,.25)';c.fillText('[ H ] HOME',W-80,bannerY+bannerH*.5);
  }
  c.restore();
}

/* ══ DRAW ENDING ══ */
function buildEndingBtns(){
  const bw=Math.min(W*.30,240),bh=46,gap=18;
  const totalW=bw*2+gap;
  const sx=W/2-totalW/2;
  const by=Math.min(H-72,H*.91);
  // Join Us クリック領域（中央のテキスト）+ 下段に2ボタン横並び
  endingBtns=[
    {x:W/2-160,y:H*.79-22,w:320,h:54,label:'',col:'#fff',joinUs:true,
     action:()=>{startPortal('recruit')}},
    {x:sx,y:by,w:bw,h:bh,label:'採用情報を見る →',col:'#d95f1a',
     action:()=>{startPortal('recruit')}},
    {x:sx+bw+gap,y:by,w:bw,h:bh,label:'⌂  ホームへ',col:'rgba(200,220,255,.7)',
     action:()=>{startPortal('home')}}
  ];
}

function drawEnding(){
  c.fillStyle='rgba(0,0,0,.04)';c.fillRect(0,0,W,H);drawStars();
  const a=Math.min(1,endTimer/40);
  c.save();c.globalAlpha=a;
  const ceo=gc.ceo||{};

  // ══ TOP: FULL CLEAR! + SCORE ══
  c.textAlign='center';c.textBaseline='middle';
  c.font=`bold ${Math.min(W*.045,34)}px "Press Start 2P",monospace`;
  c.fillStyle='#ffcc00';
  c.fillText('FULL CLEAR!',W/2,H*.065);
  c.font=`bold ${Math.min(W*.016,11)}px "Press Start 2P",monospace`;
  c.fillStyle='rgba(255,204,0,.85)';
  c.fillText('SCORE: '+String(score).padStart(6,'0'),W/2,H*.115);

  // ══ MIDDLE LEFT: CEO 写真カード（縦長ポートレート）══
  // 枠を縦長 ~3:5 比率にして頭が見切れないようにする
  // 下端は Join Us (H*.79) より上に収めるため ph=H*.57 で抑える
  const pw=W*.34, ph=H*.57;
  const px=W*.05, py=H*.17;
  c.save();
  rr(px,py,pw,ph,14);c.clip();
  if(ceoPhotoOK && ceoPhotoImg){
    const imgR=ceoPhotoImg.naturalWidth/ceoPhotoImg.naturalHeight;
    const boxR=pw/ph;
    let dx,dy,dw,dh;
    if(imgR>boxR){dh=ph;dw=ph*imgR;dx=px-(dw-pw)/2;dy=py}
    else{dw=pw;dh=pw/imgR;dx=px;dy=py} // 縦長は上寄せ（頭が見切れない）
    try{c.filter='grayscale(15%)';}catch(e){}
    c.drawImage(ceoPhotoImg,dx,dy,dw,dh);
    try{c.filter='none';}catch(e){}
  } else {
    const g=c.createLinearGradient(px,py,px,py+ph);
    g.addColorStop(0,'rgba(80,15,30,.95)');g.addColorStop(1,'rgba(20,0,8,.95)');
    c.fillStyle=g;c.fillRect(px,py,pw,ph);
    c.font=`bold ${ph*.22}px "Syne",sans-serif`;c.fillStyle='rgba(255,34,68,.7)';
    c.textAlign='center';c.textBaseline='middle';
    const init=(ceo.name||'').replace(/\s+/g,'').substring(0,2)||'CEO';
    c.fillText(init,px+pw/2,py+ph*.40);
  }
  // 下部グラデーション
  const grad=c.createLinearGradient(0,py+ph*.50,0,py+ph);
  grad.addColorStop(0,'rgba(0,0,0,0)');
  grad.addColorStop(1,'rgba(0,0,0,.82)');
  c.fillStyle=grad;c.fillRect(px,py,pw,ph);
  // CEO キャプション
  c.textAlign='left';c.textBaseline='bottom';
  c.font=`bold ${Math.min(pw*.060,ph*.065)}px "Syne",sans-serif`;
  c.fillStyle='rgba(255,255,255,.96)';
  c.fillText('CEO',px+pw*.06,py+ph*.91);
  c.font=`bold ${Math.min(pw*.038,ph*.044)}px "Noto Sans JP",sans-serif`;
  c.fillStyle='rgba(255,255,255,.75)';
  const roleClean=(ceo.role||'代表取締役').replace(/\s*CEO\s*$/i,'');
  c.fillText(roleClean+'  '+(ceo.name||'清水 幸秀'),px+pw*.06,py+ph*.97);
  c.restore();
  // 外枠
  c.strokeStyle='#ff2244';c.lineWidth=2;
  rr(px,py,pw,ph,14);c.stroke();

  // ══ MIDDLE RIGHT: 代表メッセージ（自動スクロール対応） ══
  const tx=W*.50, ty=H*.17, tw=W*.45, th=H*.55;
  c.save();
  // パネル背景
  c.fillStyle='rgba(0,0,0,.50)';rr(tx,ty,tw,th,12);c.fill();
  c.strokeStyle='rgba(255,204,68,.30)';c.lineWidth=1;rr(tx,ty,tw,th,12);c.stroke();

  // ヘッダー "// CEO MESSAGE"（固定・スクロール領域外）
  const padX=tw*.05;
  const headerH=th*.10;
  c.textAlign='left';c.textBaseline='top';
  c.font=`bold ${Math.min(tw*.026,12)}px "Press Start 2P",monospace`;
  c.fillStyle='#ff6644';
  c.fillText('// CEO MESSAGE',tx+padX,ty+th*.04);

  // 署名（固定・パネル右下）
  const signFs=Math.min(tw*.024,13);
  const signH=th*.10;
  c.font=`bold ${signFs}px "Noto Sans JP",sans-serif`;
  c.fillStyle='#ffcc44';
  c.textAlign='right';c.textBaseline='bottom';
  // 役職は ceo.role から取得（'代表取締役 CEO' → 'CEO' 接尾辞を除去）
  const signRole2=(ceo.role||'代表取締役').replace(/\s*CEO\s*$/i,'').trim()||'代表取締役';
  c.fillText(signRole2+'  '+(ceo.name||'清水 幸秀'),tx+tw-padX,ty+th-th*.035);

  // ── スクロール領域 ──
  const scrollTop=ty+headerH;
  const scrollBottom=ty+th-signH;
  const scrollH=scrollBottom-scrollTop;
  c.save();
  // クリッピング（スクロール領域内のみ描画）
  c.beginPath();c.rect(tx+1,scrollTop,tw-2,scrollH);c.clip();

  // コンテンツ全体の高さを事前計算
  const tagFs=Math.min(tw*.036,18);
  const tagFont=`bold ${tagFs}px "Noto Sans JP",sans-serif`;
  const pFs=Math.min(tw*.022,12);
  const pFont=`${pFs}px "Noto Sans JP",sans-serif`;
  const pLh=pFs*1.7;
  const paraGap=pFs*.9;
  const paras=(ceo.paragraphs&&ceo.paragraphs.length)?ceo.paragraphs:[ceo.msg1,ceo.msg2,ceo.msg3].filter(Boolean);

  // タグライン + 各パラグラフの行データを構築
  c.font=tagFont;
  const tagLines=ceo.tagline?fitLines(ceo.tagline,tagFont,tw-padX*2):[];
  const tagBlockH=tagLines.length*tagFs*1.4+(tagLines.length?th*.04:0);
  c.font=pFont;
  const paraWrapped=paras.map(p=>fitLines(p,pFont,tw-padX*2));
  const paraBlockHs=paraWrapped.map(w=>w.length*pLh+paraGap);
  const totalContentH=tagBlockH+paraBlockHs.reduce((a,b)=>a+b,0);

  // スクロール量計算
  let scrollOffset=0;
  if(totalContentH>scrollH){
    // 開始時 2 秒静止 → スクロール → 終了時 2 秒静止 → ループ
    const speed=0.35;
    const pauseStart=120;
    const pauseEnd=120;
    const scrollDist=totalContentH-scrollH;
    const scrollFrames=scrollDist/speed;
    const cycleFrames=pauseStart+scrollFrames+pauseEnd;
    const t=endTimer%cycleFrames;
    if(t<pauseStart)scrollOffset=0;
    else if(t<pauseStart+scrollFrames)scrollOffset=(t-pauseStart)*speed;
    else scrollOffset=scrollDist;
  }

  // 描画（スクロール分だけ Y をずらす）
  let curY=scrollTop+th*.02-scrollOffset;
  c.textAlign='left';c.textBaseline='top';

  // タグライン
  c.font=tagFont;c.fillStyle='#ffcc44';
  tagLines.forEach((l,i)=>c.fillText(l,tx+padX,curY+i*tagFs*1.4));
  curY+=tagBlockH;

  // パラグラフ
  c.font=pFont;c.fillStyle='rgba(255,255,255,.85)';
  paraWrapped.forEach((wrapped,pi)=>{
    wrapped.forEach((l,wi)=>c.fillText(l,tx+padX,curY+wi*pLh));
    curY+=paraBlockHs[pi];
  });
  c.restore(); // クリップ解除

  // スクロールインジケーター（コンテンツが収まりきらない時のみ）
  if(totalContentH>scrollH){
    const trackX=tx+tw-6;
    const trackY=scrollTop+4;
    const trackH=scrollH-8;
    c.fillStyle='rgba(255,255,255,.08)';
    c.fillRect(trackX,trackY,2,trackH);
    const ratio=scrollH/totalContentH;
    const thumbH=Math.max(20,trackH*ratio);
    const scrollPct=totalContentH>scrollH?Math.min(1,(scrollOffset)/(totalContentH-scrollH)):0;
    const thumbY=trackY+(trackH-thumbH)*scrollPct;
    c.fillStyle='rgba(255,204,68,.55)';
    c.fillRect(trackX,thumbY,2,thumbH);
  }

  // 上下にフェード（スクロール感を演出）
  const fadeH=th*.06;
  const topFade=c.createLinearGradient(0,scrollTop,0,scrollTop+fadeH);
  topFade.addColorStop(0,'rgba(0,0,0,.85)');topFade.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=topFade;c.fillRect(tx+1,scrollTop,tw-2,fadeH);
  const botFade=c.createLinearGradient(0,scrollBottom-fadeH,0,scrollBottom);
  botFade.addColorStop(0,'rgba(0,0,0,0)');botFade.addColorStop(1,'rgba(0,0,0,.85)');
  c.fillStyle=botFade;c.fillRect(tx+1,scrollBottom-fadeH,tw-2,fadeH);

  c.restore();

  // ══ BOTTOM: Join Us テキスト + ボタン2つ ══
  const joinY=H*.79;
  const joinHot=retryHover===0;
  c.textAlign='center';c.textBaseline='middle';
  c.font=`800 ${Math.min(W*.045,32)}px "Syne","Noto Sans JP",sans-serif`;
  if(joinHot){
    const grad2=c.createLinearGradient(W/2-100,0,W/2+100,0);
    grad2.addColorStop(0,'#d95f1a');grad2.addColorStop(.5,'#ffaa44');grad2.addColorStop(1,'#1e8fa0');
    c.fillStyle=grad2;
    c.shadowColor='rgba(217,95,26,.5)';c.shadowBlur=14;
    c.fillText('Join Us',W/2,joinY);
    const tw2=c.measureText('Join Us').width;
    c.beginPath();c.strokeStyle=grad2;c.lineWidth=2;
    c.moveTo(W/2-tw2/2,joinY+Math.min(W*.025,18));
    c.lineTo(W/2+tw2/2,joinY+Math.min(W*.025,18));
    c.stroke();
    c.shadowBlur=0;
    CV.style.cursor='pointer';
  } else {
    c.fillStyle='rgba(255,255,255,.92)';
    c.fillText('Join Us',W/2,joinY);
  }
  c.font=`${Math.min(W*.017,13)}px "Noto Sans JP",sans-serif`;
  c.fillStyle='rgba(255,255,255,.55)';
  c.fillText('私たちと一緒に、未来をつくりませんか？',W/2,joinY+Math.min(W*.04,28));

  // ボタン描画
  endingBtns.forEach((btn,i)=>{
    if(btn.joinUs)return;
    drawBtn(btn.x,btn.y,btn.w,btn.h,btn.label,btn.col,retryHover===i);
  });
  c.restore();
}

/* ══ DRAW PLAYER ══ */
function drawPlayer(){
  c.save();
  if(shakeF>0){c.translate(Math.random()*6-3,Math.random()*6-3);shakeF--}
  if(logoImg&&logoOK)c.drawImage(logoImg,playerX-PW/2,playerY-PH/2,PW,PH);
  else{c.fillStyle='#00ffcc';c.beginPath();c.moveTo(playerX,playerY-PH/2);c.lineTo(playerX-PW/2,playerY+PH/2);c.lineTo(playerX,playerY+PH/4);c.lineTo(playerX+PW/2,playerY+PH/2);c.closePath();c.fill()}
  c.restore();
}

/* ══ MAIN LOOP ══ */
function loop(){
  rafID=requestAnimationFrame(loop);
  if(document.hidden)return; // don't render when tab hidden
  resize();c.clearRect(0,0,W,H);frame++;

  /* IDLE */
  if(state==='idle'){drawTitle();drawParts();return}

  /* GAME START INTRO */
  if(state==='intro'){drawIntro();drawParts();return}

  /* PORTAL EXIT */
  if(state==='portal'){drawPortalExit();drawParts();return}

  /* BOSS INTRO */
  if(state==='bossIntro'){drawBossIntro();drawParts();return}

  /* BOSS DEFEAT ─ 撃破時の激しい爆発から暗転へ */
  if(state==='bossDefeat'){drawBossDefeat();return;}

  /* CEO ENDING ─ BOSS クリア後の代表メッセージスクロール */
  if(state==='ceoEnding'){
    drawCeoEnding();drawParts();
    CV.style.cursor='default';
    return;
  }

  /* ENDING */
  if(state==='ending'){endTimer++;drawEnding();drawParts();
    if(retryHover!==0)CV.style.cursor='default';
    return}

  CV.style.cursor='none';

  /* DYING */
  if(state==='dying'){
    c.fillStyle='#000510';c.fillRect(0,0,W,H);
    const bgY=(frame*1.3)%55;c.save();c.translate(0,bgY);c.drawImage(getGrid(),0,-55);c.restore();
    drawStars();
    if(blk){const zr={};blk.zones.forEach(z=>zr[z.id]=revOf(z));c.save();rr(blk.bx,blk.by,blk.bw,blk.bh,14);c.clip();STAGES[stageIdx].draw(blk.bx,blk.by,blk.bw,blk.bh,zr,true);c.restore()}
    drawParts();drawDeathAnim();
    return;
  }

  /* RETRY */
  if(state==='retry'){
    CV.style.cursor='default';
    c.fillStyle='#000510';c.fillRect(0,0,W,H);drawStars();drawParts();
    if(blk){const zr={};blk.zones.forEach(z=>zr[z.id]=revOf(z));c.save();rr(blk.bx,blk.by,blk.bw,blk.bh,14);c.clip();STAGES[stageIdx].draw(blk.bx,blk.by,blk.bw,blk.bh,zr,true);c.restore()}
    drawChoiceScreen('SHIP DESTROYED!','#ff4444','選択してください');
    return;
  }

  /* GAMEOVER */
  if(state==='gameover'){
    CV.style.cursor='default';
    c.fillStyle='#000';c.fillRect(0,0,W,H);drawStars();drawParts();
    c.textAlign='center';c.textBaseline='middle';
    c.font=`bold ${Math.min(W*.06,40)}px "Press Start 2P",monospace`;c.fillStyle='#ff2244';c.fillText('GAME OVER',W/2,H*.22);
    c.font=`bold ${Math.min(W*.02,13)}px "Press Start 2P",monospace`;c.fillStyle='#ffcc00';c.fillText('SCORE '+String(score).padStart(6,'0'),W/2,H*.33);
    drawChoiceScreen('GAME OVER','#ff2244','やり直しますか？');
    return;
  }

  /* PLAYING / CLEAR */
  c.fillStyle='#000510';c.fillRect(0,0,W,H);
  // pre-rendered grid
  const bgY=(frame*1.3)%55;
  c.save();c.translate(0,bgY);c.drawImage(getGrid(),0,-55);c.restore();
  drawStars();
  updateDrawBonusWords(); // トライテック ボーナスワード

  const st=STAGES[stageIdx];

  /* UPDATE BLOCK */
  if(blk&&state==='playing'){
    blk.by+=blk.spd;
    // boss oscillation
    if(st.isBoss){blk.osc=(blk.osc||0)+.017;blk.bx=(W-blk.bw)/2+Math.sin(blk.osc)*W*.12}
    // update absolute zone positions
    blk.zones.forEach(z=>{z.ax=blk.bx+z.rx*blk.bw;z.ay=blk.by+z.ry*blk.bh});

    // boss shoots
    if(st.isBoss){
      blk.bossShotT++;
      if(blk.bossShotT>100){blk.bossShotT=0;[-W*.12,0,W*.12].forEach(ox=>{bProj.push({x:blk.bx+blk.bw/2+ox,y:blk.by+blk.bh*.5,vx:(playerX-(blk.bx+blk.bw/2+ox))*.01,vy:2.8})})}
    }

    // bullet → zone hit
    bullets=bullets.filter(b=>{
      let hit=false;
      let passThrough=false; // 開放済みゾーンを通過したか
      for(const z of blk.zones){
        // 開放済み（hp=0）は完全スキップ
        if(z.hp<=0) continue;
        if(b.x>z.ax&&b.x<z.ax+z.aw&&b.y>z.ay&&b.y<z.ay+z.ah){
          z.hp=Math.max(0,z.hp-1);hit=true;
          if(z.hp===0){explode(b.x,b.y,st.col);sReveal();score+=z.mhp*50;updateHUD()}
          else{parts.push({x:b.x,y:b.y,vx:0,vy:-2,l:1,ml:12,r:3,col:'#fff',sq:false});sHit()}
          break;
        }
      }
      return !hit;
    });

    // all zones revealed?
    if(!blk.done&&blk.zones.every(z=>z.hp===0)){
      blk.done=true;
      bProj=[]; // ボス弾を即消去
      const isBoss=STAGES[stageIdx].isBoss;
      if(isBoss){
        // ── BOSS 撃破: 激しい爆発 → 暗転 → エンドロール ──
        state='bossDefeat';
        bossDefeatTimer=0;
        score+=3000;updateHUD();
        triggerBossExplosion();
      } else {
        // 通常 STAGE クリア
        state='clearing';clearPhase=0;
        const bannerBottom=54+4+52+14;
        blk.targetY=Math.max(bannerBottom,(H-blk.bh)/2+20);
        clearLocked=true;
        sClear();score+=1000;updateHUD();
      }
    }

    // 最下ゾーンの底辺が危険ラインを超えたらダメージ（外枠ではなく内側ゾーン基準）
    const zoneBtm=blk.zones.reduce((mx,z)=>Math.max(mx,z.ay+z.ah),0);
    if(zoneBtm>H*.92&&state==='playing'){
      lives--;updateHUD();
      if(lives<=0){triggerDeath();state='dying';return}
      else{triggerDeath();blk.by=-blk.bh-10;blk.zones.forEach(z=>z.hp=z.mhp)}
    }
  }

  /* CLEARING: ブロック移動を先に更新してからDRAW BLOCK と同じ位置でフラッシュ */
  if(state==='clearing'&&blk){
    clearPhase++;
    blk.by+=(blk.targetY-blk.by)*.08;
    // 横軸も中央へイージング（ボスの横ずれを修正）
    const centerX=(W-blk.bw)/2;
    blk.bx+=(centerX-blk.bx)*.12;
    // ax・ay 両方更新（bx も考慮）
    blk.zones.forEach(z=>{z.ax=blk.bx+z.rx*blk.bw;z.ay=blk.by+z.ry*blk.bh});
  }

  /* DRAW BLOCK */
  if(blk){
    const zr={};blk.zones.forEach(z=>zr[z.id]=revOf(z));
    // danger line (outside clip)
    c.strokeStyle='rgba(255,80,80,.18)';c.lineWidth=1;c.setLineDash([6,6]);
    c.beginPath();c.moveTo(0,H*.92);c.lineTo(W,H*.92);c.stroke();c.setLineDash([]);
    // clip all drawing to block bounds
    c.save();rr(blk.bx,blk.by,blk.bw,blk.bh,14);c.clip();
    // プレイ中は外枠非表示、クリア時は外枠表示
    const hideBg=(state==='playing'||state==='dying');
    st.draw(blk.bx,blk.by,blk.bw,blk.bh,zr,hideBg);
    c.restore();
    // zone outlines (unrevealed only)
    c.strokeStyle='rgba(255,255,255,.06)';c.lineWidth=1;c.setLineDash([4,4]);
    blk.zones.forEach(z=>{if(z.hp>0){rr(z.ax,z.ay,z.aw,z.ah,6);c.stroke()}});
    c.setLineDash([]);
  }

  /* BOSS PROJECTILES */
  bProj=bProj.filter(p=>{
    p.x+=p.vx;p.y+=p.vy;
    if(p.y>H+10||p.x<-10||p.x>W+10)return false;
    c.fillStyle='#ff3355';c.beginPath();c.arc(p.x,p.y,4,0,Math.PI*2);c.fill();
    if(Math.abs(p.x-playerX)<PW*.4&&Math.abs(p.y-playerY)<PH*.4){
      lives--;updateHUD();triggerDeath();return false;
    }
    return true;
  });

  /* BULLETS */
  c.fillStyle='#00ffcc';
  bullets=bullets.filter(b=>{
    b.y-=20;b.x+=(b.vx||0);if(b.y<-10)return false;
    c.fillStyle=powerUp?'#ffcc44':'#00ffcc';
    c.fillRect(b.x-2,b.y,4,13);return true;
  });

  /* PLAYER MOVE */
  if(keys['ArrowLeft']||keys['KeyA'])playerX=Math.max(PW/2,playerX-PS);
  if(keys['ArrowRight']||keys['KeyD'])playerX=Math.min(W-PW/2,playerX+PS);
  if(mouseX!==null)playerX+=(mouseX-playerX)*.1;
  if(keys['Space']&&state==='playing')shoot();
  drawPlayer();drawParts();

  /* CLEARING: フラッシュ描画（外枠のみグロー） */
  if(state==='clearing'&&blk){
    const pulse=Math.sin(clearPhase*.18)*.5+.5; // 0〜1 でパルス
    const col=STAGES[stageIdx].col;
    c.save();
    // 外枠をグローさせる（ストローク複数重ね）
    c.shadowColor=col;
    c.shadowBlur=20+pulse*30;
    c.strokeStyle=col;
    c.lineWidth=2+pulse*3;
    c.globalAlpha=0.4+pulse*0.6;
    rr(blk.bx,blk.by,blk.bw,blk.bh,14);c.stroke();
    c.restore();
    if(clearPhase>55){state='clear';clearTimer=0}
  }

  /* STAGE CLEAR OVERLAY */
  if(state==='clear'){clearTimer++;drawStageClear()}

  /* ZONES COUNTER */
  if(blk&&state==='playing'){
    const rem=blk.zones.filter(z=>z.hp>0).length,tot=blk.zones.length;
    c.font=`.38rem "Press Start 2P",monospace`;c.textAlign='center';c.fillStyle='rgba(0,255,136,.2)';c.fillText(`ZONES ${tot-rem}/${tot}`,W/2,H-12);
  }
}

window.addEventListener('resize',()=>{resize();gridDirty=true});
})();
