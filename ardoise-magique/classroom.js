const DEFAULT_URLS=['./lessons/r-01.json','./lessons/alphabet-2letters.json'];
const ALPHABET_URL='../harmonie-alphabet/index.html';
const STORAGE_KEY='harmonie-classe-v2';
const LEGACY_KEY='harmonie-ardoise-v1';
const DISPLAY_SECONDS={easy:6,normal:5,champion:4};
const TEACHER_MOTION_SECONDS=10;
const TEACHER_NUDGE_DELAY=30000;
const AUTO_NEXT_DELAY=3200;
const AUTO_RETRY_DELAY=3200;
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
let teacherNudgeTimer=null;
let teacherNudgeIndex=0;
let autoFlowTimer=null;
let strokes=[];
let activeStroke=null;
let alphabetSelection=[];
let unicornStep=0;
let unicornTreasures=0;
let unicornSurpriseTimer=null;
let boardSize={w:0,h:0};
let audio=null,musicTimer=null,musicStep=0;
let teacherMotionToken=0;
let teacherFrameVideo=null;
let teacherVoiceNode=null;
let teacherVoiceToken=0;
const teacherVoiceCache=new Map();

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
  nudge:[
    'Allez Harmonie, je sais que tu vas y arriver.',
    'Prends ton temps, réfléchis tranquillement.',
    'Si tu veux un indice, touche l’ampoule.',
    'Tu peux y arriver toute seule, prends ton temps.',
    'Encore un petit effort, la licorne t’attend !',
    'Pas besoin de te presser, je te laisse chercher.'
  ],
  alphabetNudge:[
    'Regarde bien les deux premières lettres.',
    'Si tu hésites, commence par la première lettre.',
    'Prends ton temps, les mots peuvent attendre.',
    'Si tu veux un indice, regarde les petites lettres en haut des cartes.',
    'Allez Harmonie, la licorne compte sur toi !'
  ],
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
  const type=raw.type==='math'?'math':(raw.type==='alphabet'?'alphabet':'writing');
  const sourceItems=Array.isArray(raw.items)&&raw.items.length
    ? raw.items
    : (raw.words||[]).map((word,i)=>({id:'w'+(i+1),prompt:String(word),expected:String(word),mode:'memory'}));
  const items=sourceItems.map((item,i)=>{
    if(typeof item==='string')return {id:'i'+(i+1),prompt:item,expected:item,mode:type==='math'?'solve':'memory'};
    if(type==='alphabet'&&Array.isArray(item.words)){
      const words=item.words.map(w=>String(w||'').trim()).filter(Boolean);
      return {
        id:item.id||('a'+(i+1)),
        prompt:words.join(' · '),
        expected:words.join('|'),
        words,
        note:String(item.note||''),
        showPrefix:item.showPrefix!==false,
        mode:'alphabet',
        type:'alphabet'
      };
    }
    return {
      id:item.id||('i'+(i+1)),
      prompt:String(item.prompt??item.expected??''),
      expected:String(item.expected??item.prompt??''),
      mode:item.mode||(type==='math'?'solve':'memory'),
      type:item.type==='math'?'math':type
    };
  }).filter(x=>type==='alphabet'?Array.isArray(x.words)&&x.words.length>1:(x.prompt&&x.expected));
  const marches=Array.isArray(raw.marches)
    ? raw.marches.map((marche,i)=>({
        id:String(marche?.id||('marche-'+(i+1))),
        label:String(marche?.label||('Marche '+(i+1))),
        words:(Array.isArray(marche?.words)?marche.words:[])
          .map(word=>String(word||'').trim())
          .filter(Boolean)
      })).filter(m=>m.words.length)
    : [];
  return {
    ...raw,
    id:raw.id||('lesson-'+Date.now()),
    type,
    title:raw.title||'Leçon',
    theme:raw.theme||raw.letter||'',
    difficulty:raw.difficulty||'normal',
    displaySeconds:Number(raw.displaySeconds||3),
    customPhrases:Array.isArray(raw.customPhrases)?raw.customPhrases:[],
    marches,
    items
  };
}

function itemsForMarche(lesson,marcheIndex){
  if(!Array.isArray(lesson.marches)||!lesson.marches.length)return lesson.items.map(x=>({...x}));
  const out=lesson.items.map(x=>({...x}));
  const seen=new Set(out.map(x=>String(x.expected).normalize('NFC').toLocaleLowerCase('fr')));
  for(let i=1;i<=marcheIndex&&i<lesson.marches.length;i++){
    lesson.marches[i].words.forEach((word,j)=>{
      const key=String(word).normalize('NFC').toLocaleLowerCase('fr');
      if(seen.has(key))return;
      seen.add(key);
      out.push({
        id:'m'+(i+1)+'-w'+(j+1),
        prompt:String(word),
        expected:String(word),
        mode:'memory',
        type:'writing',
        _marche:i+1
      });
    });
  }
  return out;
}

async function loadLessons(){
  loadState();
  const loaded=[];
  for(const url of DEFAULT_URLS){
    try{
      const r=await fetch(url,{cache:'no-cache'});
      if(!r.ok)throw new Error('lesson');
      const lesson=normalizeLesson(await r.json());
      if(lesson.items.length)loaded.push(lesson);
    }catch{}
  }
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

function teacherMotionVideos(){
  const actor=$('teacherActor');
  return {
    idle:actor?.querySelector('.teacher-motion-idle')||null,
    point:actor?.querySelector('.teacher-motion-point')||null,
    bravo:actor?.querySelector('.teacher-motion-bravo')||null
  };
}

function teacherMotionVideo(mode=teacherVideoMode){
  const videos=teacherMotionVideos();
  if(mode==='point')return videos.point;
  if(mode==='bravo')return videos.bravo;
  return videos.idle;
}

function teacherMotionCanvas(){
  return $('teacherActor')?.querySelector('.teacher-motion-keyed')||null;
}

let teacherFrameHandle=0;
let teacherFrameMode='';
let teacherKeyer=null;
let teacherVideoMode='idle';

function teacherVideoSource(mode){
  if(mode==='point')return String(window.HARMONIE_TEACHER_POINT_VIDEO||'');
  if(mode==='bravo')return String(window.HARMONIE_TEACHER_BRAVO_VIDEO||'');
  return String(window.HARMONIE_TEACHER_IDLE_VIDEO||'');
}

function stopTeacherFrameLoop(video=teacherFrameVideo){
  if(teacherFrameMode==='video'&&teacherFrameHandle&&video?.cancelVideoFrameCallback){
    try{video.cancelVideoFrameCallback(teacherFrameHandle)}catch{}
  }else if(teacherFrameHandle){
    cancelAnimationFrame(teacherFrameHandle);
  }
  teacherFrameHandle=0;
  teacherFrameMode='';
  teacherFrameVideo=null;
}

function compileTeacherShader(gl,type,source){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const message=gl.getShaderInfoLog(shader)||'shader';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function initTeacherKeyer(){
  const canvas=teacherMotionCanvas();
  if(!canvas)return null;
  const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false})
    ||canvas.getContext('experimental-webgl',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
  if(!gl)return null;
  try{
    const vertex=compileTeacherShader(gl,gl.VERTEX_SHADER,
      'attribute vec2 a_position;attribute vec2 a_texCoord;varying vec2 v_texCoord;void main(){gl_Position=vec4(a_position,0.0,1.0);v_texCoord=a_texCoord;}');
    const fragment=compileTeacherShader(gl,gl.FRAGMENT_SHADER,
      'precision mediump float;uniform sampler2D u_image;uniform vec3 u_key;uniform float u_inner;uniform float u_outer;uniform float u_greenLow;uniform float u_greenHigh;uniform float u_spill;varying vec2 v_texCoord;void main(){vec4 c=texture2D(u_image,v_texCoord);float d=distance(c.rgb,u_key);float exactAlpha=smoothstep(u_inner,u_outer,d);float dominance=max(0.0,c.g-max(c.r,c.b));float greenAlpha=1.0-smoothstep(u_greenLow,u_greenHigh,dominance);float alpha=min(exactAlpha,greenAlpha);float neutral=(c.r+c.b)*0.5;float spillAmt=smoothstep(0.01,u_greenHigh,dominance)*u_spill;float edgeAmt=spillAmt*(1.0-alpha*0.65);c.g=mix(c.g,min(c.g,neutral*1.04+0.02),edgeAmt);gl_FragColor=vec4(c.rgb,alpha);}');
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'program');
    gl.useProgram(program);

    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
      -1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1
    ]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'a_position');
    const texCoord=gl.getAttribLocation(program,'a_texCoord');
    gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,16,0);
    gl.enableVertexAttribArray(texCoord);gl.vertexAttribPointer(texCoord,2,gl.FLOAT,false,16,8);

    const texture=gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.uniform1i(gl.getUniformLocation(program,'u_image'),0);
    const key=window.HARMONIE_CHROMA_KEY||{};
    const keyColor=Array.isArray(key.key)&&key.key.length===3?key.key:[0.0,0.6941176471,0.0];
    gl.uniform3f(gl.getUniformLocation(program,'u_key'),Number(keyColor[0])||0,Number(keyColor[1])||0.6941176471,Number(keyColor[2])||0);
    gl.uniform1f(gl.getUniformLocation(program,'u_inner'),Number(key.inner)||0.035);
    gl.uniform1f(gl.getUniformLocation(program,'u_outer'),Number(key.outer)||0.20);
    gl.uniform1f(gl.getUniformLocation(program,'u_greenLow'),Number(key.greenLow)||0.015);
    gl.uniform1f(gl.getUniformLocation(program,'u_greenHigh'),Number(key.greenHigh)||0.14);
    gl.uniform1f(gl.getUniformLocation(program,'u_spill'),Number(key.spill)||0.98);
    gl.clearColor(0,0,0,0);
    teacherKeyer={gl,texture,canvas,lastW:0,lastH:0};
    return teacherKeyer;
  }catch{
    return null;
  }
}

function sizeTeacherCanvas(video,keyer){
  const sourceW=video.videoWidth||720;
  const sourceH=video.videoHeight||1280;
  const maxH=teacherVideoMode==='idle'?800:1080;
  const scale=Math.min(1,maxH/sourceH);
  const width=Math.max(2,Math.round(sourceW*scale));
  const height=Math.max(2,Math.round(sourceH*scale));
  if(keyer.lastW===width&&keyer.lastH===height)return;
  keyer.canvas.width=width;
  keyer.canvas.height=height;
  keyer.lastW=width;keyer.lastH=height;
  keyer.gl.viewport(0,0,width,height);
}

function hideTeacherVideo(){
  const actor=$('teacherActor');
  const canvas=teacherMotionCanvas();
  if(canvas)canvas.hidden=true;
  actor?.classList.remove('motion-ready','motion-active','motion-loaded');
  actor?.classList.add('teacher-video-missing');
}

function renderTeacherFrame(token,video=teacherMotionVideo()){
  if(token!==teacherMotionToken)return;
  const canvas=teacherMotionCanvas();
  const actor=$('teacherActor');
  if(!video||!canvas||!actor)return;
  const keyer=teacherKeyer||initTeacherKeyer();
  if(!keyer){hideTeacherVideo();return}

  if(video.readyState>=2){
    try{
      sizeTeacherCanvas(video,keyer);
      const gl=keyer.gl;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindTexture(gl.TEXTURE_2D,keyer.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      canvas.hidden=false;
      actor.classList.remove('teacher-video-missing');
      actor.classList.add('motion-loaded');
    }catch{
      hideTeacherVideo();
      return;
    }
  }

  if(video.paused||video.ended||token!==teacherMotionToken)return;
  teacherFrameVideo=video;
  if(video.requestVideoFrameCallback){
    teacherFrameMode='video';
    teacherFrameHandle=video.requestVideoFrameCallback(()=>renderTeacherFrame(token,video));
  }else{
    teacherFrameMode='raf';
    teacherFrameHandle=requestAnimationFrame(()=>renderTeacherFrame(token,video));
  }
}

function startTeacherVideo(mode){
  const actor=$('teacherActor');
  const canvas=teacherMotionCanvas();
  const videos=teacherMotionVideos();
  const video=mode==='point'?videos.point:(mode==='bravo'?videos.bravo:videos.idle);
  const others=[videos.idle,videos.point,videos.bravo].filter(v=>v&&v!==video);
  if(!actor||!video||!canvas)return;

  const token=++teacherMotionToken;
  teacherVideoMode=mode;
  actor.classList.toggle('video-idle',mode==='idle');
  actor.classList.toggle('video-point',mode==='point');
  actor.classList.toggle('video-bravo',mode==='bravo');
  actor.classList.remove('teacher-video-missing');
  actor.classList.add('motion-ready','motion-active');

  stopTeacherFrameLoop();
  for(const other of others){try{other.pause()}catch{}}

  video.muted=true;
  video.playsInline=true;
  video.loop=mode==='idle';
  video.preload='auto';
  video.setAttribute('playsinline','');
  video.setAttribute('webkit-playsinline','');

  video.onended=()=>{
    if(token!==teacherMotionToken)return;
    if(mode==='point'||mode==='bravo')startTeacherVideo('idle');
  };
  video.onerror=()=>{
    if(token!==teacherMotionToken)return;
    if(mode==='point'||mode==='bravo'){
      startTeacherVideo('idle');
      return;
    }
    hideTeacherVideo();
  };

  const start=()=>{
    if(token!==teacherMotionToken)return;
    try{video.currentTime=0}catch{}
    const play=video.play();
    if(play&&typeof play.then==='function'){
      play.then(()=>renderTeacherFrame(token,video)).catch(()=>{
        if(mode==='point'||mode==='bravo')startTeacherVideo('idle');
        else hideTeacherVideo();
      });
    }else{
      renderTeacherFrame(token,video);
    }
  };

  if(video.readyState>=2){
    start();
  }else{
    video.onloadeddata=start;
    try{video.load()}catch{}
  }
}

function setupTeacherMotion(){
  const videos=teacherMotionVideos();
  const idleSrc=String(window.HARMONIE_TEACHER_IDLE_VIDEO||'');
  const pointSrc=String(window.HARMONIE_TEACHER_POINT_VIDEO||'');
  const bravoSrc=String(window.HARMONIE_TEACHER_BRAVO_VIDEO||'');

  if(videos.idle){
    videos.idle.src=idleSrc;
    videos.idle.loop=true;
    videos.idle.muted=true;
    videos.idle.playsInline=true;
    videos.idle.preload='auto';
    videos.idle.setAttribute('playsinline','');
    videos.idle.setAttribute('webkit-playsinline','');
    try{videos.idle.load()}catch{}
  }
  if(videos.point){
    videos.point.src=pointSrc;
    videos.point.loop=false;
    videos.point.muted=true;
    videos.point.playsInline=true;
    videos.point.preload='auto';
    videos.point.setAttribute('playsinline','');
    videos.point.setAttribute('webkit-playsinline','');
    try{videos.point.load()}catch{}
  }
  if(videos.bravo){
    videos.bravo.src=bravoSrc;
    videos.bravo.loop=false;
    videos.bravo.muted=true;
    videos.bravo.playsInline=true;
    videos.bravo.preload='auto';
    videos.bravo.setAttribute('playsinline','');
    videos.bravo.setAttribute('webkit-playsinline','');
    try{videos.bravo.load()}catch{}
  }

  startTeacherVideo('idle');
}

function startTeacherPointMotion(){
  startTeacherVideo('point');
}

function startTeacherIdleMotion(){
  startTeacherVideo('idle');
}

function startTeacherBravoMotion(){
  startTeacherVideo('bravo');
}

function stopTeacherMotion(){
  teacherMotionToken++;
  const actor=$('teacherActor');
  const videos=teacherMotionVideos();
  const canvas=teacherMotionCanvas();
  stopTeacherFrameLoop();
  try{videos.idle?.pause()}catch{}
  try{videos.point?.pause()}catch{}
  try{videos.bravo?.pause()}catch{}
  if(canvas)canvas.hidden=true;
  actor?.classList.remove('motion-ready','motion-active','motion-loaded');
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
    const kind=lesson.type==='math'?'➕ Maths':(lesson.type==='alphabet'?'🔤 Ordre alphabétique':'✏️ Écriture');
    if(Array.isArray(lesson.marches)&&lesson.marches.length){
      card.classList.add('marches-card');
      card.innerHTML='<strong>'+safe(lesson.title)+'</strong><span>'+kind+' · 3 marches progressives</span><div class="marche-actions"></div>';
      const actions=card.querySelector('.marche-actions');
      lesson.marches.forEach((marche,i)=>{
        const items=itemsForMarche(lesson,i);
        const button=document.createElement('button');
        button.className='mainbtn marche-btn marche-'+(i+1);
        button.innerHTML='<b>'+safe(marche.label)+'</b><small>'+items.length+' mots · '+('⭐'.repeat(i+1))+'</small>';
        button.onclick=()=>{
          const selected={...lesson,title:lesson.title+' — '+marche.label,selectedMarche:i+1};
          startLesson(selected,items);
        };
        actions.append(button);
      });
    }else{
      card.innerHTML='<strong>'+safe(lesson.title)+'</strong><span>'+kind+' · '+lesson.items.length+' exercices</span><button class="mainbtn">Entrer en classe</button>';
      card.querySelector('button').onclick=()=>startLesson(lesson);
    }
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
  teacherNudgeIndex=0;
  clearTeacherNudge();
  clearAutoFlow();
  unicornStep=0;
  unicornTreasures=0;
  clearTimeout(unicornSurpriseTimer);
  hideUnicornSurprise();
  renderUnicornQuest();
  screen('game');
  musicStart();
  sayTeacher(pick(TEACHER.intro));
  prepareRound();
}

function currentItem(){return currentItems[itemIndex]}
function exerciseType(item=currentItem()){return item?._sourceType||item?.type||currentLesson?.type||'writing'}

function clearTeacherNudge(){
  if(teacherNudgeTimer)clearTimeout(teacherNudgeTimer);
  teacherNudgeTimer=null;
}

function clearAutoFlow(){
  if(autoFlowTimer)clearTimeout(autoFlowTimer);
  autoFlowTimer=null;
}

function autoAdvanceAfterSuccess(){
  clearAutoFlow();
  autoFlowTimer=setTimeout(()=>{
    autoFlowTimer=null;
    nextExercise(true);
  },AUTO_NEXT_DELAY);
}

function autoRetryAfterCorrection(){
  clearAutoFlow();
  autoFlowTimer=setTimeout(()=>{
    autoFlowTimer=null;
    retryCurrent();
  },AUTO_RETRY_DELAY);
}

function teacherNudge(kind){
  const alphabetActive=kind==='alphabet'&&$('alphabetZone')?.classList.contains('show');
  const writingActive=kind!=='alphabet'&&$('writeZone')?.classList.contains('show');
  if(!alphabetActive&&!writingActive)return;
  if(recognitionBusy)return;
  const phrases=kind==='alphabet'?TEACHER.alphabetNudge:TEACHER.nudge;
  const phrase=phrases[teacherNudgeIndex%phrases.length];
  teacherNudgeIndex++;
  sayTeacher(phrase);
  teacherNudgeTimer=setTimeout(()=>teacherNudge(kind),TEACHER_NUDGE_DELAY);
}

function scheduleTeacherNudge(kind=exerciseType()){
  clearTeacherNudge();
  teacherNudgeTimer=setTimeout(()=>teacherNudge(kind),TEACHER_NUDGE_DELAY);
}

const UNICORN_SURPRISES=[
  {icon:'🌈',title:'Arc-en-ciel magique !',text:'Tu as rempli les 5 marches !'},
  {icon:'💎',title:'Cristal magique !',text:'La licorne a trouvé un trésor !'},
  {icon:'🦄✨',title:'Bébé licorne !',text:'Une nouvelle amie est apparue !'},
  {icon:'🎁',title:'Cadeau surprise !',text:'Bravo, le coffre est ouvert !'},
  {icon:'⭐',title:'Étoile géante !',text:'Harmonie gagne une étoile magique !'}
];

function renderUnicornQuest(){
  const quest=$('unicornQuest');
  const mascot=$('unicornMascot');
  if(!quest||!mascot)return;
  quest.style.setProperty('--unicorn-step',String(Math.max(0,Math.min(5,unicornStep))));
  quest.dataset.step=String(unicornStep);
  quest.querySelectorAll('.unicorn-stairs i').forEach(step=>{
    step.classList.toggle('reached',Number(step.dataset.step)<=unicornStep);
  });
  mascot.classList.remove('hop');
  void mascot.offsetWidth;
  if(unicornStep>0)mascot.classList.add('hop');
}

function hideUnicornSurprise(){
  const box=$('unicornSurprise');
  if(!box)return;
  box.classList.remove('show');
  box.setAttribute('aria-hidden','true');
}

function showUnicornSurprise(){
  const box=$('unicornSurprise');
  if(!box)return;
  const surprise=pick(UNICORN_SURPRISES);
  unicornTreasures++;
  $('unicornSurpriseIcon').textContent=surprise.icon;
  $('unicornSurpriseTitle').textContent=surprise.title;
  $('unicornSurpriseText').textContent=surprise.text;
  box.classList.remove('show');
  void box.offsetWidth;
  box.classList.add('show');
  box.setAttribute('aria-hidden','false');
  if(state.settings.sounds){
    [784,988,1175,1568].forEach((f,i)=>setTimeout(()=>tone(f,.2,.035,'sine'),i*90));
  }
  clearTimeout(unicornSurpriseTimer);
  unicornSurpriseTimer=setTimeout(()=>{
    hideUnicornSurprise();
    unicornStep=0;
    renderUnicornQuest();
  },2200);
}

function advanceUnicorn(){
  if(unicornStep>=5)unicornStep=0;
  unicornStep++;
  renderUnicornQuest();
  if(unicornStep===5){
    setTimeout(showUnicornSurprise,420);
  }
}

function alphabetNormalize(word){
  return String(word||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('fr')
    .replace(/[^a-zœæ]/g,'');
}

function alphabetPrefix(word){
  return alphabetNormalize(word).slice(0,2);
}

function alphabetExpected(words){
  return [...words].sort((a,b)=>{
    const pa=alphabetPrefix(a),pb=alphabetPrefix(b);
    const prefix=pa.localeCompare(pb,'fr');
    return prefix||alphabetNormalize(a).localeCompare(alphabetNormalize(b),'fr');
  });
}

function shuffleWords(words){
  const out=[...words];
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}

function resetAlphabetSelection(){
  alphabetSelection=[];
  const zone=$('alphabetZone');
  if(!zone)return;
  zone.querySelectorAll('.alphabet-word').forEach(button=>{
    button.classList.remove('chosen');
    button.querySelector('.alphabet-order').textContent='';
  });
  zone.classList.remove('wrong-shake');
  $('feedback').textContent='';
}

function renderAlphabetExercise(){
  const item=currentItem();
  const zone=$('alphabetZone');
  zone.innerHTML='';
  alphabetSelection=[];
  const words=shuffleWords(item.words);
  words.forEach(word=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='alphabet-word';
    button.dataset.word=word;

    const order=document.createElement('span');
    order.className='alphabet-order';

    const label=document.createElement('span');
    label.className='alphabet-label';
    label.textContent=word;

    button.append(order,label);
    if(item.showPrefix){
      const prefix=document.createElement('span');
      prefix.className='alphabet-prefix';
      prefix.textContent=alphabetPrefix(word).toLocaleUpperCase('fr');
      button.append(prefix);
    }

    button.onclick=()=>{
      const existing=alphabetSelection.indexOf(word);
      if(existing>=0){
        alphabetSelection.splice(existing,1);
      }else{
        alphabetSelection.push(word);
      }
      zone.querySelectorAll('.alphabet-word').forEach(btn=>{
        const n=alphabetSelection.indexOf(btn.dataset.word);
        btn.classList.toggle('chosen',n>=0);
        btn.querySelector('.alphabet-order').textContent=n>=0?String(n+1):'';
      });
      zone.classList.remove('wrong-shake');
      $('feedback').textContent='';
    };
    zone.append(button);
  });
}

function beginAlphabetExercise(){
  $('roundControls').classList.add('hidden');
  $('writeControls').classList.add('hidden');
  $('alphabetControls').classList.remove('hidden');
  $('alphabetZone').classList.add('show');
  $('boardPrompt').textContent='';
  $('boardTitle').textContent='Classe les mots dans l’ordre alphabétique';
  $('boardHelp').textContent=currentItem().note||'Touche les mots dans l’ordre : 1, puis 2, puis 3…';
  setTeacherPose('point');
  if(itemIndex===0){
    sayTeacher('Je te l’explique une fois. Pour classer les mots, regarde d’abord la première lettre. Si elle est pareille, regarde la lettre juste après. Puis touche les mots dans le bon ordre.');
  }
  renderAlphabetExercise();
  scheduleTeacherNudge('alphabet');
  setTimeout(()=>setTeacherPose('idle'),1400);
}

function checkAlphabetOrder(){
  clearTeacherNudge();
  const item=currentItem();
  if(alphabetSelection.length!==item.words.length){
    $('feedback').textContent='Choisis tous les mots dans l’ordre.';
    chime(false);
    sayTeacher('Choisis tous les mots, du premier au dernier.');
    return;
  }

  const expected=alphabetExpected(item.words);
  const correct=alphabetSelection.every((word,i)=>word===expected[i]);
  if(correct){
    recordAttempt(true);
    const earned=roundTries===0?3:(roundTries===1?2:1);
    stars+=earned;
    $('starCount').textContent='⭐ '+stars;
    $('alphabetControls').classList.add('hidden');
    $('boardTitle').textContent='Très bien !';
    $('boardHelp').textContent='Ordre parfait : '+expected.join(' → ');
    $('feedback').textContent='Réussi '+('⭐'.repeat(earned));
    showStamp('BRAVO','good');
    setTeacherPose('cheer');
    chime(true);
    advanceUnicorn();
    sayTeacher(pick(TEACHER.success));
    $('afterControls').classList.add('hidden');
    $('retry').classList.add('hidden');
    $('nextWord').classList.add('hidden');
    autoAdvanceAfterSuccess();
    return;
  }

  recordAttempt(false);
  roundTries++;
  const zone=$('alphabetZone');
  zone.classList.remove('wrong-shake');
  void zone.offsetWidth;
  zone.classList.add('wrong-shake');
  $('feedback').textContent='Presque ! Regarde seulement les deux premières lettres.';
  $('boardHelp').textContent='Compare la 1re lettre, puis la 2e si la 1re est identique.';
  chime(false);
  setTeacherPose('point');
  sayTeacher('Presque. Regarde la première lettre, puis seulement la deuxième si elle est pareille.');
}

function prepareRound(){
  clearTeacherNudge();
  clearAutoFlow();
  clearInterval(timer);
  strokes=[];activeStroke=null;alphabetSelection=[];hints=0;roundTries=0;recognitionBusy=false;
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
  $('alphabetZone').classList.remove('show','wrong-shake');
  $('alphabetZone').innerHTML='';
  $('alphabetControls').classList.add('hidden');
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

function beginTeaching(){
  const item=currentItem();
  if(exerciseType(item)==='alphabet'){
    beginAlphabetExercise();
    return;
  }
  $('roundControls').classList.add('hidden');
  setTeacherPose('point');
  if(exerciseType(item)==='math'||item.mode==='solve'){
    $('boardPrompt').textContent=item.prompt;
    $('boardTitle').textContent='À toi de calculer';
    if(itemIndex===0)sayTeacher('Je te l’explique une fois. Regarde bien le calcul, puis écris seulement la réponse. Si tu veux de l’aide, touche l’ampoule.');
    setTimeout(()=>enterWriting(false),TEACHER_MOTION_SECONDS*1000);
    return;
  }

  $('boardPrompt').textContent=item.prompt;
  const seconds=Math.max(TEACHER_MOTION_SECONDS,DISPLAY_SECONDS[currentLesson.difficulty]||currentLesson.displaySeconds||3);
  let left=seconds;
  $('countdown').textContent=left+' s';
  if(itemIndex===0){
    sayTeacher('Je te l’explique une fois. Je vais te montrer le mot quelques secondes. Ensuite il disparaît et tu l’écris avec ton doigt. Si tu veux un indice, touche l’ampoule.');
  }
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
  if(itemIndex===0&&exerciseType(item)!=='math')sayTeacher('À toi maintenant. Écris tranquillement ce que tu as retenu.');
  scheduleTeacherNudge(exerciseType(item));
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
    return;
  }

  if(pose==='check')actor.classList.add('pose-check');
  if(pose==='cheer'){
    actor.classList.add('pose-cheer');
    startTeacherBravoMotion();
    return;
  }
  startTeacherIdleMotion();
}

function teacherFriendlyText(text){
  return String(text)
    .replace(/\b1re\b/gi,'première')
    .replace(/\b1er\b/gi,'premier')
    .replace(/\b2e\b/gi,'deuxième')
    .replace(/\b2ème\b/gi,'deuxième')
    .replace(/\b3e\b/gi,'troisième')
    .replace(/\b3ème\b/gi,'troisième')
    .replace(/\+/g,' plus ')
    .replace(/-/g,' moins ')
    .replace(/[×x*]/g,' fois ')
    .replace(/÷|\//g,' divisé par ')
    .replace(/=/g,' égale ')
    .replace(/\s+/g,' ')
    .trim();
}

function fallbackTeacherSpeech(text,token){
  if(!window.speechSynthesis||token!==teacherVoiceToken)return;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(teacherFriendlyText(text));
    u.lang='fr-FR';
    u.pitch=1.08;u.rate=.94;u.volume=.95;
    const voices=speechSynthesis.getVoices();
    const french=voices.filter(v=>v.lang?.toLowerCase().startsWith('fr'));
    u.voice=french.find(v=>/audrey|am[ée]lie|aurelie|marie|virginie|julie|female|woman/i.test(v.name)&&!/thomas|daniel|henri|male/i.test(v.name))
      ||french.find(v=>!/thomas|daniel|henri|male/i.test(v.name))
      ||french[0]
      ||null;
    u.onend=()=>{if(token===teacherVoiceToken)musicStart()};
    u.onerror=()=>{if(token===teacherVoiceToken)musicStart()};
    speechSynthesis.speak(u);
  }catch{
    if(token===teacherVoiceToken)musicStart();
  }
}

function base64ToArrayBuffer(base64){
  const raw=atob(base64);
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes.buffer;
}

async function naturalTeacherBuffer(text){
  const key=teacherFriendlyText(text).trim();
  if(!key)throw new Error('EMPTY_SPEECH');
  if(teacherVoiceCache.has(key))return teacherVoiceCache.get(key);
  const promise=(async()=>{
    const r=await fetch('./api/teacher-speech',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:key})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok||!data.audioContent)throw new Error(data.code||'TTS_ERROR');
    const ctx=getAudio();
    if(!ctx)throw new Error('NO_AUDIO_CONTEXT');
    return await ctx.decodeAudioData(base64ToArrayBuffer(data.audioContent));
  })();
  teacherVoiceCache.set(key,promise);
  try{
    return await promise;
  }catch(error){
    teacherVoiceCache.delete(key);
    throw error;
  }
}

async function sayTeacher(text){
  $('teacherSpeech').textContent=text;
  if(!state.settings.voice)return;
  const token=++teacherVoiceToken;
  musicStop();
  try{
    if(window.speechSynthesis)speechSynthesis.cancel();
    if(teacherVoiceNode){
      try{teacherVoiceNode.stop()}catch{}
      teacherVoiceNode=null;
    }
    const ctx=getAudio();
    if(!ctx)throw new Error('NO_AUDIO_CONTEXT');
    const buffer=await naturalTeacherBuffer(text);
    if(token!==teacherVoiceToken)return;
    const source=ctx.createBufferSource();
    const gain=ctx.createGain();
    gain.gain.value=.95;
    source.buffer=buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.onended=()=>{
      if(token!==teacherVoiceToken)return;
      teacherVoiceNode=null;
      musicStart();
    };
    teacherVoiceNode=source;
    source.start(0);
  }catch{
    if(token===teacherVoiceToken)fallbackTeacherSpeech(text,token);
  }
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

const CHILD_MELODY=[
  {f:523.25,d:1.15},{f:659.25,d:1.15},{f:783.99,d:1.35},{f:659.25,d:1.0},
  {f:587.33,d:1.15},{f:659.25,d:1.15},{f:880.00,d:1.45},{f:783.99,d:1.2},
  {f:659.25,d:1.15},{f:587.33,d:1.05},{f:523.25,d:1.4},{f:0,d:.75},
  {f:659.25,d:1.1},{f:783.99,d:1.15},{f:880.00,d:1.35},{f:783.99,d:1.05},
  {f:659.25,d:1.2},{f:587.33,d:1.1},{f:523.25,d:1.55},{f:0,d:1.0}
];

function musicBoxNote(freq,duration=1.2){
  const c=getAudio();
  if(!c||!freq)return;
  const now=c.currentTime;
  const master=c.createGain();
  const bell=c.createOscillator();
  const shimmer=c.createOscillator();
  const bellGain=c.createGain();
  const shimmerGain=c.createGain();

  bell.type='sine';
  bell.frequency.setValueAtTime(freq,now);
  shimmer.type='sine';
  shimmer.frequency.setValueAtTime(freq*2,now);

  bellGain.gain.setValueAtTime(.0001,now);
  bellGain.gain.exponentialRampToValueAtTime(.012,now+.035);
  bellGain.gain.exponentialRampToValueAtTime(.0001,now+Math.min(duration*.9,1.15));

  shimmerGain.gain.setValueAtTime(.0001,now);
  shimmerGain.gain.exponentialRampToValueAtTime(.0038,now+.02);
  shimmerGain.gain.exponentialRampToValueAtTime(.0001,now+Math.min(duration*.55,.7));

  master.gain.value=.78;
  bell.connect(bellGain);shimmer.connect(shimmerGain);
  bellGain.connect(master);shimmerGain.connect(master);
  master.connect(c.destination);

  bell.start(now);shimmer.start(now);
  bell.stop(now+duration+0.08);shimmer.stop(now+duration+0.08);
}

function musicStart(){
  if(!state.settings.music||musicTimer)return;
  const playNext=()=>{
    if(!state.settings.music){
      musicStop();
      return;
    }
    const note=CHILD_MELODY[musicStep++%CHILD_MELODY.length];
    if(note.f)musicBoxNote(note.f,note.d);
    musicTimer=setTimeout(playNext,Math.round(note.d*1000));
  };
  musicTimer=setTimeout(playNext,180);
}

function musicStop(){
  if(musicTimer)clearTimeout(musicTimer);
  musicTimer=null;
}

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

function makeRecognitionImage(){
  const ink=strokes.filter(st=>st.length>1);
  if(!ink.length)return '';

  const points=ink.flat();
  let minX=Math.min(...points.map(p=>p.x));
  let maxX=Math.max(...points.map(p=>p.x));
  let minY=Math.min(...points.map(p=>p.y));
  let maxY=Math.max(...points.map(p=>p.y));

  const pad=28;
  minX-=pad;maxX+=pad;minY-=pad;maxY+=pad;
  const sourceW=Math.max(40,maxX-minX);
  const sourceH=Math.max(40,maxY-minY);

  let scale=2.5;
  scale=Math.min(scale,1600/sourceW,900/sourceH);
  scale=Math.max(1.4,scale);

  const out=document.createElement('canvas');
  out.width=Math.max(120,Math.round(sourceW*scale));
  out.height=Math.max(90,Math.round(sourceH*scale));
  const ctx=out.getContext('2d');

  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,0,out.width,out.height);
  ctx.strokeStyle='#000000';
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.lineWidth=Math.max(7,5.5*scale);

  for(const st of ink){
    ctx.beginPath();
    ctx.moveTo((st[0].x-minX)*scale,(st[0].y-minY)*scale);
    for(let i=1;i<st.length;i++){
      ctx.lineTo((st[i].x-minX)*scale,(st[i].y-minY)*scale);
    }
    ctx.stroke();
  }

  return out.toDataURL('image/png').split(',')[1]||'';
}

function makeRecognitionPayload(){
  const item=currentItem();
  const type=exerciseType(item);
  return {
    expected:item.expected,
    mode:type==='math'?'math':'text',
    image:makeRecognitionImage()
  };
}

async function recognizeWriting(){
  const payload=makeRecognitionPayload();
  if(!payload.image)return {ok:true,match:false,empty:true};
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
  clearTeacherNudge();
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
    if(err.code==='GOOGLE_VISION_NOT_CONFIGURED'){
      $('feedback').textContent='La correction automatique Google Vision doit encore être activée.';
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
  clearTeacherNudge();
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
  advanceUnicorn();
  sayTeacher(pick(currentLesson.customPhrases?.length?currentLesson.customPhrases:TEACHER.success));
  $('afterControls').classList.add('hidden');
  $('retry').classList.add('hidden');
  $('nextWord').classList.add('hidden');
  autoAdvanceAfterSuccess();
}

function handleWrong(result){
  clearTeacherNudge();
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
  $('afterControls').classList.add('hidden');
  $('retry').classList.add('hidden');
  $('nextWord').classList.add('hidden');
  autoRetryAfterCorrection();
}

function retryCurrent(){
  clearAutoFlow();
  if(exerciseType()==='alphabet'){
    clearTeacherNudge();
    hideStamp();
    $('afterControls').classList.add('hidden');
    $('alphabetControls').classList.remove('hidden');
    resetAlphabetSelection();
    $('boardTitle').textContent='On réessaie';
    $('boardHelp').textContent='Regarde la première lettre, puis la lettre juste après.';
    setTeacherPose('idle');
    scheduleTeacherNudge('alphabet');
    return;
  }
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
  scheduleTeacherNudge(exerciseType());
  resizeCanvas();
}

function nextExercise(autoStart=false){
  clearTeacherNudge();
  clearAutoFlow();
  itemIndex++;
  if(itemIndex>=currentItems.length){finishLesson();return}
  prepareRound();
  if(autoStart)setTimeout(beginTeaching,260);
}

function finishLesson(){
  clearTeacherNudge();
  clearAutoFlow();
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
  if(key==='voice'&&!state.settings.voice){
    teacherVoiceToken++;
    if(window.speechSynthesis)speechSynthesis.cancel();
    if(teacherVoiceNode){try{teacherVoiceNode.stop()}catch{};teacherVoiceNode=null}
  }
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
$('alphabetCheck').onclick=checkAlphabetOrder;
$('alphabetReset').onclick=resetAlphabetSelection;
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

$('leaveGame').onclick=()=>{clearTeacherNudge();clearAutoFlow();clearInterval(timer);musicStop();screen('home');renderLessons()};
$('toLessons').onclick=()=>{screen('home');renderLessons()};
$('playAgain').onclick=()=>startLesson(currentLesson);
$('finishProgress').onclick=openProgress;
$('openProgress').onclick=openProgress;
$('progressBack').onclick=()=>{screen('home');renderLessons()};
$('backAlphabet').onclick=()=>{
  const lesson=lessons.find(l=>l.type==='alphabet');
  if(lesson)startLesson(lesson);
  else location.href=ALPHABET_URL;
};

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
window.addEventListener('pagehide',()=>{
  clearTeacherNudge();
  clearAutoFlow();
  clearTimeout(unicornSurpriseTimer);
  musicStop();
  teacherVoiceToken++;
  if(window.speechSynthesis)speechSynthesis.cancel();
  if(teacherVoiceNode){try{teacherVoiceNode.stop()}catch{};teacherVoiceNode=null}
  stopTeacherMotion();
});

mountTeachers();
setupTeacherMotion();
loadLessons();
refreshToggles();
