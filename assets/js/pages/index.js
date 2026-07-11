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
  if(!targets.length){console.log('[mirror] no [data-source] targets found');return Promise.resolve()}
  console.log('[mirror] starting, targets:',targets.length);
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
        console.log('[mirror] injected:','#'+frag,'(reveal targets:',newReveals.length+')');
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

  const barData=[{y:'2023',v:6},{y:'2024',v:11},{y:'2025',v:15},{y:'2026',v:30,note:'予定'}];

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
    const data=[
      {v:40,c:'#E07830'},
      {v:40,c:'#44AADB'},
      {v:10,c:'#2A5A9A'},
      {v:10,c:'#888888'}
    ];
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

  initChart('chart-bar',drawBar,animateBar);
  initChart('chart-donut',drawDonut,animateDonut);
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
const VOICE_DATA={
  kawasaki:{name:'',initial:'YK',avatar:'kawasaki',role:'テストエンジニア／サブリーダー',chapters:[
    {title:'入社を決めた理由と入社後のギャップ',body:`私がトライテックを知ったきっかけは、求人媒体から届いたスカウトです。掲載内容を見て興味を持ち、「一度話を聞いてみたい」と思いました。

その後、社長と直接お会いする機会があり、現場の状況を深く理解されていることや、「私たちはこういう目的、こういう理念で社員と向き合っている」というお話に強く惹かれました。話の中で感じた誠実さと熱意が、入社を決める大きな理由になりました。

入社前後で大きなギャップはありませんでしたが、社長の人柄は想像以上に魅力的でした。一般的にイメージされるような高圧的なトップとは全く異なり、とてもフレンドリーな方です。困ったことや相談事があればすぐ耳を傾けてくれますし、オフの時には一緒に遊びにいくこともあります。もちろんルールにはきっちりしていますが、入社してからはより自由に、のびのびと仕事に取り組めていると感じます。ここは期待を上回るギャップでしたね。`},
    {title:'具体的な仕事内容と一日の流れ',body:`入社して1ヶ月間別の案件を経験した後、現在のプロジェクトにテスト設計として参加しました。そして最近、業務を一人で回せているところを評価していただき、サブリーダーに昇進しました。「この人しかいない」と言っていただけたので、日々の頑張りを認めてもらえたのだと実感しています。

基本的に在宅で仕事をしており、一日の始まりはSlackでの連絡と朝会からです。各自がその日の業務を宣言し、それに沿って作業を進めます。設計業務の際は、案件の理解を深め、テスト観点を作成することに集中します。テストが始まると、実行管理も担当します。

チーム内では、コンポーネントごとの会議で作業報告をしたり、設計メンバー同士で進捗確認や困りごとを共有したりすることで、スムーズに仕事が進むよう工夫しています。また、退勤前に書く日報のような「デイレポート」もユニークな文化です。作業内容だけでなく、ちょっとした一言も添えることで、お互いの状況を把握でき、良いコミュニケーションに繋がっています。`},
    {title:'仕事のやりがい、喜びを感じる瞬間',body:`製品がリリースされた瞬間が、一番嬉しいですね。自分が担当した範囲が問題なく動作していることを確認でき、「自分が関わったものが形になった」という大きなやりがいを感じます。QAが始まるまでは、実際に製品が動く段階ではないので何が起こるかわからない不安もありますが、企画会社さんと事前に綿密な打ち合わせをして、影響範囲を検討しておくことで、無事にリリースできたときの安心感と達成感は格別です。

また、入社して間もない期間で、テスト設計からサブリーダーに昇進させていただいたことも、非常に嬉しかったです。評価していただけた喜びを感じると同時に、期待に応えなければというプレッシャーもあります。その期待に応えられるよう、日々頑張りたいと思っています。`},
    {title:'ワークライフバランスとプライベートの過ごし方',body:`週末は友人とオンラインゲームをしたり、趣味で絵を描いたり音楽を作ったりして過ごすことが多いです。学生の頃ほど時間は取れませんが、工夫して自分の時間を見つけ、趣味を楽しんでいます。

仕事とプライベートの両立はうまくできていると感じています。現在の現場は極端に忙しくなることがないので、疲れた日はすぐに休むこともできていますね。プライベートの時間を確保できることは、とても恵まれていることだと思っていますが、業務に支障が出ないよう調整しつつ、充実した毎日を送れています。`},
    {title:'今後の目標とキャリアプラン',body:`これまでは目の前の仕事に全力で取り組んできましたが、当面の目標は、任せていただいたサブリーダーの仕事をしっかりと全うすることです。

もともと職業訓練でプログラミングを学び、この業界に入ったので、開発職に興味を持っていました。しかし、社長と話す中で「プログラミングは趣味でもできる。QAや管理の分野で専門性を高めていくのも良いキャリアだ」というアドバイスをいただきました。私もその考え方に共感しているので、今は開発職ではなく、品質管理やマネジメントの分野でスキルを磨いていきたいと考えています。`}
  ]},
  kikuchi:{name:'',initial:'TK',avatar:'kikuchi',role:'システムエンジニア／開発・教育担当',chapters:[
    {title:'入社を決めた理由と入社後のギャップ',body:`以前から代表の清水さんの仕事に対する姿勢や人柄に惹かれていました。お話を聞いていく中で「この会社なら楽しく働けそうだ」と思いましたし、新しい環境で自分の力を試すなら、この人と一緒に働きたいという思いもあったので入社を決めました。

入社後もその印象は変わらず、期待通りに楽しく仕事ができていますね。入社前に思い描いていたイメージと現実の間にギャップはなく、のびのびと働ける環境に満足しています。`},
    {title:'具体的な仕事内容と一日の流れ',body:`現在は、金融系のアプリ開発プロジェクトに参画しています。主な役割は、システムのコーディングや品質のチェックです。また、新しいメンバーが入ってきた際の教育も担当していて、若い方に基礎的なことを教えたりもしています。

一日の始まりは、朝9時の始業から。10時からのプロジェクト全体の朝会に備え、チャットツールで業務連絡を確認します。朝会では、その日の業務内容や全体共有事項を確認し、各自の作業に入ります。16時にはチーム全体での定例会議があり、その日の課題や成果を共有します。その後、18時の終業まで引き続き業務を進めるのが、基本的な流れです。`},
    {title:'仕事のやりがい、喜びを感じる瞬間',body:`現在は開発とテストの両方を担当していますが、システムの課題点や改善点を見つけるテスト業務に、よりやりがいを感じています。「この問題点、よく見つけたね」とお客様に言っていただけたときは、自分の仕事が評価されていることを実感しますし、やりがいを感じますね。

印象的なエピソードとして、以前担当していた案件で、現場の都合により急遽プロジェクトを離れることになった時のことです。その際、あまり直接的な関わりがなかった現場の上役の方から「優秀な方が抜けられてしまうのは寂しいですね」と言葉をかけていただきました。その言葉から、自分の仕事ぶりがしっかり見てもらえていたのだと知り、非常に嬉しかったことを覚えています。`},
    {title:'ワークライフバランスとプライベートの過ごし方',body:`IT業界に入る前はゲームセンターで働いていたこともあり、今でも休日はゲームセンターによく行きます。特にクレーンゲームが好きで、気分転換によく遊んでいます。`},
    {title:'今後の目標とキャリアプラン',body:`今まで、リーダー経験は複数回あるものの、どれも小規模なチームでの経験でした。限られた人数の中でメンバーの進捗管理やフォローを行い、チームとして成果を出すことにやりがいを感じていました。

一方で、プロジェクト全体を俯瞰して舵取りをするポジションや、複数チームをまとめるマネージャー業務はまだ経験がありません。新人教育を通じて人を育てる面白さを知ったからこそ、今後はより広い視野を持って、プロジェクト全体の成長に貢献できる存在になりたいと考えています。新しい役割に挑戦し、自分の可能性をさらに広げていきたいです。`}
  ]},
  masuda:{name:'',initial:'SM',avatar:'masuda',role:'設計エンジニア／メンター担当',chapters:[
    {title:'入社を決めた理由と入社後のギャップ',body:`入社のきっかけは、会社説明を聞く機会があったことです。そこで会社の雰囲気や働き方について詳しくお話を伺い、「社員同士がしっかりとつながりを持ち、困ったときにすぐ相談できる環境」があることに魅力を感じました。SES業界では、一人で現場に入り孤立しがちなイメージがありましたが、この会社では仲間と情報を共有しながら働けると感じ、入社を決めました。

実際に働いてみても、困ったことがあれば気軽に相談でき、特に清水さんには安心して話せます。全社会の後に麻雀をするような、ちょっと珍しい交流の場もあり、仕事以外でも自然に関われる関係性があるのは心強いですね。前職では横のつながりがほとんどなく、気づけば同期が全員辞めてしまっていたこともあったので、今の環境のありがたさを実感しています。

入社前から「この会社には明るくてフレンドリーな人が多い」と聞いていましたが、まさにその通りでした。周囲の人たちのおかげで、あまり前に出るタイプではない自分も自然体でいられます。清水さんが作る環境には、人を安心させる雰囲気があり、それが会社全体にも広がっていると感じます。`},
    {title:'具体的な仕事内容と一日の流れ',body:`現在はエンジニアとして、主にシステムの仕様書や設計書の作成を担当しています。業務の中心は設計ですが、それに関連する工程にも幅広く携わっており、たとえば検証項目書の作成を通じてテスト工程を設計したり、実施中に発生した不具合についての原因調査を行ったりすることもあります。また、検証に必要なデータの提供を依頼されることもあり、データベースから必要な情報を抽出して提供するなど、設計者の立場から開発全体を支えるような役割を担っています。

現在の現場はフルリモートで、設計業務においては個人の裁量が大きく任されているため、自分でスケジュールを組み立てながら進めるスタイルです。午前中にタスク整理や資料確認を行い、午後に集中して作業を進めるのが日課です。自由度が高い分、進捗管理はすべて自己責任になるので、遅れを出さないよう常に"巻き気味"を意識して取り組んでいます。`},
    {title:'仕事のやりがい、喜びを感じる瞬間',body:`前の現場では、当初の計画と実際の作業量に大きなギャップがありました。「短期間・少人数で終わる」と聞いて参画したのですが、蓋を開けてみると当初見積もりの9倍のタスクがあり、想定を大きく超える作業が必要な案件だったんです。スケジュールの延長とチームの増員によって、ようやく形にすることができました。確かに厳しい案件でしたが、チーム一丸となって乗り越えたことで、大きな達成感を得られましたし、自分自身の成長も実感できました。

この業界に入ったのは30代前後と、少し遅めのスタートでした。もともとはゲーム業界で働いていましたが、新たな挑戦としてIT業界に入り、最初の現場ではPGとして参画しました。Javaの基礎は勉強していたものの、実際の現場では「Spring」というJavaを応用したフレームワークが主に使われており、学んできた知識の多くが通用せず、毎日参考書を片手に現場へ通う日々。わからないことを一つひとつ先輩に聞きながら乗り越える毎日は本当に大変で、「自分はこの業界に向いていないのでは」と思うほど苦しい経験でした。今では逆にその経験があまりに厳しかったおかげで、以降の現場では「これくらいなら大丈夫」と感じられるようになりました。あの経験が、自分の大きな糧になっていると感じています。`},
    {title:'ワークライフバランスとプライベートの過ごし方',body:`カードゲームが趣味で大会に出るほど熱中しています。週末には友人同士でデッキを持ち寄って対戦したり、お互いにアドバイスし合ったりするのが恒例です。プレイヤーの年齢層も幅広く、20代の方と一緒に遊ぶこともあり、年齢を超えてつながれるのもこの趣味の魅力のひとつです。

仕事とプライベートは、普段はしっかり切り分けられていると思います。ただ、忙しい時期になると、遊んでいる最中でも「あの案件、どうなったかな」と気になってしまうことも。そういうときは友人と別れたあと、夕飯を食べながらパソコンを開いて追っかけてしまうこともありますね。`},
    {title:'今後の目標とキャリアプラン',body:`SESの仕事では技術力が重視されることが多いですが、今後は技術だけでなく「人をまとめる力」も高めていきたいと考えています。以前の案件では、自分がプロパーとして参画し、パートナーの方々をまとめる立場になることがありましたが、うまく管理しきれずミスやトラブルが発生してしまった経験があります。正直、自分でも思い出したくないような失敗もありました。現在はメンターとして若手の育成にも携わっているので、その経験を活かしながら、マネジメント力やリーダーシップも身につけていきたいと考えています。

また、ここ数年は品質保証や検証設計といった業務も多かったですが、開発に関わる機会も増やしていきたいと思っています。コーディングそのものが好きなので、技術面でも引き続き成長していきたいです。もともとはゲーム業界出身で、やりたいことに一通り挑戦したうえで今の業界に来ているため、他業界への転向などは考えていません。今の仕事を軸に、より深く、広くスキルを伸ばしていければと思っています。`}
  ]},
  nomura:{name:'',initial:'YN',avatar:'nomura',role:'コンサル補佐／成長中',chapters:[
    {title:'入社を決めた理由と入社後のギャップ',body:`求人サイトでのスカウトがきっかけです。メッセージを読んで興味を持ち、面接で詳しくお話を伺いました。その際、ホームページには載っていないような社内の写真や、働く人々の雰囲気を見せていただき、「この会社で働きたい」と強く感じて入社を決めました。

入社前からアットホームな会社だと想像はしていましたが、入社後はその想像をはるかに超えるアットホームさを実感しまして、非常に居心地が良いです。期待していた以上に、良い環境で働くことができていますね。`},
    {title:'具体的な仕事内容と一日の流れ',body:`現在は、パッケージ導入のコンサルタント補佐として、コンサルタントから依頼されたパッケージデータをウェブサイトに反映させる業務を担当しています。

一日の始まりは、10時からその日のタスクを確認・整理することから始めます。11時からの30分程度の朝会で、その日の作業内容をチームで共有し、各自の業務に取り掛かります。13時から14時頃にお昼休憩を挟み、19時に退社する流れです。各業務には期日がありますが、裁量を持って進められるので、自分のペースで仕事に取り組めるのが魅力ですね。`},
    {title:'仕事のやりがい、喜びを感じる瞬間',body:`ゲーム関連の品質保証の仕事に長く従事してきた私にとって、現在の業務は全くの新しい分野です。そのため、毎日新しい知識を吸収できることが、そのまま自身の成長に繋がっていると実感でき、大きなやりがいになっています。

最近、私のチームに新しくメンバーが入ってきたのですが、その方を指導する立場になったことが印象に残っていますね。以前は教えてもらう側でしたが、今では自分のわかる範囲ではあるものの、教えられるまで成長できたのだと実感しました。小さな一歩かもしれませんが、自分の成長を確かに感じられる、非常に嬉しい出来事でした。`},
    {title:'ワークライフバランスとプライベートの過ごし方',body:`休日は基本的に家で過ごすことが多いですね。野球が好きなので、シーズン中は野球中継を見ています。オフシーズンや野球がない日は、一日中ゲームをして過ごしています。年に1～2回は球場に足を運ぶこともありますが、基本的にはインドア派ですね。

仕事とプライベートはきっちり分けられるので、ワークライフバランスはうまく取れていると感じています。プライベートな時間をしっかり確保できるので、自分の趣味にも没頭できています。`},
    {title:'今後の目標とキャリアプラン',body:`今の現場は未経験の分野の仕事なので、まずは一つひとつの業務をしっかり覚えていきたいですね。現在、社長と同じ現場で働いており、社長がチームのまとめ役を担っています。出来るだけ早く、その業務を引き継いで社長の力になれるような存在になりたいと考えています。

また、これまでの経験を活かし、将来的にはマネージャーのようなまとめ役としてプロジェクトを引っ張っていきたいです。また、10年ほどゲームのQAに携わっていた経験を活かして、JSTQBなどの資格取得にも挑戦していきたいと考えています。`}
  ]},
  takano:{name:'',initial:'ST',avatar:'takano',role:'プロジェクトリーダー／大阪拠点',chapters:[
    {title:'入社を決めた理由と入社後のギャップ',body:`友人の紹介で清水代表と出会ったことが、入社のきっかけです。前職で自分のスキルに対する待遇に悩んでいたところ、友人がその話を代表に伝えてくれたんです。

面談で自分の技術を評価してもらえたので、「この会社なら、自分のスキルを活かしてやりがいのある仕事ができそうだ」と感じ、入社を決めました。

入社後もギャップは特にありませんでした。SESという働き方から、東京の会社なので、大阪にいる私は社内の人と関わる機会が少ないのではと想像していました。しかし実際は、定期的に連絡を取り合ったり、相談したりできる環境が整っており、孤立することなく仕事ができています。`},
    {title:'具体的な仕事内容と一日の流れ',body:`現在は、お客様の社内システムの運用保守を担当しています。PL（プロジェクトリーダー）という立場ですが、役割は主に設計です。プログラマーの方々と協力しながら、プロジェクトを進めています。

参画当初は、運用保守よりも改善業務を任されることが多く、半年ほどは改善に向けた提案や動きを担当していました。周りのメンバーとは少し異なる役割でしたが、新しい経験を積むことができました。

一日の始まりは、その日の作業予定を日報として立てることからスタートします。予定通りに作業を進められることがほとんどなので、スケジュールと実績に大きなズレはありません。`},
    {title:'仕事のやりがい、喜びを感じる瞬間',body:`システムエンジニアとしての技術だけでなく、業務改善など幅広い業務を任せてもらえることにやりがいを感じます。システムを前提とした改善提案を行うことで、業務全体の効率化に貢献できるのは大きな喜びです。

印象的なエピソードとして、新人の頃から人材育成に関わってきた経験が挙げられます。入社2年目から採用業務も担当するなど、他の人より早い段階から人を育てる経験を積んできました。どの現場でも人材育成を任されることが多く、この経験が自分の強みになっていると感じています。`},
    {title:'ワークライフバランスとプライベートの過ごし方',body:`20代の頃は家でゲームをすることが多かったのですが、最近は休日は積極的に外出して、友人とご飯を食べたり飲みに行くようにしています。

コロナ禍で人と会う機会が減り、精神的な負担を感じたため、意識的に人と会う時間を作るようにしているんです。そうすることでリフレッシュもできますし、メンタルケアにも繋がっています。

仕事とプライベートは問題なく両立できています。動けるうちは動こうと思って、アクティブに過ごしていますね。`},
    {title:'今後の目標とキャリアプラン',body:`現在、大阪を拠点に働いていますが、将来的には大阪に開発チームを立ち上げ、その中心となって会社に貢献していきたいと考えています。これまで培ってきた人材育成の経験や、周りをよく見てサポートする強みを活かしていきたいです。

また、エンジニアという枠にとらわれず、キャリアの幅を広げていきたいとも考えています。ウェブデザインの勉強を始め、そのスキルを会社の業務に活かせればと考えています。趣味でネイルチップを作成するなど、クリエイティブな活動にも興味があるので、そうした創作活動も仕事に繋げていけるよう、少しずつ進めていきたいです。`}
  ]}
};

const AVATARS={
  kawasaki:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="#00ffcc" stroke-width="2" fill="none"><circle cx="50" cy="38" r="18"/><circle cx="43" cy="38" r="5"/><circle cx="57" cy="38" r="5"/><line x1="48" y1="38" x2="52" y2="38"/><path d="M 25 95 Q 25 70 50 65 Q 75 70 75 95"/><path d="M 42 70 L 50 78 L 58 70"/></svg>`,
  kikuchi:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="#00ffcc" stroke-width="2" fill="none"><circle cx="50" cy="38" r="19"/><path d="M 33 32 Q 50 22 67 32"/><path d="M 20 95 Q 20 68 50 63 Q 80 68 80 95"/><path d="M 42 70 L 50 78 L 58 70"/></svg>`,
  masuda:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="#00ffcc" stroke-width="2" fill="none"><circle cx="50" cy="38" r="18"/><path d="M 32 38 Q 30 50 35 55"/><path d="M 68 38 Q 70 50 65 55"/><path d="M 34 25 Q 50 18 66 25"/><path d="M 25 95 Q 25 70 50 65 Q 75 70 75 95"/><path d="M 42 70 L 50 78 L 58 70"/></svg>`,
  nomura:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="#00ffcc" stroke-width="2" fill="none"><circle cx="50" cy="38" r="18"/><path d="M 33 30 Q 50 24 67 30"/><path d="M 36 25 Q 50 20 64 25"/><path d="M 25 95 Q 25 70 50 65 Q 75 70 75 95"/><path d="M 42 70 L 50 78 L 58 70"/></svg>`,
  takano:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="#00ffcc" stroke-width="2" fill="none"><circle cx="50" cy="35" r="16"/><path d="M 35 28 Q 50 22 65 28"/><line x1="46" y1="50" x2="46" y2="60"/><line x1="54" y1="50" x2="54" y2="60"/><path d="M 28 95 Q 28 70 50 65 Q 72 70 72 95"/><path d="M 42 70 L 50 78 L 58 70"/></svg>`
};

(function(){
  /* 無限ループ用：voice-track のカード 5 枚を複製して 10 枚にする */
  const track=document.querySelector('.recruit-section .voice-track');
  if(track){
    const originals=[...track.children];
    originals.forEach(c=>track.appendChild(c.cloneNode(true)));
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

  /* カード上の SVG プレースホルダーにイラスト注入 */
  cards.forEach(card=>{
    const slot=card.querySelector('.voice-svg');
    const key=card.dataset.member;
    if(slot&&AVATARS[key])slot.innerHTML=AVATARS[key];
  });

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

  /* reveal アニメ：recruit-section 内の .reveal を io で観察 */
  if(typeof io!=='undefined'&&io&&io.observe){
    document.querySelectorAll('.recruit-section .reveal').forEach(el=>io.observe(el));
  }
})();

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
