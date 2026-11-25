(function(){
"use strict";
var DATA=window.DIP_DATA||{questions:[],chapters:[],meta:{}};
var QS=DATA.questions||[];
var BY_ID={};
QS.forEach(function(q){BY_ID[q.id]=q;});
var LS_KEY="dip-quiz-state-v1";
var DEFAULT_STATE={version:1,answers:{},bookmarks:[],wrong:{},activity:{},settings:{instant:true,theme:"light",font:"normal"},mockHistory:[],lastQuestionId:null};
var state=loadState();
var view={name:"home"};
var session=null;
var mockTimer=null;
var toastTimer=null;

function clone(o){return JSON.parse(JSON.stringify(o));}
function loadState(){
  try{
    var raw=localStorage.getItem(LS_KEY);
    if(!raw) return clone(DEFAULT_STATE);
    var s=JSON.parse(raw)||{};
    var out=clone(DEFAULT_STATE);
    out.answers=s.answers||{};
    out.bookmarks=Array.isArray(s.bookmarks)?s.bookmarks:[];
    out.wrong=s.wrong||{};
    out.activity=s.activity||{};
    out.settings=Object.assign(out.settings,s.settings||{});
    out.mockHistory=Array.isArray(s.mockHistory)?s.mockHistory:[];
    out.lastQuestionId=s.lastQuestionId||null;
    return out;
  }catch(e){return clone(DEFAULT_STATE);}
}
function save(){
  try{localStorage.setItem(LS_KEY,JSON.stringify(state));}
  catch(e){toast("当前浏览器未允许本地存储，进度只保存在本页内存中");}
}
function qsel(sel,root){return (root||document).querySelector(sel);}
function qselAll(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel));}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function pad2(n){return n<10?"0"+n:String(n);}
function todayKey(){var d=new Date();return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate());}
function fmtDate(ts){var d=new Date(ts);return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate())+" "+pad2(d.getHours())+":"+pad2(d.getMinutes());}
function toast(msg){
  var t=qsel("#toast"); if(!t) return;
  t.textContent=msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(function(){t.classList.remove("show");},2200);
}
function applyTheme(t){
  if(t!=="dark"&&t!=="light") t="light";
  document.documentElement.setAttribute("data-theme",t);
  try{localStorage.setItem("dip-quiz-theme",t);}catch(e){}
  state.settings.theme=t;
  var icon=qsel("#themeIcon");
  if(icon){
    icon.innerHTML=t==="dark"
      ? '<path d="M20.8 13.1A8.2 8.2 0 0 1 10.9 3.2 8.5 8.5 0 1 0 20.8 13.1z"/>'
      : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>';
  }
}
function applyFont(f){document.body.classList.toggle("font-large",f==="large");state.settings.font=f;}
function stopMockTimer(){if(mockTimer){clearInterval(mockTimer);mockTimer=null;}}
function closeDrawer(){document.body.classList.remove("drawer-open");}

function isAnsweredRecord(a){
  if(!a) return false;
  return !!(a.answeredAt||a.correct!==undefined||a.selfScore!==undefined||a.viewed);
}
function computeStats(){
  var answered=0,objAns=0,objCorrect=0,selfAns=0,viewed=0,todayCount=0;
  QS.forEach(function(q){
    var a=state.answers[q.id]; if(!isAnsweredRecord(a)) return;
    answered++;
    if(q.isObjective && a.correct!==undefined){
      objAns++;
      if(a.correct) objCorrect++; else if(a.viewed) viewed++;
    } else {selfAns++;}
  });
  var today=todayKey();
  todayCount=state.activity[today]||0;
  var chapters=DATA.chapters.map(function(c){
    var qs=QS.filter(function(q){return q.part==="chapter"&&q.chapter===c.num;});
    var ca=0,cAns=0,cCor=0;
    qs.forEach(function(q){
      var a=state.answers[q.id]; if(!isAnsweredRecord(a)) return;
      ca++;
      if(q.isObjective&&a.correct!==undefined){cAns++;if(a.correct)cCor++;}
    });
    return {num:c.num,name:c.name,en:c.en,desc:c.desc,total:qs.length,answered:ca,objAns:cAns,correct:cCor,accuracy:cAns?Math.round(cCor/cAns*100):null};
  });
  var last7=[];
  for(var i=6;i>=0;i--){
    var d=new Date(); d.setDate(d.getDate()-i);
    var k=d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate());
    last7.push({key:k,label:(d.getMonth()+1)+"/"+d.getDate(),count:state.activity[k]||0});
  }
  var streak=0; var d2=new Date();
  while(true){
    var kk=d2.getFullYear()+"-"+pad2(d2.getMonth()+1)+"-"+pad2(d2.getDate());
    if((state.activity[kk]||0)>0){streak++;d2.setDate(d2.getDate()-1);} else break;
  }
  var pct=QS.length?Math.round(answered/QS.length*100):0;
  return {answered:answered,objAns:objAns,objCorrect:objCorrect,selfAns:selfAns,viewed:viewed,accuracy:objAns?Math.round(objCorrect/objAns*100):null,progress:pct,todayCount:todayCount,streak:streak,chapters:chapters,last7:last7,wrongCount:Object.keys(state.wrong).length};
}
function renderNav(){
  var st=computeStats();
  qselAll("[data-nav]").forEach(function(b){
    var name=b.getAttribute("data-nav");
    b.classList.toggle("active",name===view.name||(name==="chapter"&&view.name==="chapters")||(name==="wrong"&&view.name==="wrong")||(name==="favorites"&&view.name==="favorites")||(name==="mock"&&view.name.indexOf("mock")===0));
  });
  var nt=qsel("#navTotal"); if(nt)nt.textContent=String(QS.length);
  var nw=qsel("#navWrong"); if(nw)nw.textContent=String(st.wrongCount);
  var nf=qsel("#navFav"); if(nf)nf.textContent=String(state.bookmarks.length);
  var sp=qsel("#sideProgressText"); if(sp)sp.textContent=st.answered+" / "+QS.length;
  var sb=qsel("#sideProgressBar"); if(sb)sb.style.width=st.progress+"%";
  var sa=qsel("#sideAccuracy"); if(sa)sa.textContent=st.accuracy===null?"—":st.accuracy+"%";
}
function goHome(){stopMockTimer();view={name:"home"};session=null;closeDrawer();window.scrollTo(0,0);render();}
function navTo(name){
  if(name==="home"){goHome();return;}
  if(name==="chapter"){stopMockTimer();view={name:"chapters"};closeDrawer();window.scrollTo(0,0);render();return;}
  if(name==="random"){var ids=shuffle(QS.filter(function(q){return q.part==="chapter"||q.part==="design"||q.part==="special";})).slice(0,20).map(function(q){return q.id;});startSession(ids,{title:"随机练习 · 20 题",mode:"random"});return;}
  if(name==="wrong"){stopMockTimer();view={name:"wrong"};closeDrawer();window.scrollTo(0,0);render();return;}
  if(name==="favorites"){stopMockTimer();view={name:"favorites"};closeDrawer();window.scrollTo(0,0);render();return;}
  if(name==="mock"){stopMockTimer();view={name:"mock-intro"};closeDrawer();window.scrollTo(0,0);render();return;}
  if(name==="stats"){stopMockTimer();view={name:"stats"};closeDrawer();window.scrollTo(0,0);render();return;}
  if(name==="settings"){openSettings();return;}
}
function shuffle(arr){
  var a=arr.slice();
  for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
  return a;
}
function startSession(ids,opts){
  opts=opts||{};
  var list=ids.filter(function(id){return !!BY_ID[id];});
  if(!list.length){toast("这里还没有题目");return;}
  stopMockTimer();
  session={ids:list,index:0,mode:opts.mode||"practice",title:opts.title||"练习",startedAt:Date.now(),locked:{},selected:{},revealed:{},correct:{},self:{},drafts:{},viewed:{},submitted:false};
  view={name:"practice"};
  closeDrawer();window.scrollTo(0,0);render();
}
function currentQ(){return session?BY_ID[session.ids[session.index]]:null;}
function gotoQuestion(i){
  if(!session)return;
  if(i<0)i=0; if(i>=session.ids.length)i=session.ids.length-1;
  session.index=i; state.lastQuestionId=session.ids[i]; save();
  window.scrollTo(0,0); render();
}
function recordObjective(q,selected,correct,viewed){
  var a=state.answers[q.id]||{};
  a.selected=selected;a.correct=correct;a.viewed=!!viewed;a.answeredAt=Date.now();a.attempts=(a.attempts||0)+1;
  state.answers[q.id]=a;
  if(correct) delete state.wrong[q.id]; else state.wrong[q.id]=true;
  state.lastQuestionId=q.id; bumpActivity(); save();
}
function recordSelf(q,score){
  var a=state.answers[q.id]||{};
  a.selfScore=score;a.answeredAt=Date.now();a.attempts=(a.attempts||0)+1;
  state.answers[q.id]=a;
  state.lastQuestionId=q.id; bumpActivity(); save();
}
function bumpActivity(){var k=todayKey();state.activity[k]=(state.activity[k]||0)+1;}
function toggleBookmark(id){
  var i=state.bookmarks.indexOf(id);
  if(i>=0){state.bookmarks.splice(i,1);toast("已取消收藏");}
  else{state.bookmarks.push(id);toast("已收藏");}
  save();renderNav();
  if(view.name==="practice"||view.name==="favorites")render();
}
function openQuestion(id){
  if(!BY_ID[id])return;
  startSession([id],{title:"题目回看",mode:"search"});
}


function render(){
  renderNav();
  if(view.name==="home"){renderHome();}
  else if(view.name==="chapters"){renderChapters();}
  else if(view.name==="practice"){renderPractice();}
  else if(view.name==="wrong"){renderCollection("wrong");}
  else if(view.name==="favorites"){renderCollection("favorites");}
  else if(view.name==="mock-intro"){renderMockIntro();}
  else if(view.name==="mock-exam"){renderMockExam();}
  else if(view.name==="mock-result"){renderMockResult();}
  else if(view.name==="stats"){renderStats();}
  else {renderHome();}
}

function renderHome(){
  var st=computeStats();
  var pct=st.progress;
  var circ=2*Math.PI*50;
  var off=circ*(1-pct/100);
  var last=state.lastQuestionId&&BY_ID[state.lastQuestionId];
  var chapterCards=DATA.chapters.map(function(c){
    var cs=st.chapters.filter(function(x){return x.num===c.num;})[0]||{answered:0,total:c.total,accuracy:null};
    var p=cs.total?Math.round(cs.answered/cs.total*100):0;
    return '<button class="chapter-card" data-action="chapter" data-chapter="'+c.num+'">'
      +'<div class="num">'+pad2(c.num)+'</div>'
      +'<h3>'+esc(c.name)+'</h3>'
      +'<div class="en">'+esc(c.en)+'</div>'
      +'<div class="desc">'+esc(c.desc)+'</div>'
      +'<div class="chapter-bar"><span style="width:'+p+'%"></span></div>'
      +'<div class="chapter-foot"><span class="pill">'+cs.total+' 题</span><span>'+(cs.accuracy===null?"未开始":cs.accuracy+"% 正确率")+'</span><span>'+cs.answered+' / '+cs.total+'</span></div>'
      +'</button>';
  }).join("");
  var heroStats='<div class="hero-stats">'
    +'<div class="hero-stat"><b>'+QS.length+'</b><span>总题量</span></div>'
    +'<div class="hero-stat"><b>'+DATA.chapters.length+'</b><span>章覆盖</span></div>'
    +'<div class="hero-stat"><b>'+DATA.meta.objectiveTotal+'</b><span>客观题</span></div>'
    +'<div class="hero-stat"><b>'+DATA.meta.mockTotal+'</b><span>模拟卷题</span></div>'
    +'</div>';
  var html=''
    +'<section class="hero"><div class="hero-inner"><div>'
    +'<div class="eyebrow">DIP · Final Review Lab</div>'
    +'<h1>把十章内容，<br>刷成一条清晰的流水线。</h1>'
    +'<p>从采样量化、空域频域，到形态学、分割、特征与分类。先章节打底，再错题回炉，最后用 90 分钟模拟卷收口。</p>'
    +'<div class="hero-actions">'
    +'<button class="btn primary" data-action="random">随机 20 题</button>'
    +'<button class="btn ghost" data-action="mock">进入模拟考试</button>'+'<a class="btn ghost" href="textbook.html">课本习题 403</a>'
    +(last?'<button class="btn ghost" data-action="resume">继续上次</button>':'')
    +'</div>'+heroStats+'</div>'
    +'<div class="kernel-card"><div class="kernel"><span>−1</span><span>0</span><span>1</span><span>−2</span><span>0</span><span>2</span><span>−1</span><span>0</span><span>1</span></div><small>SOBEL · EDGE</small></div></div></section>'
    +'<section class="dashboard-grid">'
    +'<div class="card card-pad progress-card">'
    +'<div class="ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="50"></circle><circle class="fg" cx="60" cy="60" r="50" stroke-dasharray="'+circ.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"></circle></svg><div class="pct">'+pct+'%</div></div>'
    +'<div class="progress-info"><div class="card-label">Overall Progress</div><h3>总进度 · '+st.answered+' / '+QS.length+'</h3><p>每答一题都会自动记录；换设备可用设置里的导出/导入迁移。</p><div class="mini-legend"><span><i class="dot" style="background:var(--green)"></i>已掌握 '+st.objCorrect+'</span><span><i class="dot" style="background:var(--red)"></i>错题 '+st.wrongCount+'</span><span><i class="dot" style="background:var(--amber-2)"></i>待复习 '+(QS.length-st.answered)+'</span></div></div>'
    +'</div>'
    +'<div class="card card-pad stat-card"><div><div class="card-label">Objective Accuracy</div><div class="stat-big">'+(st.accuracy===null?"—":st.accuracy+"%")+'</div><div class="stat-sub">客观题正确率 · '+st.objCorrect+' / '+st.objAns+' 次作答</div></div><div class="stat-line"><span>主观题自评</span><b>'+st.selfAns+' 题</b></div></div>'
    +'<div class="card card-pad stat-card"><div><div class="card-label">Today</div><div class="stat-big">'+st.todayCount+'</div><div class="stat-sub">今日答题数 · 连续 '+st.streak+' 天</div></div><div class="stat-line"><span>建议</span><b>'+(st.answered===0?"从第 2、3 章开始":st.accuracy!==null&&st.accuracy<70?"先回炉错题":"保持节奏")+'</b></div></div>'
    +'</section>'
    +'<div class="section-head"><div><h2>十章地图</h2><p>按章节推进，进度条会随着作答自动填充。</p></div><button class="btn ghost sm" data-nav="chapter">查看全部章节 →</button></div>'
    +'<section class="chapter-grid">'+chapterCards+'</section>'
    +'<section class="banner-mock"><div class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/><path d="M12 2v3"/></svg></div><div><h3>综合模拟卷 · 37 题 / 100 分</h3><p>选择 20 分 · 判断 10 分 · 填空 20 分 · 简答 20 分 · 计算 30 分 ｜ 限时 90 分钟</p></div><button class="btn primary" data-action="mock">开始模拟</button></section>';
  qsel("#view").innerHTML=html;
}

function renderChapters(){
  var st=computeStats();
  var rows=DATA.chapters.map(function(c){
    var cs=st.chapters.filter(function(x){return x.num===c.num;})[0]||{answered:0,total:c.total,accuracy:null};
    var p=cs.total?Math.round(cs.answered/cs.total*100):0;
    return '<div class="card card-pad" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:10px">'
      +'<div style="font-family:Georgia,serif;font-size:30px;color:var(--teal);width:52px;flex:none;text-align:center">'+pad2(c.num)+'</div>'
      +'<div style="flex:1;min-width:180px"><h3 style="margin:0;font-size:16px">'+esc(c.name)+'</h3><div style="font-size:11px;color:var(--muted);margin-top:2px">'+esc(c.desc)+'</div><div class="chapter-bar" style="max-width:520px"><span style="width:'+p+'%"></span></div></div>'
      +'<div style="display:flex;gap:14px;font-size:11px;color:var(--muted);flex-wrap:wrap"><span>单选 '+c.byType.single+'</span><span>判断 '+c.byType.tf+'</span><span>填空 '+c.byType.fill+'</span><span>简答 '+c.byType.short+'</span><span>计算 '+c.byType.calc+'</span></div>'
      +'<div style="text-align:right;min-width:100px"><div style="font-size:11px;color:var(--muted)">'+cs.answered+' / '+cs.total+'</div><div style="font-size:12px;font-weight:800;color:'+(cs.accuracy===null?"var(--muted)":"var(--teal)")+'">'+(cs.accuracy===null?"未开始":cs.accuracy+"%")+'</div></div>'
      +'<button class="btn primary sm" data-action="chapter" data-chapter="'+c.num+'">开始</button>'
      +'</div>';
  }).join("");
  var types=[["single","单选题"],["tf","判断题"],["fill","填空题"],["short","简答题"],["calc","计算题"],["design","方案设计"]];
  var typeBtns=types.map(function(t){
    var n=QS.filter(function(q){return q.type===t[0]&&q.part!=="mock";}).length;
    return '<button class="btn ghost sm" data-action="type" data-type="'+t[0]+'">'+t[1]+' <span style="color:var(--muted);font-weight:400">'+n+'</span></button>';
  }).join("");
  qsel("#view").innerHTML=''
    +'<div class="page-head"><button class="icon-btn back" data-nav="home" aria-label="返回首页">←</button><div><h1>章节练习</h1><p>按章节顺序刷，或按题型做专项突破。</p></div></div>'
    +'<div class="card card-pad" style="margin-bottom:18px"><div class="card-label">Type Sprint · 题型专项</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+typeBtns+'</div></div>'
    +rows;
}

function collectionIds(kind){
  if(kind==="wrong") return Object.keys(state.wrong).filter(function(id){return !!BY_ID[id];});
  if(kind==="favorites") return state.bookmarks.filter(function(id){return !!BY_ID[id];});
  return [];
}
function renderCollection(kind){
  var ids=collectionIds(kind);
  var title=kind==="wrong"?"错题本":"收藏夹";
  var desc=kind==="wrong"?"答错或查看答案的题会自动进入这里；答对后自动移出。":"你手动收藏的题目会集中在这里，适合考前回看。";
  var rows=ids.map(function(id){
    var q=BY_ID[id];var rec=state.answers[id]||{};
    var status=rec.correct===true?"已答对":rec.correct===false?"待回炉":"未作答";
    return '<div class="card card-pad" style="margin-bottom:9px"><div style="display:flex;gap:12px;align-items:flex-start"><div style="flex:1;min-width:0"><div class="q-meta" style="margin-bottom:7px"><span class="badge chapter">'+(q.chapter?("第"+q.chapter+"章"):esc(q.chapterName))+'</span><span class="badge type">'+esc(q.typeLabel)+'</span>'+(q.origin?'<span class="badge origin">'+esc(q.origin)+'</span>':'')+'<span style="font-size:11px;color:var(--muted)">'+status+'</span></div><div style="font-size:13px;line-height:1.6;color:var(--ink-2);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+esc(q.stem)+'</div></div><button class="btn ghost sm" data-action="open-question" data-id="'+q.id+'">打开</button></div></div>';
  }).join("");
  var empty='<div class="empty"><div class="big">◇</div><h3>'+title+'还是空的</h3><p>'+desc+'</p><button class="btn primary" data-action="random">先刷 20 道随机题</button></div>';
  qsel("#view").innerHTML=''
    +'<div class="page-head"><button class="icon-btn back" data-nav="home" aria-label="返回首页">←</button><div><h1>'+title+' <span style="font-size:14px;color:var(--muted);font-family:inherit">'+ids.length+' 题</span></h1><p>'+desc+'</p></div>'+(ids.length?'<div class="head-actions"><button class="btn primary" data-action="practice-collection" data-kind="'+kind+'">开始重练</button></div>':'')+'</div>'
    +(ids.length?rows:empty);
}


function recordViewed(q){
  var a=state.answers[q.id]||{};
  a.viewed=true;a.answeredAt=Date.now();a.attempts=(a.attempts||0)+1;
  state.answers[q.id]=a;state.lastQuestionId=q.id;bumpActivity();save();
}
function submitObjective(key){
  var q=currentQ();if(!q)return;
  if(q.type!=="single"&&q.type!=="tf")return;
  var correct=key===q.answerLabel;
  session.selected[q.id]=key;session.locked[q.id]=true;session.correct[q.id]=correct;
  recordObjective(q,key,correct,false);
  render();
}
function chooseOption(key){
  var q=currentQ();if(!q||q.type!=="single")return;
  if(session.locked[q.id])return;
  if(state.settings.instant){submitObjective(key);return;}
  session.selected[q.id]=key;render();
}
function chooseTF(key){
  var q=currentQ();if(!q||q.type!=="tf")return;
  if(session.locked[q.id])return;
  if(state.settings.instant){submitObjective(key);return;}
  session.selected[q.id]=key;render();
}
function revealAnswer(){
  var q=currentQ();if(!q)return;
  session.revealed[q.id]=true;
  if(q.isObjective){
    if(!session.locked[q.id]){session.locked[q.id]=true;session.correct[q.id]=false;session.selected[q.id]=null;session.viewed[q.id]=true;recordObjective(q,null,false,true);}
  }else{
    recordViewed(q);
  }
  render();
}
function setSelfScore(score){
  var q=currentQ();if(!q)return;
  session.self[q.id]=score;recordSelf(q,score);render();
}
function renderAnswerPanel(q){
  if(!(session.locked[q.id]||session.revealed[q.id]))return "";
  var ok=session.correct[q.id]===true;
  var viewed=!!session.viewed[q.id]&&q.isObjective;
  var banner= q.isObjective
    ? (ok?'<div class="answer-banner ok">✓ 回答正确</div>':viewed?'<div class="answer-banner neutral">已查看答案</div>':'<div class="answer-banner no">× 回答错误</div>')
    : '<div class="answer-banner neutral">参考答案与解析</div>';
  var label="";
  if(q.answerLabel){label='<span class="answer-label">'+esc(q.answerLabel)+'</span>';}
  var body=q.answerHtml||"<p>暂无额外解析。</p>";
  var self="";
  if(!q.isObjective){
    var cur=session.self[q.id];
    if(cur===undefined){var ar=state.answers[q.id];if(ar&&ar.selfScore!==undefined)cur=ar.selfScore;}
    var labels=["不会","有印象","基本掌握","熟练"];
    var buttons=labels.map(function(t,i){return '<button class="self-btn '+(cur===i?"on":"")+'" data-action="self" data-score="'+i+'">'+t+'</button>';}).join("");
    self='<div class="self-assess"><b>这题掌握得怎么样？</b>'+buttons+'</div>';
  }
  return '<div class="answer-panel">'+banner+'<div class="answer-content">'+label+body+'</div>'+self+'</div>';
}
function renderPractice(){
  if(!session){goHome();return;}
  var q=currentQ();if(!q){goHome();return;}
  var total=session.ids.length;
  var locked=!!session.locked[q.id];
  var revealed=!!session.revealed[q.id];
  var selected=session.selected[q.id];
  var qmeta='<div class="q-meta"><span class="badge chapter">'+(q.chapter?("第 "+q.chapter+" 章 · "+esc(q.chapterName)):esc(q.chapterName))+'</span><span class="badge type">'+esc(q.typeLabel)+'</span>'+(q.origin?'<span class="badge origin">'+esc(q.origin)+'</span>':'')+'<span class="badge">第 '+(session.index+1)+' / '+total+' 题</span><span class="stars">'+'★'.repeat(q.stars||0)+'</span></div>';
  var body="";
  if(q.type==="single"){
    var opts=q.options.map(function(o){
      var cls="option";
      if(selected===o.key)cls+=" selected";
      if(locked){
        if(o.key===q.answerLabel)cls+=" correct";
        if(selected===o.key&&selected!==q.answerLabel)cls+=" wrong";
      }
      return '<button class="'+cls+'" data-action="option" data-key="'+o.key+'" '+(locked?"disabled":"")+'><span class="letter">'+o.key+'</span><span>'+o.html+'</span></button>';
    }).join("");
    body='<div class="options">'+opts+'</div>';
  } else if(q.type==="tf"){
    var f1=selected==="√"?" selected":"", f2=selected==="×"?" selected":"";
    if(locked){if(q.answerLabel==="√")f1+=" correct";else f1+=" wrong";if(q.answerLabel==="×")f2+=" correct";else f2+=" wrong";if(selected==="√"&&q.answerLabel!=="√")f1+=" wrong";if(selected==="×"&&q.answerLabel!=="×")f2+=" wrong";}
    body='<div class="tf-options"><button class="tf-btn'+f1+'" data-action="tf" data-key="√" '+(locked?"disabled":"")+'>√<small>正确</small></button><button class="tf-btn'+f2+'" data-action="tf" data-key="×" '+(locked?"disabled":"")+'>×<small>错误</small></button></div>';
  } else if(q.type==="fill"){
    var n=Math.max(q.blankCount||0,1);
    var inputs="";
    for(var i=0;i<n;i++){
      var val=(session.drafts[q.id]&&session.drafts[q.id][i])||"";
      inputs+='<div class="fill-row"><label>空 '+(i+1)+'</label><input data-fill="'+i+'" value="'+esc(val)+'" placeholder="输入你的答案" '+(revealed?"disabled":"")+'></div>';
    }
    body='<div class="fill-fields">'+inputs+'</div>';
  } else {
    var draft=(session.drafts[q.id]&&session.drafts[q.id].text)||"";
    body='<textarea data-draft="text" rows="6" placeholder="先自己写要点，再对照参考答案。计算题建议写出公式与关键步骤。" style="width:100%;border:1px solid var(--line);border-radius:11px;padding:12px 13px;background:var(--panel);resize:vertical;outline:none;line-height:1.8" '+(revealed?"disabled":"")+'>'+esc(draft)+'</textarea>';
  }
  var actions='<div class="q-actions">'
    +'<button class="btn ghost sm bookmark-btn '+(state.bookmarks.indexOf(q.id)>=0?"active":"")+'" data-action="bookmark" data-id="'+q.id+'">'
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/></svg> 收藏</button>'
    +'<button class="btn ghost sm" data-action="prev" '+(session.index===0?"disabled":"")+'>← 上一题</button>'
    +'<span class="spacer"></span>';
  if(q.type==="single"&&!locked&&!state.settings.instant){actions+='<button class="btn primary" data-action="submit">提交答案</button>';}
  else if(q.type==="tf"&&!locked&&!state.settings.instant){actions+='<button class="btn primary" data-action="submit">提交答案</button>';}
  else if((q.type==="fill"||!q.isObjective)&&!revealed){actions+='<button class="btn primary" data-action="reveal">提交并对照答案</button>';}
  else if(q.isObjective&&!locked){actions+='<button class="btn ghost" data-action="reveal">不会，看答案</button>';}
  actions+='<button class="btn primary" data-action="next" '+(session.index>=total-1?"disabled":"")+'>下一题 →</button></div>';
  var panel=renderAnswerPanel(q);
  var map=session.ids.map(function(id,idx){
    var qq=BY_ID[id];if(!qq)return "";
    var cls="";
    var a=state.answers[id]||{};
    if(idx===session.index)cls+=" current";
    if(session.correct[id]===true||(a.correct===true&&!session.correct.hasOwnProperty(id)))cls+=" correct";
    if(session.correct[id]===false||(a.correct===false&&!session.correct.hasOwnProperty(id)))cls+=" wrong";
    if(session.revealed[id]||a.viewed)cls+=" viewed";
    if(state.bookmarks.indexOf(id)>=0)cls+=" bookmarked";
    return '<button class="'+cls+'" data-action="goto" data-index="'+idx+'" title="第 '+(idx+1)+' 题">'+(idx+1)+'</button>';
  }).join("");
  var title=session.title||"练习";
  if(session.mode==="chapter"){var c=DATA.chapters.filter(function(x){return x.num===q.chapter;})[0];if(c)title="第 "+c.num+" 章 · "+c.name;}
  qsel("#view").innerHTML=''
    +'<div class="page-head"><button class="icon-btn back" data-nav="home" aria-label="返回首页">←</button><div><h1>'+esc(title)+'</h1><p>第 '+(session.index+1)+' / '+total+' 题 · '+(session.mode==="wrong"?"错题重练":session.mode==="favorites"?"收藏回看":session.mode==="random"?"随机练习":session.mode==="search"?"单题回看":"章节练习")+'</p></div><div class="head-actions"><button class="btn ghost sm" data-action="exit">退出练习</button></div></div>'
    +'<div class="practice-layout"><section class="card question-card">'+qmeta+'<div class="q-title">'+q.stemHtml+'</div>'+body+panel+actions+'</section>'
    +'<aside class="card side-card"><h4>答题卡 · '+total+' 题</h4><div class="qmap">'+map+'</div><div class="map-legend"><span><i class="dot" style="background:var(--navy)"></i>当前</span><span><i class="dot" style="background:var(--green)"></i>正确</span><span><i class="dot" style="background:var(--red)"></i>错误</span><span><i class="dot" style="background:var(--amber-2)"></i>看过</span></div><div style="margin-top:14px;font-size:11px;color:var(--muted);line-height:1.8">快捷键：<b>A–D / 1–4</b> 选选项；<b>← →</b> 切题；<b>B</b> 收藏；<b>?</b> 帮助</div></aside></div>';
}


function resumeLast(){
  var q=state.lastQuestionId&&BY_ID[state.lastQuestionId];
  if(!q){toast("还没有上次记录，先随机刷几题");return;}
  if(q.part==="chapter"){
    var ids=QS.filter(function(x){return x.part==="chapter"&&x.chapter===q.chapter;}).map(function(x){return x.id;});
    startSession(ids,{title:"第 "+q.chapter+" 章 · "+q.chapterName,mode:"chapter"});
    var idx=ids.indexOf(q.id);if(idx>=0){session.index=idx;render();}
  }else{openQuestion(q.id);}
}
function startMock(){
  var ids=QS.filter(function(q){return q.part==="mock";}).sort(function(a,b){return a.num-b.num;}).map(function(q){return q.id;});
  session={ids:ids,index:0,mode:"mock",title:"综合模拟卷",startedAt:Date.now(),finishedAt:0,duration:90*60,locked:{},selected:{},revealed:{},correct:{},self:{},drafts:{},viewed:{},selfScores:{},submitted:false};
  view={name:"mock-exam"};stopMockTimer();window.scrollTo(0,0);render();startMockTimer();
}
function startMockTimer(){
  stopMockTimer();
  if(!session||session.mode!=="mock"||session.submitted)return;
  function tick(){
    if(!session||session.mode!=="mock"||session.submitted){stopMockTimer();return;}
    var rem=Math.max(0,session.duration*1000-(Date.now()-session.startedAt));
    var el=qsel("#mockTimer");
    if(el){el.textContent=fmtClock(Math.ceil(rem/1000));el.classList.toggle("warn",rem<5*60*1000);}
    if(rem<=0){stopMockTimer();submitMock(true);}
  }
  tick();mockTimer=setInterval(tick,1000);
}
function fmtClock(sec){var m=Math.floor(sec/60),s=sec%60;return pad2(m)+":"+pad2(s);}
function renderMockIntro(){
  var hist=state.mockHistory.slice(-5).reverse();
  var rows=hist.map(function(h){
    return '<div class="score-line"><span>'+fmtDate(h.date)+'</span><b>'+h.total+' / 100</b></div>';
  }).join("")||'<div class="score-line"><span>还没有模拟记录</span><b>—</b></div>';
  qsel("#view").innerHTML=''
    +'<div class="page-head"><button class="icon-btn back" data-nav="home" aria-label="返回首页">←</button><div><h1>综合模拟卷</h1><p>按期末题型比例组卷，限时 90 分钟；客观题自动判分，主观题对照参考答案自评。</p></div></div>'
    +'<div class="mock-hero"><section class="mock-rule"><h2>37 题 · 100 分</h2><p>选择 20 分 · 判断 10 分 · 填空 20 分 · 简答 20 分 · 计算 30 分。建议先完整做完，再统一对答案。</p><ul><li>选择 / 判断：点击选项，交卷后自动判分</li><li>填空 / 简答 / 计算：写出关键词或步骤，交卷后按参考答案自评</li><li>中途退出会保留本次作答；计时到 0 自动交卷</li></ul><div class="meta-grid"><div><b>90</b><span>分钟</span></div><div><b>37</b><span>题</span></div><div><b>100</b><span>分</span></div></div><div style="margin-top:22px"><button class="btn primary" data-action="start-mock">开始考试 →</button></div></section>'
    +'<aside class="card mock-side"><div class="card-label">Recent Attempts</div><h3 style="margin:8px 0 12px;font-size:17px">最近模拟成绩</h3>'+rows+'<div style="margin-top:18px;font-size:11px;color:var(--muted);line-height:1.8">建议在完成章节练习后再做模拟卷；做完后按错题本回炉。</div></aside></div>'
    +'<div class="card card-pad"><div class="card-label">How scoring works</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px;font-size:12px;line-height:1.8"><div><b>客观题 · 30 分</b><br><span style="color:var(--muted)">单选 10×2 + 判断 10×1，系统自动判。</span></div><div><b>填空 · 20 分</b><br><span style="color:var(--muted)">10 空×2，交卷后逐题自评。</span></div><div><b>简答+计算 · 50 分</b><br><span style="color:var(--muted)">简答 4×5；计算 12+10+8。</span></div></div></div>';
}
function renderMockExam(){
  if(!session||session.mode!=="mock"){view={name:"mock-intro"};render();return;}
  var q=currentQ();if(!q)return;
  var total=session.ids.length;
  var selected=session.selected[q.id];
  var qmeta='<div class="q-meta"><span class="badge chapter">'+esc(q.chapterName)+'</span><span class="badge type">'+esc(q.typeLabel)+'</span>'+(q.origin?'<span class="badge origin">'+esc(q.origin)+'</span>':'')+'<span class="badge">第 '+(session.index+1)+' / '+total+' 题</span></div>';
  var body="";
  if(q.type==="single"){
    body='<div class="options">'+q.options.map(function(o){return '<button class="option '+(selected===o.key?"selected":"")+'" data-action="mock-option" data-key="'+o.key+'"><span class="letter">'+o.key+'</span><span>'+o.html+'</span></button>';}).join("")+'</div>';
  }else if(q.type==="tf"){
    body='<div class="tf-options"><button class="tf-btn '+(selected==="√"?"selected":"")+'" data-action="mock-tf" data-key="√">√<small>正确</small></button><button class="tf-btn '+(selected==="×"?"selected":"")+'" data-action="mock-tf" data-key="×">×<small>错误</small></button></div>';
  }else if(q.type==="fill"){
    var n=Math.max(q.blankCount||0,1);var inputs="";
    for(var i=0;i<n;i++){var val=(session.drafts[q.id]&&session.drafts[q.id][i])||"";inputs+='<div class="fill-row"><label>空 '+(i+1)+'</label><input data-fill="'+i+'" value="'+esc(val)+'" placeholder="写下你的答案"></div>';}
    body='<div class="fill-fields">'+inputs+'</div>';
  }else{
    var draft=(session.drafts[q.id]&&session.drafts[q.id].text)||"";
    body='<textarea data-draft="text" rows="6" placeholder="写出关键步骤或要点，交卷后对照参考答案自评。" style="width:100%;border:1px solid var(--line);border-radius:11px;padding:12px 13px;background:var(--panel);resize:vertical;outline:none;line-height:1.8">'+esc(draft)+'</textarea>';
  }
  var map=session.ids.map(function(id,idx){return '<button class="'+(idx===session.index?"current":"")+'" data-action="mock-goto" data-index="'+idx+'">'+(idx+1)+'</button>';}).join("");
  var answered=session.ids.filter(function(id){var qq=BY_ID[id];return qq&&(session.selected[id]!==undefined||(session.drafts[id]&&(session.drafts[id].text||session.drafts[id][0]!==undefined)));}).length;
  var pct=Math.round(answered/total*100);
  qsel("#view").innerHTML=''
    +'<div class="exam-head"><div class="timer" id="mockTimer">'+fmtClock(session.duration)+'</div><div class="exam-progress">已作答 '+answered+' / '+total+' · 自动保存<div class="bar"><span style="width:'+pct+'%"></span></div></div><button class="btn primary sm" data-action="mock-submit">交卷</button></div>'
    +'<div class="practice-layout"><section class="card question-card">'+qmeta+'<div class="q-title">'+q.stemHtml+'</div>'+body+'<div class="q-actions"><button class="btn ghost sm" data-action="prev" '+(session.index===0?"disabled":"")+'>← 上一题</button><span class="spacer"></span><button class="btn primary" data-action="next" '+(session.index>=total-1?"disabled":"")+'>下一题 →</button></div></section>'
    +'<aside class="card side-card"><h4>答题卡</h4><div class="qmap">'+map+'</div><div style="margin-top:12px;font-size:11px;color:var(--muted);line-height:1.8">选择/判断交卷后自动判分；填空和主观题交卷后自评。</div></aside></div>';
  var tl=qsel("#mockTimer");if(tl){var rem=Math.max(0,session.duration*1000-(Date.now()-session.startedAt));tl.textContent=fmtClock(Math.ceil(rem/1000));tl.classList.toggle("warn",rem<5*60*1000);}
}
function mockMax(q){if(q.type==="fill")return 2;if(q.type==="short")return 5;if(q.type==="calc")return DATA.mockCalcWeights[q.id]||0;return q.type==="single"?2:1;}
function mockScore(){
  var obj=0,sub=0;
  session.ids.forEach(function(id){
    var q=BY_ID[id];if(!q)return;
    if(q.type==="single"||q.type==="tf"){if(session.selected[id]===q.answerLabel)obj+=mockMax(q);}
    else{sub+=session.selfScores[id]||0;}
  });
  return {objective:obj,sub:sub,total:obj+sub};
}
function saveMockHistory(){
  if(!session||session.mode!=="mock")return;
  var s=mockScore();
  var entry={date:Date.now(),objective:s.objective,sub:s.sub,total:s.total,duration:Math.min(session.duration,Math.round((Date.now()-session.startedAt)/1000))};
  if(session.historyIndex===undefined){state.mockHistory.push(entry);session.historyIndex=state.mockHistory.length-1;}
  else{state.mockHistory[session.historyIndex]=entry;}
  save();
}
function submitMock(auto){
  if(!session||session.mode!=="mock"||session.submitted)return;
  var unanswered=session.ids.filter(function(id){var q=BY_ID[id];return q&&q.isObjective&&session.selected[id]===undefined;}).length;
  if(!auto&&unanswered>0&&!confirm("还有 "+unanswered+" 道客观题未作答，确定交卷吗？"))return;
  stopMockTimer();
  session.submitted=true;
  session.finishedAt=Date.now();
  session.ids.forEach(function(id){
    var q=BY_ID[id];if(!q)return;
    if(q.type==="single"||q.type==="tf"){
      var sel=session.selected[id];
      if(sel!==undefined){recordObjective(q,sel,sel===q.answerLabel,false);}
    }
  });
  session.result=true;saveMockHistory();
  view={name:"mock-result"};window.scrollTo(0,0);render();
}
function renderMockResult(){
  if(!session||session.mode!=="mock"||!session.submitted){view={name:"mock-intro"};render();return;}
  var s=mockScore();
  var used=Math.min(session.duration,Math.round(((session.finishedAt||Date.now())-session.startedAt)/1000));
  var subMax=70;
  var subj=session.ids.map(function(id){var q=BY_ID[id];return q;}).filter(function(q){return q&&!q.isObjective;});
  var selfRows=subj.map(function(q){
    var max=mockMax(q);var cur=session.selfScores[q.id]||0;
    var vals=[0,Math.round(max/2),max];
    return '<div style="padding:12px 0;border-bottom:1px solid var(--line-2)"><div style="display:flex;justify-content:space-between;gap:12px;font-size:12.5px"><b>'+q.num+'. '+esc(q.typeLabel)+' · '+max+' 分</b><span style="color:var(--muted)">自评 '+cur+' / '+max+'</span></div><div style="display:flex;gap:6px;margin-top:7px">'+vals.map(function(v){return '<button class="self-btn '+(cur===v?"on":"")+'" data-action="mock-self" data-id="'+q.id+'" data-score="'+v+'">'+(v===0?"0 分":v===max?"满分":v+" 分")+'</button>';}).join("")+'</div></div>';
  }).join("");
  var detail=session.ids.map(function(id){
    var q=BY_ID[id];if(!q)return "";
    var sel=session.selected[id];var stat="";
    if(q.isObjective){stat=sel===q.answerLabel?'<span class="mark ok">正确</span>':sel===undefined?'<span class="mark self">未答</span>':'<span class="mark no">错误</span>';}
    else{var sc=session.selfScores[id]||0;stat='<span class="mark self">自评 '+sc+'/'+mockMax(q)+'</span>';}
    var ans=q.answerLabel?'正确答案：<b>'+esc(q.answerLabel)+'</b>。':'';
    return '<details class="review-q"><summary><span class="no">'+q.num+'</span><span class="q">'+esc(q.stem).slice(0,90)+'</span>'+stat+'</summary><div class="review-body">'+ans+(q.answerHtml||"")+'</div></details>';
  }).join("");
  qsel("#view").innerHTML=''
    +'<div class="page-head"><button class="icon-btn back" data-nav="home" aria-label="返回首页">←</button><div><h1>模拟卷结果</h1><p>客观题已自动判分；主观题请按参考答案自评，分数会实时更新。</p></div><div class="head-actions"><button class="btn ghost" data-action="mock-again">再考一次</button><button class="btn primary" data-action="mock-review">查看逐题对照</button></div></div>'
    +'<section class="result-hero"><div class="result-score">'+s.total+'<small> / 100</small></div><div><h2>'+(s.total>=85?"状态很好，继续保稳":s.total>=70?"基础不错，回炉错题":"先把基础分拿稳")+'</h2><p>客观题 '+s.objective+' / 30 ｜ 主观题自评 '+s.sub+' / '+subMax+' ｜ 用时 '+fmtClock(used)+'</p></div></section>'
    +'<div class="result-grid"><div class="result-box"><div class="k">选择题</div><div class="v">'+session.ids.filter(function(id){return BY_ID[id].type==="single"&&session.selected[id]===BY_ID[id].answerLabel;}).length+' / 10</div></div><div class="result-box"><div class="k">判断题</div><div class="v">'+session.ids.filter(function(id){return BY_ID[id].type==="tf"&&session.selected[id]===BY_ID[id].answerLabel;}).length+' / 10</div></div><div class="result-box"><div class="k">客观题得分</div><div class="v">'+s.objective+' / 30</div></div></div>'
    +'<div class="card card-pad" style="margin-bottom:16px"><div class="card-label">主观题自评 · 点击按钮即时更新总分</div>'+selfRows+'</div>'
    +'<div class="card card-pad" id="mockReview"><div class="card-label" style="margin-bottom:8px">逐题对照</div>'+detail+'</div>';
}
function renderStats(){
  var st=computeStats();
  var maxAct=Math.max.apply(null,st.last7.map(function(x){return x.count;}).concat([1]));
  var bars=st.last7.map(function(x){var h=x.count?Math.max(6,Math.round(x.count/maxAct*100)):2;return '<div class="day"><div class="bar" style="height:'+h+'%"></div><div class="d">'+x.label+'</div></div>';}).join("");
  var rows=st.chapters.map(function(c){
    var p=c.total?Math.round(c.answered/c.total*100):0;
    return '<tr><td><b>'+c.num+'</b>　'+esc(c.name)+'</td><td>'+c.answered+' / '+c.total+'</td><td class="bar-cell"><div class="table-bar"><span style="width:'+p+'%"></span></div></td><td>'+(c.accuracy===null?"—":c.accuracy+"%")+'</td></tr>';
  }).join("");
  var weak=st.chapters.filter(function(c){return c.objAns>=3;}).sort(function(a,b){return (a.accuracy||0)-(b.accuracy||0);}).slice(0,3);
  var weakHtml=weak.length?weak.map(function(c){return '<div class="score-line"><span>第 '+c.num+' 章 · '+esc(c.name)+'</span><b>'+(c.accuracy===null?"—":c.accuracy+"%")+'</b></div>';}).join(""):'<div class="score-line"><span>再做几题后生成薄弱章节</span><b>—</b></div>';
  qsel("#view").innerHTML=''
    +'<div class="page-head"><button class="icon-btn back" data-nav="home" aria-label="返回首页">←</button><div><h1>学习统计</h1><p>数据来自本机作答记录；导出后可在另一台设备导入。</p></div><div class="head-actions"><button class="btn ghost sm" data-action="export">导出进度</button></div></div>'
    +'<div class="stats-grid"><div class="card card-pad big-stat"><div class="card-label">Answered</div><div class="v">'+st.answered+'</div><div class="l">已作答 / '+QS.length+' 题</div><div class="sub">总进度 '+st.progress+'%</div></div><div class="card card-pad big-stat"><div class="card-label">Accuracy</div><div class="v">'+(st.accuracy===null?"—":st.accuracy+"%")+'</div><div class="l">客观题正确率</div><div class="sub">'+st.objCorrect+' / '+st.objAns+' 次作答</div></div><div class="card card-pad big-stat"><div class="card-label">Wrong Book</div><div class="v">'+st.wrongCount+'</div><div class="l">待回炉错题</div><div class="sub">答对后自动移出</div></div><div class="card card-pad big-stat"><div class="card-label">Streak</div><div class="v">'+st.streak+'</div><div class="l">连续学习天数</div><div class="sub">今日 '+st.todayCount+' 题</div></div></div>'
    +'<div style="display:grid;grid-template-columns:1.3fr .7fr;gap:16px;margin-bottom:16px"><div class="card card-pad"><div class="card-label">Last 7 Days</div><div class="activity">'+bars+'</div></div><div class="card card-pad"><div class="card-label">Weak Chapters</div><div style="margin-top:8px">'+weakHtml+'</div></div></div>'
    +'<div class="card card-pad"><div class="card-label">Chapter Breakdown</div><table class="chapter-table" style="margin-top:10px"><thead><tr><th>章节</th><th>进度</th><th>完成度</th><th>正确率</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

function openModal(html){var m=qsel("#modalMask");m.innerHTML=html;m.classList.add("open");}
function closeModal(){var m=qsel("#modalMask");m.classList.remove("open");m.innerHTML="";}
function openSettings(){
  var s=state.settings;
  var html='<div class="modal"><h3>偏好设置</h3><p class="sub">进度自动保存在当前浏览器；换设备请用导出/导入。</p>'
    +'<div class="setting"><div><b>即时判题</b><span>选择题点击选项后立即显示对错；关闭后需点“提交答案”。</span></div><button class="switch '+(s.instant?"on":"")+'" data-action="toggle-instant" aria-label="即时判题"></button></div>'
    +'<div class="setting"><div><b>主题</b><span>长时间刷题建议用深色或暖色。</span></div><div class="seg"><button class="'+(s.theme==="light"?"on":"")+'" data-action="set-theme" data-value="light">浅色</button><button class="'+(s.theme==="dark"?"on":"")+'" data-action="set-theme" data-value="dark">深色</button></div></div>'
    +'<div class="setting"><div><b>字号</b><span>题干和解析的字号。</span></div><div class="seg"><button class="'+(s.font!=="large"?"on":"")+'" data-action="set-font" data-value="normal">标准</button><button class="'+(s.font==="large"?"on":"")+'" data-action="set-font" data-value="large">大号</button></div></div>'
    +'<div class="setting"><div><b>进度数据</b><span>导出为 JSON，或从另一台设备导入。</span></div><div style="display:flex;gap:6px"><button class="btn ghost sm" data-action="export">导出</button><button class="btn ghost sm" data-action="import">导入</button></div></div>'
    +'<div class="setting"><div><b>清空进度</b><span>删除全部作答、错题、收藏与模拟成绩，不可恢复。</span></div><button class="btn danger sm" data-action="reset">清空</button></div>'
    +'<div style="margin-top:16px;font-size:11px;color:var(--muted);line-height:1.9"><b>快捷键</b><br><span class="kbd-help"><kbd>A</kbd>–<kbd>D</kbd> / <kbd>1</kbd>–<kbd>4</kbd> 选择选项　<kbd>←</kbd><kbd>→</kbd> 上一题/下一题　<kbd>B</kbd> 收藏　<kbd>/</kbd> 搜索　<kbd>?</kbd> 帮助</span></div>'
    +'<div class="modal-actions"><button class="btn ghost" data-action="close-modal">关闭</button></div>'
    +'<input type="file" id="importFile" accept="application/json,.json" style="display:none">'
    +'</div>';
  openModal(html);
}
function openHelp(){
  openModal('<div class="modal"><h3>快捷键与小贴士</h3><p class="sub">刷题时不必离开键盘。</p><div class="kbd-help" style="font-size:12.5px;line-height:2.2"><kbd>A</kbd>–<kbd>D</kbd> / <kbd>1</kbd>–<kbd>4</kbd> 选择选项<br><kbd>←</kbd> / <kbd>→</kbd> 或 <kbd>J</kbd> / <kbd>K</kbd> 切换题目<br><kbd>B</kbd> 收藏当前题<br><kbd>/</kbd> 聚焦搜索框<br><kbd>?</kbd> 打开这个帮助<br><br>判断题：<kbd>1</kbd> 选 √，<kbd>2</kbd> 选 ×。填空/简答先自己写，再点“提交并对照答案”。</div><div class="modal-actions"><button class="btn primary" data-action="close-modal">知道了</button></div></div>');
}
function exportProgress(){
  var blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);
  var d=new Date();a.download="DIP复习进度_"+d.getFullYear()+pad2(d.getMonth()+1)+pad2(d.getDate())+".json";
  document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  toast("已导出进度文件");
}


function randomIds(n){return shuffle(QS.filter(function(q){return q.part!=="mock";})).slice(0,n).map(function(q){return q.id;});}
function startChapter(num){var c=DATA.chapters.filter(function(x){return x.num===num;})[0];var ids=QS.filter(function(q){return q.part==="chapter"&&q.chapter===num;}).map(function(q){return q.id;});startSession(ids,{title:c?("第 "+c.num+" 章 · "+c.name):"章节练习",mode:"chapter"});}
function startType(type){var ids=QS.filter(function(q){return q.type===type&&q.part!=="mock";}).map(function(q){return q.id;});var names={single:"单选题专项",tf:"判断题专项",fill:"填空题专项",short:"简答题专项",calc:"计算题专项",design:"方案设计专项"};startSession(ids,{title:names[type]||"题型专项",mode:"type"});}
function selectMock(key){var q=currentQ();if(!q)return;session.selected[q.id]=key;render();}
function renderSearch(v){
  var pop=qsel("#searchPop");if(!pop)return;
  var query=String(v||"").trim();
  if(!query){pop.classList.remove("open");pop.innerHTML="";return;}
  var terms=query.toLowerCase().split(/\s+/).filter(Boolean);
  var res=[];
  for(var i=0;i<QS.length&&res.length<12;i++){
    var hay=QS[i].search.toLowerCase();
    var ok=true;for(var j=0;j<terms.length;j++){if(hay.indexOf(terms[j])<0){ok=false;break;}}
    if(ok)res.push(QS[i]);
  }
  if(!res.length){pop.innerHTML='<div class="search-empty">没有找到相关题目，换个关键词试试</div>';pop.classList.add("open");return;}
  pop.innerHTML=res.map(function(q){return '<button class="search-result" data-action="search-result" data-id="'+q.id+'"><div class="sr-title">'+esc(q.stem).slice(0,90)+'</div><div class="sr-meta">'+(q.chapter?("第"+q.chapter+"章 · "):"")+esc(q.typeLabel)+' · 第 '+q.num+' 题</div></button>';}).join("");
  pop.classList.add("open");
}
function closeSearch(){var pop=qsel("#searchPop");if(pop){pop.classList.remove("open");pop.innerHTML="";}var inp=qsel("#searchInput");if(inp)inp.value="";}
function importFile(file){
  if(!file)return;
  var reader=new FileReader();
  reader.onload=function(){
    try{
      var obj=JSON.parse(String(reader.result));
      if(!obj||typeof obj!=="object"||!obj.answers)throw new Error("不是有效的进度文件");
      var ok=confirm("导入会覆盖当前进度，确定继续吗？");
      if(!ok)return;
      state=Object.assign(clone(DEFAULT_STATE),obj);
      state.settings=Object.assign({instant:true,theme:"light",font:"normal"},obj.settings||{});
      save();applyTheme(state.settings.theme);applyFont(state.settings.font);closeModal();render();toast("进度已导入");
    }catch(err){toast("导入失败：文件格式不正确");}
  };
  reader.readAsText(file,"utf-8");
}

document.addEventListener("click",function(e){
  var nav=e.target.closest("[data-nav]");
  if(nav){e.preventDefault();navTo(nav.getAttribute("data-nav"));return;}
  var el=e.target.closest("[data-action]");
  if(!el){
    if(e.target.id==="modalMask")closeModal();
    if(!e.target.closest(".search-wrap"))closeSearch();
    return;
  }
  var action=el.getAttribute("data-action");
  if(action==="random"){startSession(randomIds(20),{title:"随机练习 · 20 题",mode:"random"});return;}
  if(action==="mock"){view={name:"mock-intro"};stopMockTimer();window.scrollTo(0,0);render();return;}
  if(action==="start-mock"){startMock();return;}
  if(action==="resume"){resumeLast();return;}
  if(action==="chapter"){startChapter(+el.getAttribute("data-chapter"));return;}
  if(action==="type"){startType(el.getAttribute("data-type"));return;}
  if(action==="practice-collection"){var kind=el.getAttribute("data-kind");var ids=collectionIds(kind);startSession(ids,{title:kind==="wrong"?"错题重练":"收藏回看",mode:kind==="wrong"?"wrong":"favorites"});return;}
  if(action==="open-question"){openQuestion(el.getAttribute("data-id"));return;}
  if(action==="option"){chooseOption(el.getAttribute("data-key"));return;}
  if(action==="tf"){chooseTF(el.getAttribute("data-key"));return;}
  if(action==="submit"){var qq=currentQ();if(qq&&session.selected[qq.id]!==undefined)submitObjective(session.selected[qq.id]);else toast("先选一个选项");return;}
  if(action==="reveal"){revealAnswer();return;}
  if(action==="self"){setSelfScore(+el.getAttribute("data-score"));return;}
  if(action==="bookmark"){toggleBookmark(el.getAttribute("data-id"));return;}
  if(action==="prev"){if(session)gotoQuestion(session.index-1);return;}
  if(action==="next"){if(session)gotoQuestion(session.index+1);return;}
  if(action==="goto"){gotoQuestion(+el.getAttribute("data-index"));return;}
  if(action==="exit"){if(session&&session.mode==="mock"&&!session.submitted){if(!confirm("退出后本次模拟作答会保留但不会交卷，确定退出吗？"))return;}stopMockTimer();goHome();return;}
  if(action==="mock-option"){selectMock(el.getAttribute("data-key"));return;}
  if(action==="mock-tf"){selectMock(el.getAttribute("data-key"));return;}
  if(action==="mock-goto"){gotoQuestion(+el.getAttribute("data-index"));return;}
  if(action==="mock-submit"){submitMock(false);return;}
  if(action==="mock-again"){startMock();return;}
  if(action==="mock-review"){var mr=qsel("#mockReview");if(mr)mr.scrollIntoView({behavior:"smooth",block:"start"});return;}
  if(action==="mock-self"){var id=el.getAttribute("data-id");var score=+el.getAttribute("data-score");var q=BY_ID[id];if(q){session.selfScores[id]=score;recordSelf(q,score);saveMockHistory();renderMockResult();}return;}
  if(action==="search-result"){var sid=el.getAttribute("data-id");closeSearch();openQuestion(sid);return;}
  if(action==="set-theme"){applyTheme(el.getAttribute("data-value"));save();openSettings();return;}
  if(action==="set-font"){applyFont(el.getAttribute("data-value"));save();openSettings();return;}
  if(action==="toggle-instant"){state.settings.instant=!state.settings.instant;save();openSettings();return;}
  if(action==="export"){exportProgress();return;}
  if(action==="import"){var fi=qsel("#importFile");if(fi)fi.click();return;}
  if(action==="reset"){if(confirm("确定清空全部作答、错题、收藏和模拟成绩吗？此操作不可恢复。")){state=clone(DEFAULT_STATE);state.settings.theme=document.documentElement.getAttribute("data-theme")||"light";save();closeModal();applyTheme(state.settings.theme);applyFont(state.settings.font);goHome();toast("进度已清空");}return;}
  if(action==="close-modal"){closeModal();return;}
  if(action==="help"){openHelp();return;}
});
document.addEventListener("input",function(e){
  var t=e.target;
  if(t.id==="searchInput"){renderSearch(t.value);return;}
  if(t.hasAttribute&&t.hasAttribute("data-fill")){
    var q=currentQ();if(!q||!session)return;
    var idx=+t.getAttribute("data-fill");
    if(!session.drafts[q.id]||typeof session.drafts[q.id]!=="object")session.drafts[q.id]=[];
    session.drafts[q.id][idx]=t.value;
    return;
  }
  if(t.hasAttribute&&t.hasAttribute("data-draft")){
    var q2=currentQ();if(!q2||!session)return;
    if(!session.drafts[q2.id]||typeof session.drafts[q2.id]!=="object")session.drafts[q2.id]={};
    session.drafts[q2.id].text=t.value;
  }
});
document.addEventListener("change",function(e){
  if(e.target&&e.target.id==="importFile")importFile(e.target.files&&e.target.files[0]);
});
document.addEventListener("keydown",function(e){
  var tag=(e.target&&e.target.tagName||"").toLowerCase();
  var typing=tag==="input"||tag==="textarea"||tag==="select";
  if(e.key==="/"&&!typing&&!qsel("#modalMask").classList.contains("open")){e.preventDefault();var si=qsel("#searchInput");if(si)si.focus();return;}
  if(e.key==="?"&&!typing){e.preventDefault();openHelp();return;}
  if(e.key==="Escape"){closeSearch();if(qsel("#modalMask").classList.contains("open"))closeModal();return;}
  if(!session||typing||qsel("#modalMask").classList.contains("open"))return;
  if(e.key==="ArrowRight"||e.key==="j"||e.key==="J"){e.preventDefault();gotoQuestion(session.index+1);return;}
  if(e.key==="ArrowLeft"||e.key==="k"||e.key==="K"){e.preventDefault();gotoQuestion(session.index-1);return;}
  if(e.key==="b"||e.key==="B"){e.preventDefault();var cq=currentQ();if(cq)toggleBookmark(cq.id);return;}
  var cq2=currentQ();if(!cq2)return;
  if(cq2.type==="single"&&!session.locked[cq2.id]){
    var key="";
    if(/^[a-dA-D]$/.test(e.key))key=e.key.toUpperCase();
    else if(/^[1-4]$/.test(e.key))key="ABCD"[+e.key-1];
    if(key){e.preventDefault();chooseOption(key);}
  }else if(cq2.type==="tf"&&!session.locked[cq2.id]){
    if(e.key==="1"){e.preventDefault();chooseTF("√");}
    if(e.key==="2"){e.preventDefault();chooseTF("×");}
  }
  if(e.key==="Enter"){
    if(cq2.isObjective&&session.locked[cq2.id]){e.preventDefault();gotoQuestion(session.index+1);}
    else if(!state.settings.instant&&session.selected[cq2.id]!==undefined){e.preventDefault();submitObjective(session.selected[cq2.id]);}
  }
});

var elMenu=document.getElementById("menuBtn"),elMask=document.getElementById("mobileMask");
if(elMenu)elMenu.addEventListener("click",function(){document.body.classList.toggle("drawer-open");});
if(elMask)elMask.addEventListener("click",closeDrawer);
qsel("#themeBtn")&&qsel("#themeBtn").addEventListener("click",function(){applyTheme(state.settings.theme==="dark"?"light":"dark");save();});
qsel("#settingsBtn")&&qsel("#settingsBtn").addEventListener("click",openSettings);
qsel("#helpBtn")&&qsel("#helpBtn").addEventListener("click",openHelp);
qsel("#modalMask")&&qsel("#modalMask").addEventListener("click",function(e){if(e.target.id==="modalMask")closeModal();});
qsel("#searchInput")&&qsel("#searchInput").addEventListener("focus",function(){renderSearch(this.value);});
qsel("#searchInput")&&qsel("#searchInput").addEventListener("keydown",function(e){if(e.key==="Enter"){var first=qsel("#searchPop .search-result");if(first){e.preventDefault();first.click();}}});
window.addEventListener("hashchange",function(){});
if(!state.settings.theme)state.settings.theme=document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light";
applyTheme(state.settings.theme);applyFont(state.settings.font);render();
})();
