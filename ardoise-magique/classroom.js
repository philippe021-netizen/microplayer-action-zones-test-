const DEFAULT_URL='./lessons/r-01.json';
const ALPHABET_URL='../harmonie-alphabet/index.html';
const STORAGE_KEY='harmonie-classe-v2';
const LEGACY_KEY='harmonie-ardoise-v1';
const DISPLAY_SECONDS={easy:6,normal:5,champion:4};
const REVIEW_DAYS=[0,1,3,7,14,30];

const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick=a=>a[Math.floor(Math.random()*a.length)];

let lessons=[];
let currentLesson=null;
let currentItems=[];
let itemIndex=0;
let stars=0;
let hints=0;
let roundTries=0;
let recognitionBusy=false;
let timer=null;
let strokes=[];
let activeStroke=null;
let boardSize={w:0,h:0};
let audio=null,musicTimer=null,musicStep=0;
let teacherMotionToken=0;

let state={
  settings:{music:true,voice:true,sounds:true,guide:true},
  customLessons:[],
  stats:{},
  sessions:[]
};

const TEACHER={
  intro:['Coucou Harmonie ! On va jouer un peu avec les mots.','Coucou Harmonie ! Prête pour le tableau ?','Bonjour Harmonie ! On va faire ça tranquillement ensemble.'],
  memorize:['Regarde bien le mot que je te montre, prends ton temps.','Regarde bien le tableau, je te le montre avec ma règle.','Essaie de garder le mot dans ta tête comme une petite photo.'],
  write:['À toi Harmonie, tu peux écrire doucement.','Maintenant, écris ce que tu as retenu, sans te presser.','À ton tour, prends ton temps, je regarde.'],
  math:['Regarde bien le calcul, puis écris la réponse.','On calcule tranquillement, puis tu écris le résultat.'],
  checking:['Je regarde ton travail…','Voyons ça ensemble…','Je vérifie ton tableau…'],
  success:['Bravo Harmonie ! C’est juste.','Très bien ! Tu peux être fière de toi.','Oui, c’est réussi !'],
  retry:['On réessaie ensemble, je suis sûre que tu vas y arriver.','Regarde bien la correction, puis on recommence tranquillement.','Pas de souci, regarde bien et on réessaie ensemble.'],
  finish:['La classe est terminée. Beau travail !','C’est fini pour aujourd’hui. Bravo pour tes efforts !']
};

function defaultState(){
  return {settings:{music:true,voice:true,sounds:true,guide:true},customLessons:[],stats:{},sessions:[]};
}

function loadState(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(saved){
      state={...defaultState(),...saved,settings:{...defaultState().settings,...(saved.settings||{})},stats:saved.stats||{},sessions:Array.isArray(saved.sessions)?saved.sessions:[],customLessons:Array.isArray(saved.customLessons)?saved.customLessons:[]};
      return;
    }
  }catch{}
  state=defaultState();
  try{
    const old=JSON.parse(localStorage.getItem(LEGACY_KEY)||'{}');
    if(old.settings)state.settings={...state.settings,...old.settings};
    if(Array.isArray(old.lessons))state.customLessons=old.lessons;
    for(const [key,m] of Object.entries(old.words||{})){
      state.stats[key]={
        attempts:Number(m.presentations||0)+Number(m.retries||0),
        correct:Number(m.successes||0),
        errors:Number(m.retries||0),
        hints:Number(m.hints||0),
        streak:Math.max(0,Number(m.streak||0)),
        mastery:Math.max(0,Math.min(5,Number(m.streak||0))),
        last:m.last||null,
        due:Date.now()
      };
    }
    saveState();
  }catch{}
}

function saveState(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}

function normalizeLesson(raw){
  const type=raw.type==='math'?'math':'writing';
  const sourceItems=Array.isArray(raw.items)&&raw.items.length
    ? raw.items
    : (raw.words||[]).map((word,i)=>({id:'w'+(i+1),prompt:String(word),expected:String(word),mode:'memory'}));
  const items=sourceItems.map((item,i)=>{
    if(typeof item==='string')return {id:'i'+(i+1),prompt:item,expected:item,mode:type==='math'?'solve':'memory'};
    return {
      id:item.id||('i'+(i+1)),
      prompt:String(item.prompt??item.expected??''),
      expected:String(item.expected??item.prompt??''),
      mode:item.mode||(type==='math'?'solve':'memory'),
      type:item.type==='math'?'math':type
    };
  }).filter(x=>x.prompt&&x.expected);
  return {
    ...raw,
    id:raw.id||('lesson-'+Date.now()),
    type,
    title:raw.title||'Leçon',
    theme:raw.theme||raw.letter||'',
    difficulty:raw.difficulty||'normal',
    displaySeconds:Number(raw.displaySeconds||3),
    customPhrases:Array.isArray(raw.customPhrases)?raw.customPhrases:[],
    items
  };
}

async function loadLessons(){
  loadState();
  const loaded=[];
  try{
    const r=await fetch(DEFAULT_URL,{cache:'no-cache'});
    if(!r.ok)throw new Error('lesson');
    loaded.push(normalizeLesson(await r.json()));
  }catch{}
  for(const l of state.customLessons||[]){
    const n=normalizeLesson(l);
    if(n.items.length)loaded.push(n);
  }
  lessons=loaded;
  renderLessons();
  refreshToggles();
}

function mountTeachers(){
  const tpl=$('teacherTemplate');
  document.querySelectorAll('[data-teacher]').forEach(host=>{
    host.innerHTML='';
    host.append(tpl.content.cloneNode(true));
  });

  // Dans le jeu, la maîtresse est un vrai calque de premier plan :
  // elle ne prend plus de place dans la grille et peut passer devant le tableau.
  const actor=$('teacherActor');
  const room=document.querySelector('#game .classroom');
  if(actor&&room&&actor.parentElement!==room)room.appendChild(actor);
}

function teacherMotionImg(){
  return $('teacherActor')?.querySelector('.teacher-motion-anim')||null;
}

function setupTeacherMotion(){
  const actor=$('teacherActor');
  const anim=teacherMotionImg();
  if(!actor||!anim)return;
  actor.classList.remove('motion-ready','motion-active','motion-loaded');
  anim.removeAttribute('src');
}

function restartTeacherAnimation(){
  const actor=$('teacherActor');
  const old=teacherMotionImg();
  if(!actor||!old||!window.HARMONIE_TEACHER_POINT)return;

  const token=++teacherMotionToken;
  actor.classList.add('motion-ready','motion-active');
  actor.classList.remove('motion-loaded');

  const fresh=old.cloneNode(false);
  fresh.className='teacher-motion-anim';
  fresh.alt='';
  fresh.setAttribute('aria-hidden','true');

  fresh.onload=()=>{
    if(token!==teacherMotionToken)return;
    actor.classList.add('motion-loaded');
  };
  fresh.onerror=()=>{
    if(token!==teacherMotionToken)return;
    actor.classList.remove('motion-loaded','motion-ready','motion-active');
  };

  old.replaceWith(fresh);
  // Recréer le nœud IMG force Safari à recommencer le WebP animé au début.
  fresh.src=window.HARMONIE_TEACHER_POINT;
}

function startTeacherPointMotion(){
  restartTeacherAnimation();
}

function stopTeacherMotion(){
  teacherMotionToken++;
  const actor=$('teacherActor');
  const anim=teacherMotionImg();
  actor?.classList.remove('motion-ready','motion-active','motion-loaded');
  if(anim)anim.removeAttribute('src');
}

function screen(id){
  document.querySelectorAll('.screen').forEach(e=>e.classList.remove('active'));
  $(id).classList.add('active');
}

function itemKey(lesson,item){
  return (item._sourceLessonId||lesson.id)+'|'+(item.id||item.expected);
}

function statFor(lesson,item){
  const key=itemKey(lesson,item);
  if(!state.stats[key])state.stats[key]={attempts:0,correct:0,errors:0,hints:0,streak:0,mastery:0,last:null,due:0};
  return state.stats[key];
}

function allTrackedItems(){
  const out=[];
  for(const lesson of lessons){
    for(const item of lesson.items){
      out.push({lesson,item,stat:state.stats[itemKey(lesson,item)]||null});
    }
  }
  return out;
}

function dueItems(){
  const now=Date.now();
  return allTrackedItems()
    .filter(x=>x.stat&&x.stat.attempts>0&&Number(x.stat.due||0)<=now&&Number(x.stat.mastery||0)<5)
    .sort((a,b)=>(a.stat.mastery||0)-(b.stat.mastery||0)||Number(a.stat.due||0)-Number(b.stat.due||0));
}

function renderLessons(){
  const box=$('lessonList');
  box.innerHTML='';
  const due=dueItems();
  const review=document.createElement('div');
  review.className='lesson-card review-card';
  review.innerHTML='<strong>Révision de la maîtresse</strong><span>La classe reprend ce qui a besoin d’être consolidé.</span><div class="due">'+due.length+' à revoir</div><button class="mainbtn gold">Faire une révision</button>';
  review.querySelector('button').disabled=!due.length;
  review.querySelector('button').onclick=startReview;
  box.append(review);

  if(!lessons.length){
    const p=document.createElement('p');p.textContent='Aucune leçon disponible.';box.append(p);return;
  }
  for(const lesson of lessons){
    const card=document.createElement('div');
    card.className='lesson-card';
    const kind=lesson.type==='math'?'➕ Maths':'✏️ Écriture';
    card.innerHTML='<strong>'+safe(lesson.title)+'</strong><span>'+kind+' · '+lesson.items.length+' exercices</span><button class="mainbtn">Entrer en classe</button>';
    card.querySelector('button').onclick=()=>startLesson(lesson);
    box.append(card);
  }
}

function startReview(){
  const due=dueItems().slice(0,10);
  if(!due.length)return;
  const items=due.map((x,i)=>({...x.item,id:'review-'+i+'-'+x.item.id,type:x.lesson.type,_sourceType:x.lesson.type,_sourceLessonId:x.lesson.id,_sourceTitle:x.lesson.title}));
  const mixedMath=items.every(i=>{
    const src=lessons.find(l=>l.id===i._sourceLessonId);
    return src?.type==='math';
  });
  const lesson=normalizeLesson({
    id:'review-'+new Date().toISOString().slice(0,10),
    type:mixedMath?'math':'writing',
    title:'Révision de la maîtresse',
    theme:'révision',
    difficulty:'normal',
    displaySeconds:3,
    items
  });
  startLesson(lesson,items);
}

function startLesson(lesson,overrideItems){
  currentLesson=lesson;
  currentItems=(overrideItems||lesson.items).map(x=>({...x}));
  itemIndex=0;stars=0;
  screen('game');
  musicStart();
  sayTeacher(pick(TEACHER.intro));
  prepareRound();
}

function currentItem(){return currentItems[itemIndex]}
function exerciseType(item=currentItem()){return item?._sourceType||item?.type||currentLesson?.type||'writing'}

function prepareRound(){
  clearInterval(timer);
  strokes=[];activeStroke=null;hints=0;roundTries=0;recognitionBusy=false;
  $('done').disabled=false;$('done').textContent='J’ai fini !';
  $('roundNo').textContent='Exercice '+(itemIndex+1)+'/'+currentItems.length;
  $('progressBar').style.width=((itemIndex/currentItems.length)*100)+'%';
  $('starCount').textContent='⭐ '+stars;
  $('boardTitle').textContent=exerciseType()==='math'?'Calcul au tableau':'Regarde bien au tableau';
  $('boardPrompt').textContent='';
  $('boardPrompt').classList.remove('hidden-word');
  $('boardHelp').textContent='';
  $('countdown').textContent='';
  $('feedback').textContent='';
  $('writeZone').classList.remove('show');
  $('roundControls').classList.remove('hidden');
  $('writeControls').classList.add('hidden');
  $('afterControls').classList.add('hidden');
  $('retry').classList.add('hidden');
  $('nextWord').classList.add('hidden');
  $('chalkCorrection').classList.remove('show');
  $('chalkCorrection').innerHTML='';
  hideStamp();
  setTeacherPose('idle');
  resizeCanvas();
}

async function beginTeaching(){
  const startButton=$('startRound');
  const animationReady=window.HARMONIE_TEACHER_POINT_HD_READY;
  if(animationReady&&!window.HARMONIE_TEACHER_POINT){
    startButton.disabled=true;
    startButton.textContent='Je prépare le tableau…';
    try{
      await animationReady;
      if(!window.HARMONIE_TEACHER_POINT)throw window.HARMONIE_TEACHER_POINT_ERROR||new Error('Animation maîtresse indisponible');
    }catch(error){
      sayTeacher('La maîtresse ne peut pas venir au tableau. Rechargeons la classe.');
      $('feedback').textContent='L’animation ne s’est pas chargée. Vérifie la connexion puis recharge la page.';
      return;
    }finally{
      startButton.disabled=false;
      startButton.textContent='Je suis prête ✨';
    }
  }
  const item=currentItem();
  $('roundControls').classList.add('hidden');
  setTeacherPose('point');
  if(exerciseType(item)==='math'||item.mode==='solve'){
    $('boardPrompt').textContent=item.prompt;
    $('boardTitle').textContent='À toi de calculer';
    sayTeacher(pick(TEACHER.math));
    setTimeout(()=>enterWriting(false),800);
    return;
  }

  $('boardPrompt').textContent=item.prompt;
  const seconds=DISPLAY_SECONDS[currentLesson.difficulty]||currentLesson.displaySeconds||3;
  let left=seconds;
  $('countdown').textContent=left+' s';
  sayTeacher(pick(TEACHER.memorize));
  timer=setInterval(()=>{
    left--;
    if(left>0)$('countdown').textContent=left+' s';
    else{
      clearInterval(timer);timer=null;
      $('countdown').textContent='';
      // Laisse la maîtresse finir son geste avant de rendre la main à Harmonie.
      setTimeout(()=>{
        $('boardPrompt').classList.add('hidden-word');
        setTimeout(()=>enterWriting(true),700);
      },600);
    }
  },1000);
}

function enterWriting(hidePrompt){
  const item=currentItem();
  if(hidePrompt){
    $('boardPrompt').textContent='';
    $('boardPrompt').classList.remove('hidden-word');
  }
  $('boardTitle').textContent=exerciseType(item)==='math'?'Écris le résultat':'Écris ce que tu as retenu';
  $('boardHelp').textContent=exerciseType(item)==='math'?'Écris seulement la réponse.':'Écris le mot ou les mots avec ton doigt.';
  $('writeZone').classList.add('show');
  $('writeControls').classList.remove('hidden');
  setTeacherPose('idle');
  if(exerciseType(item)!=='math')sayTeacher(pick(TEACHER.write));
  resizeCanvas();
}

function setTeacherPose(pose){
  const actor=$('teacherActor');
  if(!actor)return;
  actor.classList.remove('pose-point','pose-check','pose-cheer');
  const room=document.querySelector('#game .classroom');
  room?.classList.toggle('teacher-pointing',pose==='point');

  if(pose==='point'){
    actor.classList.add('pose-point');
    startTeacherPointMotion();
  }else{
    stopTeacherMotion();
    if(pose==='check')actor.classList.add('pose-check');
    if(pose==='cheer')actor.classList.add('pose-cheer');
  }
}

function teacherFriendlyText(text){
  return String(text)
    .replace(/\+/g,' plus ')
    .replace(/-/g,' moins ')
    .replace(/[×x*]/g,' fois ')
    .replace(/÷|\//g,' divisé par ')
    .replace(/=/g,' égale ');
}

function sayTeacher(text){
  $('teacherSpeech').textContent=text;
  if(!state.settings.voice||!window.speechSynthesis)return;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(teacherFriendlyText(text));
    u.lang='fr-FR';
    // Ton plus doux, souriant et rassurant pour Harmonie.
    u.pitch=1.27;u.rate=.90;u.volume=.92;
    const voices=speechSynthesis.getVoices();
    const french=voices.filter(v=>v.lang?.toLowerCase().startsWith('fr'));
    u.voice=french.find(v=>/audrey|am[ée]lie|aurelie|marie|virginie|julie|female|woman/i.test(v.name)&&!/thomas|daniel|henri|male/i.test(v.name))
      ||french.find(v=>!/thomas|daniel|henri|male/i.test(v.name))
      ||french[0]
      ||null;
    musicStop();
    u.onend=()=>musicStart();
    u.onerror=()=>musicStart();
    speechSynthesis.speak(u);
  }catch{}
}

function getAudio(){
  if(!audio){
    const C=window.AudioContext||window.webkitAudioContext;
    if(C)audio=new C();
  }
  if(audio?.state==='suspended')audio.resume();
  return audio;
}

function tone(freq,duration=.16,volume=.035,type='sine'){
  const c=getAudio();if(!c)return;
  const o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.value=freq;
  g.gain.setValueAtTime(volume,c.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);
  o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration);
}

function chime(success=true){
  if(!state.settings.sounds)return;
  const notes=success?[659,784,988]:[392,349];
  notes.forEach((f,i)=>setTimeout(()=>tone(f,.22,.04,success?'sine':'triangle'),i*100));
}

function musicStart(){
  if(!state.settings.music||musicTimer)return;
  const notes=[392,440,523,440,349,392,494,392];
  musicTimer=setInterval(()=>{if(state.settings.music)tone(notes[musicStep++%notes.length],.18,.008,'sine')},650);
}

function musicStop(){clearInterval(musicTimer);musicTimer=null}

function resizeCanvas(){
  const c=$('boardCanvas'),box=$('writeZone');
  const w=box.clientWidth||700,h=box.clientHeight||320;
  if(!w||!h)return;
  if(boardSize.w&&boardSize.h&&(w!==boardSize.w||h!==boardSize.h)){
    const sx=w/boardSize.w,sy=h/boardSize.h;
    strokes=strokes.map(st=>st.map(p=>({...p,x:p.x*sx,y:p.y*sy})));
  }
  boardSize={w,h};
  const dpr=Math.min(window.devicePixelRatio||1,2);
  c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);
  const ctx=c.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  paint();
}

function paint(){
  const c=$('boardCanvas'),ctx=c.getContext('2d'),dpr=Math.min(window.devicePixelRatio||1,2);
  ctx.clearRect(0,0,c.width/dpr,c.height/dpr);
  ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#f8f5e7';ctx.lineWidth=5;
  ctx.shadowColor='#ffffff55';ctx.shadowBlur=1.2;
  for(const st of strokes)drawStroke(ctx,st);
  if(activeStroke?.length)drawStroke(ctx,activeStroke);
  ctx.shadowBlur=0;
}

function drawStroke(ctx,st){
  if(st.length<2)return;
  ctx.beginPath();ctx.moveTo(st[0].x,st[0].y);
  for(let i=1;i<st.length;i++)ctx.lineTo(st[i].x,st[i].y);
  ctx.stroke();
}

function pointPos(e){
  const r=$('boardCanvas').getBoundingClientRect();
  return{x:e.clientX-r.left,y:e.clientY-r.top,t:performance.now()};
}

function stopStroke(){
  if(!activeStroke)return;
  if(activeStroke.length>1)strokes.push(activeStroke);
  activeStroke=null;paint();
}

function makeRecognitionPayload(){
  const item=currentItem();
  const type=exerciseType(item);
  const lexicon=type==='writing'
    ? currentItems.filter(i=>exerciseType(i)==='writing').map(i=>i.expected)
    : [];
  return {
    expected:item.expected,
    mode:type==='math'?'math':'text',
    lexicon,
    board:{width:$('boardCanvas').clientWidth,height:$('boardCanvas').clientHeight},
    strokes:strokes.filter(s=>s.length>1).map(st=>({
      x:st.map(p=>Math.round(p.x*10)/10),
      y:st.map(p=>Math.round(p.y*10)/10),
      t:st.map(p=>Math.round(p.t))
    }))
  };
}

async function recognizeWriting(){
  const payload=makeRecognitionPayload();
  if(!payload.strokes.length)return {ok:true,match:false,empty:true};
  const r=await fetch('./api/recognize-handwriting',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.ok){
    const err=new Error(data.message||'Reconnaissance indisponible');
    err.code=data.code||'RECOGNITION_ERROR';
    throw err;
  }
  return data;
}

function recordAttempt(correct){
  const item=currentItem();
  const st=statFor(currentLesson,item);
  st.attempts=(st.attempts||0)+1;
  st.last=new Date().toISOString();
  if(correct){
    st.correct=(st.correct||0)+1;
    st.streak=(st.streak||0)+1;
    const gain=roundTries===0&&hints===0?1:0.6;
    st.mastery=Math.min(5,Math.round(((st.mastery||0)+gain)*10)/10);
    const level=Math.max(0,Math.min(5,Math.floor(st.mastery)));
    st.due=Date.now()+REVIEW_DAYS[level]*86400000;
  }else{
    st.errors=(st.errors||0)+1;
    st.streak=0;
    st.mastery=Math.max(0,Math.round(((st.mastery||0)-.7)*10)/10);
    st.due=Date.now()+5*60*1000;
  }
  st.hints=(st.hints||0)+hints;
  saveState();
}

function showStamp(text,type){
  const stamp=$('stamp');
  stamp.className='stamp show '+type;
  stamp.textContent=text;
}
function hideStamp(){
  const stamp=$('stamp');
  stamp.className='stamp';
  stamp.textContent='';
}

function correctionHtml(expected,mistakes){
  const marks=new Set(Array.isArray(mistakes)?mistakes:[]);
  if(!marks.size)return safe(expected);
  return [...expected].map((ch,i)=>marks.has(i)?'<span class="wrong">'+safe(ch)+'</span>':safe(ch)).join('');
}

function chalkRewrite(expected,mistakes){
  const el=$('chalkCorrection');
  el.innerHTML='';
  el.classList.add('show');
  const marks=new Set(Array.isArray(mistakes)?mistakes:[]);
  let i=0;
  const chars=[...expected];
  const write=()=>{
    if(i>=chars.length)return;
    const span=document.createElement('span');
    span.textContent=chars[i];
    if(marks.has(i))span.className='wrong';
    el.append(span);
    if(state.settings.sounds&&chars[i].trim())tone(900+Math.random()*140,.035,.008,'triangle');
    i++;
    setTimeout(write,55);
  };
  write();
}

async function checkWriting(){
  if(recognitionBusy)return;
  if(!strokes.some(s=>s.length>1)){
    $('feedback').textContent='Écris d’abord ta réponse sur le tableau.';
    sayTeacher('Écris d’abord ta réponse, puis je la corrige.');
    return;
  }
  recognitionBusy=true;
  $('done').disabled=true;$('done').textContent='La maîtresse vérifie…';
  $('writeControls').classList.add('hidden');
  $('boardHelp').textContent='';
  setTeacherPose('check');
  sayTeacher(pick(TEACHER.checking));

  try{
    const result=await recognizeWriting();
    if(result.match)handleCorrect();
    else handleWrong(result);
  }catch(err){
    setTeacherPose('idle');
    $('writeControls').classList.remove('hidden');
    if(err.code==='MYSCRIPT_NOT_CONFIGURED'){
      $('feedback').textContent='La reconnaissance MyScript doit encore être activée dans les réglages du projet.';
      sayTeacher('La correction automatique n’est pas encore activée.');
    }else{
      $('feedback').textContent='La correction automatique a eu un problème. Réessaie dans un instant.';
      sayTeacher('Je n’arrive pas à lire le tableau pour le moment. Réessaie.');
    }
  }finally{
    recognitionBusy=false;$('done').disabled=false;$('done').textContent='J’ai fini !';
  }
}

function handleCorrect(){
  recordAttempt(true);
  const earned=roundTries===0&&hints===0?3:(roundTries<=1?2:1);
  stars+=earned;
  $('starCount').textContent='⭐ '+stars;
  $('writeZone').classList.remove('show');
  $('boardPrompt').textContent='';
  $('boardTitle').textContent='Très bien !';
  $('feedback').textContent='Réussi '+('⭐'.repeat(earned));
  showStamp('BRAVO','good');
  setTeacherPose('cheer');
  chime(true);
  sayTeacher(pick(currentLesson.customPhrases?.length?currentLesson.customPhrases:TEACHER.success));
  $('afterControls').classList.remove('hidden');
  $('retry').classList.add('hidden');
  $('nextWord').classList.remove('hidden');
}

function handleWrong(result){
  recordAttempt(false);
  roundTries++;
  $('writeZone').classList.remove('show');
  $('boardTitle').textContent='La correction de la maîtresse';
  $('boardPrompt').textContent='';
  showStamp('À REVOIR','retry');
  chime(false);
  setTeacherPose('point');
  setTimeout(()=>chalkRewrite(currentItem().expected,result.mistakePositions),420);
  $('feedback').textContent='Regarde bien la correction au tableau.';
  sayTeacher(pick(TEACHER.retry));
  $('afterControls').classList.remove('hidden');
  $('retry').classList.remove('hidden');
  $('nextWord').classList.add('hidden');
}

function retryCurrent(){
  hideStamp();
  $('chalkCorrection').classList.remove('show');
  $('chalkCorrection').innerHTML='';
  strokes=[];activeStroke=null;paint();
  $('feedback').textContent='';
  $('afterControls').classList.add('hidden');
  $('writeControls').classList.remove('hidden');
  $('writeZone').classList.add('show');
  $('boardTitle').textContent='On réessaie';
  if(exerciseType()==='math'){
    $('boardPrompt').textContent=currentItem().prompt;
  }else{
    $('boardPrompt').textContent='';
  }
  setTeacherPose('idle');
  sayTeacher('À toi maintenant. Je suis sûre que tu vas y arriver.');
  resizeCanvas();
}

function nextExercise(){
  itemIndex++;
  if(itemIndex>=currentItems.length){finishLesson();return}
  prepareRound();
  sayTeacher('Exercice suivant.');
}

function finishLesson(){
  clearInterval(timer);musicStop();
  $('progressBar').style.width='100%';
  const session={
    date:new Date().toISOString(),
    lessonId:currentLesson.id,
    title:currentLesson.title,
    total:currentItems.length,
    stars
  };
  state.sessions.unshift(session);
  state.sessions=state.sessions.slice(0,60);
  saveState();
  screen('finish');
  $('finalStars').textContent='⭐'.repeat(Math.max(1,Math.min(12,Math.round(stars/2))));
  $('finalSummary').textContent='Tu as terminé '+currentItems.length+' exercices et gagné '+stars+' étoiles.';
  const weak=currentItems.filter(item=>(state.stats[itemKey(currentLesson,item)]?.mastery||0)<3);
  $('reviewSummary').textContent=weak.length
    ? 'La maîtresse remettra '+weak.length+' exercice'+(weak.length>1?'s':'')+' dans les prochaines révisions.'
    : 'Cette série est bien maîtrisée.';
  sayTeacher(pick(TEACHER.finish));
}

function renderProgress(){
  const tracked=allTrackedItems();
  const attempted=tracked.filter(x=>x.stat?.attempts>0);
  const attempts=attempted.reduce((n,x)=>n+(x.stat.attempts||0),0);
  const correct=attempted.reduce((n,x)=>n+(x.stat.correct||0),0);
  const mastered=attempted.filter(x=>(x.stat.mastery||0)>=4).length;
  const due=dueItems().length;
  $('statAttempts').textContent=attempts;
  $('statAccuracy').textContent=attempts?Math.round(correct/attempts*100)+'%':'0%';
  $('statMastered').textContent=mastered;
  $('statDue').textContent=due;

  if(!attempted.length){
    $('progressDetail').innerHTML='<p style="text-align:center">Les progrès apparaîtront ici après les premiers exercices.</p>';
    return;
  }

  const rows=attempted
    .sort((a,b)=>(a.stat.mastery||0)-(b.stat.mastery||0))
    .map(x=>{
      const pct=Math.round((x.stat.mastery||0)/5*100);
      const accuracy=x.stat.attempts?Math.round((x.stat.correct||0)/x.stat.attempts*100):0;
      return '<tr><td><b>'+safe(x.item.prompt)+'</b><br><span class="small">'+safe(x.lesson.title)+'</span></td><td>'+x.stat.attempts+'</td><td>'+accuracy+'%</td><td><div class="mastery"><i style="width:'+pct+'%"></i></div></td></tr>';
    }).join('');
  $('progressDetail').innerHTML='<table class="progress-table"><thead><tr><th>Exercice</th><th>Essais</th><th>Réussite</th><th>Maîtrise</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function openProgress(){
  renderProgress();
  screen('progressScreen');
}

function parseCustomItems(type,text){
  const lines=text.split(/\n/).map(s=>s.trim()).filter(Boolean);
  if(type==='writing'){
    return lines.map((line,i)=>({id:'w'+(i+1),prompt:line,expected:line,mode:'memory'}));
  }
  const out=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const parts=line.includes('=>')?line.split('=>'):line.split('=');
    if(parts.length<2)continue;
    const expected=parts.pop().trim();
    let prompt=parts.join('=').trim();
    if(!prompt.endsWith('='))prompt+=' =';
    if(prompt&&expected)out.push({id:'m'+(i+1),prompt,expected,mode:'solve'});
  }
  return out;
}

function saveCustomLesson(e){
  e.preventDefault();
  const type=$('activityType').value;
  const items=parseCustomItems(type,$('itemsInput').value);
  if(!items.length){
    $('parentMessage').textContent=type==='math'?'Ajoute au moins un calcul sous la forme 3 + 4 => 7.':'Ajoute au moins un mot.';
    return;
  }
  const lesson=normalizeLesson({
    id:'custom-'+Date.now(),
    type,
    title:$('titleInput').value.trim()||'Nouvelle leçon',
    theme:$('themeInput').value.trim(),
    difficulty:$('difficulty').value,
    displaySeconds:Number($('timeInput').value),
    items,
    customPhrases:$('phrasesInput').value.split(/\n/).map(s=>s.trim()).filter(Boolean)
  });
  state.customLessons.push(lesson);
  saveState();
  lessons.push(lesson);
  $('parentMessage').textContent='Leçon enregistrée. Elle est prête dans la classe.';
  setTimeout(()=>{screen('home');renderLessons()},650);
}

function refreshToggles(){
  $('musicToggle').textContent=state.settings.music?'🎵':'🔇';
  $('voiceToggle').textContent=state.settings.voice?'🗣️':'🤐';
  $('soundToggle').textContent=state.settings.sounds?'🔔':'🔕';
  $('guideLine').classList.toggle('hidden',!state.settings.guide);
  $('guideToggle').textContent=state.settings.guide?'≡ Lignes':'≡ Sans lignes';
}

function toggleSetting(key){
  state.settings[key]=!state.settings[key];
  if(key==='music'&&!state.settings.music)musicStop();
  if(key==='music'&&state.settings.music&&$('game').classList.contains('active'))musicStart();
  if(key==='voice'&&!state.settings.voice&&window.speechSynthesis)speechSynthesis.cancel();
  saveState();refreshToggles();
}

function parentOpen(){
  const code=prompt('Code parent');
  if(code===null)return;
  if(code!=='2741'){alert('Code incorrect.');return}
  screen('parent');
}

$('boardCanvas').addEventListener('pointerdown',e=>{
  if(!$('writeZone').classList.contains('show'))return;
  e.preventDefault();
  $('boardCanvas').setPointerCapture?.(e.pointerId);
  activeStroke=[pointPos(e)];
  paint();
});
$('boardCanvas').addEventListener('pointermove',e=>{
  if(!activeStroke)return;
  e.preventDefault();
  const events=e.getCoalescedEvents?.()||[e];
  for(const ev of events)activeStroke.push(pointPos(ev));
  paint();
});
$('boardCanvas').addEventListener('pointerup',stopStroke);
$('boardCanvas').addEventListener('pointercancel',stopStroke);

$('startRound').onclick=beginTeaching;
$('done').onclick=checkWriting;
$('retry').onclick=retryCurrent;
$('nextWord').onclick=nextExercise;
$('undo').onclick=()=>{strokes.pop();paint()};
$('clear').onclick=()=>{strokes=[];activeStroke=null;paint()};
$('hintBtn').onclick=()=>{
  hints++;
  const item=currentItem();
  const st=statFor(currentLesson,item);
  st.hints=(st.hints||0)+1;saveState();
  if(exerciseType(item)==='math'){
    if(hints===1){sayTeacher('Petit indice : avance étape par étape.');$('feedback').textContent='Compte ou calcule doucement, étape par étape.'}
    else{sayTeacher('Relis bien le calcul au tableau.');$('feedback').textContent='Relis le calcul avant d’écrire ta réponse.'}
    return;
  }
  if(hints===1){sayTeacher(item.expected);$('feedback').textContent='Écoute bien le mot.'}
  else if(hints===2){$('feedback').textContent='Il commence par « '+item.expected.trim()[0].toLocaleUpperCase('fr')+' ».';sayTeacher('Il commence par la lettre '+item.expected.trim()[0])}
  else{
    $('chalkCorrection').textContent=item.expected;
    $('chalkCorrection').classList.add('show');
    $('feedback').textContent='Regarde vite le modèle.';
    setTimeout(()=>$('chalkCorrection').classList.remove('show'),1200);
  }
};
$('guideToggle').onclick=()=>{state.settings.guide=!state.settings.guide;saveState();refreshToggles()};

$('leaveGame').onclick=()=>{clearInterval(timer);musicStop();screen('home');renderLessons()};
$('toLessons').onclick=()=>{screen('home');renderLessons()};
$('playAgain').onclick=()=>startLesson(currentLesson);
$('finishProgress').onclick=openProgress;
$('openProgress').onclick=openProgress;
$('progressBack').onclick=()=>{screen('home');renderLessons()};
$('backAlphabet').onclick=()=>location.href=ALPHABET_URL;

$('musicToggle').onclick=()=>toggleSetting('music');
$('voiceToggle').onclick=()=>toggleSetting('voice');
$('soundToggle').onclick=()=>toggleSetting('sounds');

let gateTimer=null;
$('parentGate').addEventListener('pointerdown',()=>gateTimer=setTimeout(parentOpen,900));
for(const ev of ['pointerup','pointercancel','pointerleave'])$('parentGate').addEventListener(ev,()=>clearTimeout(gateTimer));
$('parentDone').onclick=()=>{screen('home');renderLessons()};
$('lessonForm').onsubmit=saveCustomLesson;
$('activityType').onchange=()=>{
  const math=$('activityType').value==='math';
  $('itemsInput').placeholder=math?'3 + 4 => 7\n10 - 3 => 7':'une rue\nle roi\nun arbre';
  $('themeInput').value=math?'Calculs':'R';
};
window.addEventListener('resize',()=>{if($('writeZone').classList.contains('show'))resizeCanvas()});
window.addEventListener('pagehide',()=>{musicStop();if(window.speechSynthesis)speechSynthesis.cancel()});

mountTeachers();
setupTeacherMotion();
loadLessons();
refreshToggles();
