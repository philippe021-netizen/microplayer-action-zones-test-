(() => {
"use strict";
const D=window.HARMONIE_DATA;
const $=id=>document.getElementById(id);
const KEY="harmonie-revisions-toussaint-2026-v1";
const MAX=D.maxMinutes*60;
let progress=readProgress(),chosen=currentDay(),game=null,ticker=null,lastTick=0,lastActivity=0,idleTimer=null,lastEncouragement=-1,gusMomentTimer=null;
let canvasStrokes=[],stroke=null,ctx=null,canvasWidth=1,canvasHeight=1,lessonTimer=null;
let activeModule=null,practiceSource=null;
const AUDIO_KEY="harmonie-audio-v1";
let audioSettings=readAudioSettings(),voicePlayer=null,backgroundPlayer=$("gus-music-player"),dictationSpeaking=false;
if(backgroundPlayer){backgroundPlayer.src="./audio/harmonie-background.mp3?v=2";backgroundPlayer.loop=true;backgroundPlayer.volume=.16}
function readAudioSettings(){try{const s=JSON.parse(localStorage.getItem(AUDIO_KEY)||"{}");return {voice:s.voice!==false,music:s.music!==false}}catch{return {voice:true,music:true}}}
function saveAudioSettings(){try{localStorage.setItem(AUDIO_KEY,JSON.stringify(audioSettings))}catch{}}
function paintAudioSettings(){for(const [id,key,on,off] of [["voiceToggle","voice","🗣️ Voix","🤐 Voix coupée"],["musicToggle","music","🎵 Musique","🔇 Musique coupée"]]){const b=$(id),active=audioSettings[key];b.textContent=active?on:off;b.setAttribute("aria-pressed",String(active))}}
function musicVolume(level=.16){if(!backgroundPlayer)return;const withGus=window.GusMedia?.hasOriginalSound()?Math.min(level,.035):level,withVoice=voicePlayer&&!voicePlayer.paused||dictationSpeaking?Math.min(withGus,.035):withGus;backgroundPlayer.volume=withVoice}
window.HarmonieMusicVolume=level=>voicePlayer&&!voicePlayer.paused?Math.min(level,.06):level;
function musicStop(){backgroundPlayer?.pause()}
function musicStart(){if(!audioSettings.music||!game||!backgroundPlayer)return;musicVolume();if(backgroundPlayer.ended){try{backgroundPlayer.currentTime=0}catch{}}if(backgroundPlayer.paused||backgroundPlayer.ended){const p=backgroundPlayer.play();p?.then?.(musicVolume).catch?.(()=>{})}}
backgroundPlayer?.addEventListener("ended",()=>{if(game&&audioSettings.music){try{backgroundPlayer.currentTime=0}catch{}musicStart()}});
function stopVoice(continueSequence=false){if(voicePlayer){const audio=voicePlayer,next=audio.onended;audio.onended=null;audio.onerror=null;audio.pause();voicePlayer=null;musicVolume();if(continueSequence)next?.()}}
function playVoice(file,onend){if(!audioSettings.voice){onend?.();return}stopVoice();const prefix=file.startsWith("lili-math-")?"lili-math-":file.startsWith("lili-lesson-")?"lili-lesson-":null;const src=prefix?"/api/tts-math?lesson="+encodeURIComponent(file.slice(prefix.length)):"./audio/"+file+".mp3";const audio=new Audio(src);voicePlayer=audio;let finished=false;const done=()=>{if(finished)return;finished=true;if(voicePlayer===audio){voicePlayer=null;musicStart();musicVolume()}onend?.()};audio.onended=done;audio.onerror=done;const p=audio.play();musicVolume();p?.catch?.(done)}
// Sélectionne une voix française féminine, au timbre posé, si l’appareil la propose.
// Safari iPad ne donne pas le genre d’une voix: on privilégie donc des voix nommées connues.
function teacherVoice(){
 if(!("speechSynthesis" in window))return null;
 const french=window.speechSynthesis.getVoices().filter(v=>/^fr(?:-|_)/i.test(v.lang||""));
 const femaleNames=["audrey","amélie","amelie","marie","denise","julie","léa","lea","hortense","céline","celine","virginie","alice","sylvie","claire","camille","chloé","chloe","thomasina"];
 const byName=femaleNames.map(name=>french.find(v=>(v.name||"").toLocaleLowerCase("fr").includes(name))).find(Boolean);
 return byName||french.find(v=>/^fr[-_]fr$/i.test(v.lang))||french[0]||null;
}
function stopDictation(){
 if("speechSynthesis" in window)window.speechSynthesis.cancel();
 dictationSpeaking=false;musicVolume();
}
function speakDictation(repeat=false){
 if(!game||game.solved||game.questions[game.pos]?.mode!=="dictation")return;
 if(!audioSettings.voice){
  $("feedback").textContent="Active la voix en haut du programme pour écouter la maîtresse.";
  return;
 }
 if(!("speechSynthesis" in window)){
  $("feedback").textContent="La voix de la maîtresse n’est pas disponible sur cet appareil. Demande à un adulte de dicter le mot.";
  return;
 }
 stopDictation();
 const session=game,position=game.pos,word=game.questions[position].answer;
 const selectedVoice=teacherVoice();
 // La consigne et le mot sont prononcés, jamais montrés à l’écran avant validation.
 const first=!repeat&&position===0;
 const instruction=repeat?"Je répète.":first?
   "Bonjour Harmonie. Nous allons faire une petite dictée. Écoute bien, puis écris ce mot sur le tableau.":
   "Très bien. Voici le mot suivant.";
 function createUtterance(text,rate){
  const u=new SpeechSynthesisUtterance(text);
  u.lang="fr-FR";u.rate=rate;u.pitch=1.0;u.volume=1;
  if(selectedVoice)u.voice=selectedVoice;
  return u;
 }
 const intro=createUtterance(instruction,.90);
 const target=createUtterance(word,.76);
 let finished=false;
 function finish(){
  if(finished)return;
  finished=true;dictationSpeaking=false;musicVolume();
 }
 intro.onend=()=>{
  if(game===session&&game.pos===position&&!game.solved){
   window.speechSynthesis.speak(target);
  }else finish();
 };
 intro.onerror=()=>{if(game===session&&game.pos===position&&!game.solved)window.speechSynthesis.speak(target);else finish()};
 target.onend=finish;target.onerror=finish;
 dictationSpeaking=true;musicVolume();
 window.speechSynthesis.speak(intro);
}
function say(){/* Les autres leçons utilisent les voix enregistrées ; seule la dictée utilise la synthèse vocale française. */}
const encouragements=["Alors, tu dors ou quoi ? Réveille les neurones !","Ton crayon fait la sieste ? On s’y remet !","Ouh là, ça réfléchit fort ! Tu vas trouver !","Ce mot se cache bien : démasque-le !","Allez, championne, encore une lettre !"];
function encourage(){if(!game||game.type.startsWith("dictation-")||game.solved||document.hidden||!audioSettings.voice||voicePlayer&&!voicePlayer.paused)return;let i=Math.floor(Math.random()*encouragements.length);if(encouragements.length>1&&i===lastEncouragement)i=(i+1+Math.floor(Math.random()*(encouragements.length-1)))%encouragements.length;lastEncouragement=i;window.GusMedia?.playEncouragement?.();playVoice("lili-encourage-"+(i+1))}
function markActivity(){if(!game)return;lastActivity=Date.now()}
function startIdleWatch(){clearInterval(idleTimer);lastActivity=Date.now();idleTimer=setInterval(()=>{if(game&&!document.hidden&&!game.solved&&Date.now()-lastActivity>=30000){if(!voicePlayer||voicePlayer.paused){encourage();lastActivity=Date.now()}}},1000);scheduleGusMoment(game)}
function stopGusMoments(){clearTimeout(gusMomentTimer);gusMomentTimer=null}
function scheduleGusMoment(session){stopGusMoments();if(!session||session.type.startsWith("dictation-"))return;gusMomentTimer=setTimeout(()=>{gusMomentTimer=null;if(game!==session)return;const writingNow=!$("boardBox").hidden&&canvasStrokes.length>0;if(!document.hidden&&!session.solved&&!writingNow&&!window.GusMedia?.active&&(!voicePlayer||voicePlayer.paused))window.GusMedia?.playMidGameMoment?.();scheduleGusMoment(session)},36000+Math.random()*18000)}
function stopIdleWatch(){clearInterval(idleTimer);idleTimer=null;lastActivity=0;stopGusMoments()}
function readProgress(){try {const x=JSON.parse(localStorage.getItem(KEY)||"{}");return {spent:x.spent||{},done:x.done||{},results:x.results||[],moduleResults:x.moduleResults||[]}}catch{return {spent:{},done:{},results:[],moduleResults:[]}}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(progress))}catch{}}
function currentDay(){const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day}
const frDay=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
// Garder les anciens exercices en mémoire, mais masquer les journées dépassées du ruban.
const visibleDays=()=>Object.keys(D.schedule).filter(d=>d>="2026-11-15").sort();
const fullDate=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const capital=s=>s.replace(/^./,c=>c.toLocaleUpperCase("fr"));
function available(){return Boolean(D.schedule[chosen])}
function seconds(){return Math.max(0,progress.spent[currentDay()]||0)}
function addSeconds(s){if(!available()||s<=0)return;const day=currentDay();progress.spent[day]=(progress.spent[day]||0)+s;save();paintClock()}
function startTimer(){stopTimer();lastTick=Date.now();ticker=setInterval(()=>{if(document.hidden)return;if(!available()){endGame();return}const now=Date.now(),delta=Math.min(2,Math.max(0,Math.floor((now-lastTick)/1000)));if(delta){lastTick=now;addSeconds(delta)}},1000)}
function stopTimer(){if(ticker){clearInterval(ticker);ticker=null}const previous=lastTick;lastTick=0;if(previous&&(game||activeModule)&&!document.hidden){const delta=Math.min(2,Math.max(0,Math.floor((Date.now()-previous)/1000)));if(delta)addSeconds(delta)}}
document.addEventListener("visibilitychange",()=>{if(document.hidden){stopTimer()}else if(game){startTimer();markActivity()}});
function paintClock(){$("clock").textContent=Math.ceil(seconds()/60)+" min · pause conseillée à 30 min";$("clock").style.color=seconds()>=MAX?"#a52d45":""}
function complete(m){if(!(progress.done[chosen]||[]).includes(m)){(progress.done[chosen]||=([])).push(m)}save()}
function isDone(m){return (progress.done[chosen]||[]).includes(m)}
function show(el,yes){$(el).hidden=!yes}
function renderDays(){
 const host=$("days");host.replaceChildren();
 const today=currentDay();
 for(const d of visibleDays()){
  const b=document.createElement("button");
  b.type="button";b.className="day"+(d===chosen?" active":"")+(d===today?" today":"");
  b.setAttribute("aria-label",fullDate(d)+(d===today?", aujourd’hui":"")+", "+(progress.done[d]||[]).length+" missions terminées");
  const weekday=document.createElement("strong");
  weekday.textContent=capital(new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long"}));
  const date=document.createElement("span");date.className="day-date";
  date.textContent=new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
  const done=document.createElement("small");done.className="day-count";
  done.textContent=d===today?"Aujourd’hui · "+(progress.done[d]||[]).length+"/3":(progress.done[d]||[]).length+"/3 missions";
  b.append(weekday,date,done);
  b.addEventListener("click",()=>{if(game)endGame();chosen=d;render()});
  host.appendChild(b);
 }
 requestAnimationFrame(()=>host.querySelector(".day.active")?.scrollIntoView({block:"nearest",inline:"center"}));
}
function render(){
 paintClock();renderDays();
 const isToday=chosen===currentDay(),isFuture=chosen>currentDay();
 $("dayDisplay").textContent=(isToday?"Aujourd’hui · ":"")+capital(fullDate(chosen));
 const dayMessages={
  "2026-11-15":"À préparer pour lundi 16 novembre : dictée du son « eu » et récitation intégrale de « Le monstre ».",
  "2026-11-16":"À l’école aujourd’hui : dictée du son « eu » et poésie « Le monstre » à réciter.",
  "2026-11-17":"Additions à trois chiffres et préparation des mots du son « o ».",
  "2026-11-18":"Entraînement aux compléments à 100 et aux mots du son « o ».",
  "2026-11-19":"Réviser les compléments à 100 et les mots du son « o » avant vendredi.",
  "2026-11-20":"Évaluation des compléments à 100 et révision des mots du son « o »."
 };
 $("dayStatus").textContent=seconds()>=MAX?"30 minutes de révision : une pause est conseillée. Tous les jeux restent accessibles.":dayMessages[chosen]||(isFuture?"Les missions de cette date sont accessibles dès maintenant.":"Tu peux reprendre tes missions.");
 const host=$("missions");host.replaceChildren();const list=D.schedule[chosen]||[];
 $("doneLabel").textContent=(progress.done[chosen]||[]).length+" / "+list.length+" réussies";
 $("carryPractice").disabled=false;
 $("quickDictationEu").disabled=false;
 $("quickPoetry").disabled=false;
 list.forEach(([title,type,level],i)=>{const c=document.createElement("article");c.className="mission"+(isDone(i)?" done":"");
 const b=document.createElement("button");b.textContent=isDone(i)?"Rejouer ✓":"Jouer ➜";b.disabled=!available();
 const tag=document.createElement("span");tag.className="number";tag.textContent="Mission "+(i+1);
 const h=document.createElement("h3");h.textContent=title;
 const p=document.createElement("p");p.textContent=type==="poetry"?"Récite les 15 vers sans regarder, comme devant la maîtresse.":type.startsWith("dictation")?"Écoute sans voir le mot, écris sur le tableau puis découvre la correction.":type==="hundred"?"Trouve le nombre qui manque pour faire exactement 100.":(type.startsWith("write")||type.startsWith("spell"))?"Observe le mot pendant 3 secondes, puis écris-le avec ton doigt sur l’ardoise.":"5 à 10 minutes de jeu tranquille.";
 c.append(tag,h,p,b);b.addEventListener("click",()=>{practiceSource=null;if(type==="poetry")openModule("poetry");else startGame(i,title,type,level)});host.append(c)});
 if(!list.length){host.textContent="Aucune mission prévue ce jour."}
}
function shuffled(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
const clean=s=>String(s).normalize("NFC").trim().toLocaleLowerCase("fr").replace(/[’‘]/g,"'").replace(/\s+/g," ");
function cumulativeWords(graph,level){return [...new Set(Array.from({length:level},(_,i)=>D.words[graph]?.[i+1]||[]).flat())]}
function alphabetKey(word){return clean(word).replace(/^(?:un|une|le|la|les|des|du|de la)\s+/,"").replace(/^l'/,"")}
function item(prompt,answer,options,hint,label="Choisis la bonne réponse"){return {mode:"choice",prompt,answer:String(answer),options:shuffled([...new Set(options.map(String))]),hint,label}}
function generate(type,level){
 if(type.startsWith("dictation-")){
  // Dictée orale sans modèle ; tous les sons des listes connues.
  const kind=type.slice("dictation-".length),set=D.words[kind];
  if(!set)return [];
  const words=level===1?set[1]:level===2?set[2]:cumulativeWords(kind,Math.min(level,3));
  return shuffled([...new Set(words)]).slice(0,6).map(w=>({
   mode:"dictation",prompt:"Écoute le mot et écris-le sans modèle.",answer:w,
   label:"Contrôle de dictée — son "+kind,
   hint:"Écris avec ton doigt ou ton Pencil. Tu peux réécouter le mot autant de fois que nécessaire."
  }));
 }
 if(type==="hundred"){
  const amounts=level===1?[20,40,60,70,80,30]:level===2?[25,35,45,55,65,75]:[18,27,39,46,58,73];
  return amounts.map(a=>{
   const answer=100-a;
   return item(a+" + ? = 100",answer,[answer,answer+10,answer-10,answer+1].filter(n=>n>=0&&n<=100),
    "Compte combien il manque pour atteindre 100, en passant d’abord par la dizaine supérieure.",
    level===3?"Mini-évaluation — compléments à 100":"Les compléments à 100");
  });
 }
 if(type.startsWith("read-")){
 const graph=type.slice(5),words=cumulativeWords(graph,level),seenTargets=new Set(),targets=words.filter(w=>{const key=alphabetKey(w);if(seenTargets.has(key))return false;seenTargets.add(key);return true}).slice(0,6);
 const targetKeys=new Set(words.map(alphabetKey)),seenOthers=new Set();
 const others=Object.values(D.words).flatMap(m=>Object.values(m).flat()).filter(w=>{const key=alphabetKey(w);if(targetKeys.has(key)||seenOthers.has(key))return false;seenOthers.add(key);return true});
 return targets.map((correct,i)=>{const start=(i*2)%Math.max(1,others.length),distractors=[others[start%others.length],others[(start+1)%others.length]];return item("Quel mot appartient à la liste du son « "+graph+" » ?",correct,[correct,...distractors],"Cherche un mot que tu as appris dans la liste de ce son.","Lecture — son "+graph)});
 }
 if(type.startsWith("spell-")){
 const kind=type.slice(6),words=cumulativeWords(kind,level);
 return shuffled(words).slice(0,Math.min(6,words.length)).map(w=>({mode:"write",prompt:"Observe le mot, puis écris-le sur l’ardoise.",answer:w,label:"Mémoire et écriture — son "+kind,hint:"Le modèle reste affiché 3 secondes, puis écris-le de mémoire avec ton doigt."}));
 }
 if(type.startsWith("write-")){
 const kind=type.slice(6),words=cumulativeWords(kind,level);
 return shuffled(words).slice(0,4).map(w=>({mode:"write",prompt:"Écris le mot sur l’ardoise.",answer:w,label:"Écriture cursive",hint:"Regarde le modèle au moins 4 secondes, puis écris sans le voir."}));
 }
 if(type==="alphabet"){
 const sets=level===1?[["un arbre","un fruit","la rue"],["un loup","une souris","un arbre"]]:[["la route","le roi","la rue"],["une plume","un pull","un pantalon"]];
 return sets.map(words=>{const ordered=[...words].sort((a,b)=>alphabetKey(a).localeCompare(alphabetKey(b),"fr"));return item("Quel mot vient en premier dans l’ordre alphabétique ?",ordered[0],words,"Compare les lettres une par une. Ignore le petit mot placé devant.","Ordre alphabétique")});
 }
 if(type==="tens"){
 const beforeAfter=level===1?[[95,"avant"],[98,"après"],[90,"avant"],[97,"après"]]:[[64,"avant"],[72,"après"],[80,"avant"],[89,"après"]];
 const comparisons=level===1?[[65,95],[92,62],[91,91],[99,88]]:[[64,46],[37,73],[55,55],[81,18]];
 const lineNumbers=level===1?[59,72,88,95,97]:[61,74,86,92,99];
 const bands=level===1?[[87,90],[94,96]]:[[81,84],[96,99]];
 const adjacent=beforeAfter.map(([n,side])=>{const answer=side==="avant"?n-1:n+1;return item("Quel est le nombre "+side+" "+n+" ?",answer,[answer,n,side==="avant"?n+1:n-1],"Pour trouver le nombre avant, recule d’un. Pour trouver le nombre après, avance d’un.","Le nombre avant et le nombre après")});
 const compare=comparisons.map(([a,b])=>{const answer=a<b?"<":a>b?">":"=";return item("Compare "+a+" et "+b+" : quel signe faut-il écrire ?",answer,["<",">","="],"Compare les deux nombres, puis choisis le signe plus petit <, plus grand > ou égal =.","Comparer les nombres")});
 const line=lineNumbers.map(n=>({...item("Sur la droite graduée, quelle graduation correspond à "+n+" ?",n,[n,n-1,n+1,n+2],"Chaque petite graduation avance d’un. Repère les dizaines écrites sous la droite.","Se repérer sur la droite graduée"),numberLine:true}));
 const numberBand=bands.map(([start,missing])=>item("Complète la bande numérique : "+[start,start+1,start+2,"___",missing+1,missing+2].join(" · "),missing,[missing,missing-1,missing+1,missing+10],"Les nombres se suivent : après un nombre, on avance d’un.","La bande numérique"));
 return [...adjacent,...compare,...line,...numberBand].map(q=>q.numberLine?{...q,numberLine:{min:59,max:100}}:q);
 }
 if(type==="friends"){
 return [7,4,6,9,3,5,8,2].slice(level===2?2:0,level===2?8:6).map(a=>item(a+" + ? = 10",10-a,[10-a,Math.max(0,9-a),Math.min(9,11-a)],"Compte les cases qui manquent jusqu’à 10.","Les amis de 10"));
 }
 if(type==="subtract"){
 const pairs=level===1?[[36,7],[44,8],[52,4],[66,9],[36,7],[52,4]]:level===2?[[46,8],[64,7],[83,6],[51,9],[72,5],[66,9]]:[[35,7],[62,8],[74,6],[91,7],[43,9],[80,5]];
 return pairs.map(([a,b])=>{const answer=a-b;return {...item(a+" − "+b+" = ?",answer,[answer,answer+10,answer-2,answer+2],"Pour soustraire en passant par la dizaine, enlève d’abord juste ce qu’il faut pour atteindre la dizaine inférieure. Puis enlève le reste.","Soustraire en passant par la dizaine"),scratchpad:true,scratchRows:[a+" − ____ = ____","____ − ____ = ____"]}});
 }
 if(type==="add-cdu"){
  // Trois présentations scolaires. On n'affiche aucune proposition de résultat avant validation.
  const groups={
    1:{label:"CDU + DU (3 chiffres + 2)",pairs:[[127,47],[156,78],[238,56],[131,22],[214,65],[305,87]]},
    2:{label:"DU + CDU (2 chiffres + 3)",pairs:[[49,129],[47,127],[75,236],[21,154],[68,217],[34,465]]},
    3:{label:"CDU + CDU (3 chiffres + 3)",pairs:[[131,122],[238,156],[409,187],[274,315],[357,268],[142,346]]}
  };
  const group=groups[level]||groups[1];
  return shuffled(group.pairs).map(([a,b])=>{
   const answer=a+b;
   return {...item(a+" + "+b+" = ?",answer,[],
    "Aligne les centaines, les dizaines et les unités. Commence par les unités ; pense à la retenue si nécessaire.",
    group.label),numeric:true,scratchpad:true,carryNumbers:{a,b}};
  });
 }
 if(type==="carry"){
  // Toutes les sommes demandent le passage d'une dizaine.
  const pairs=[[27,15],[36,27],[48,16],[54,28],[67,18],[29,35],[45,37],[58,24],[26,47],[34,29],[47,36],[39,42]];
  return shuffled(pairs).slice(0,6).map(([a,b])=>{
   const n=a+b;
   return {...item(a+" + "+b+" = ?",n,[n,n-10,n+10,n+2],
    "Commence par les unités. Si leur somme atteint 10, écris le chiffre des unités et reporte une dizaine. Ajoute ensuite les dizaines sans oublier la retenue.",
    "Addition posée avec retenue"),scratchpad:true,carryNumbers:{a,b}};
  });
 }
 if(type==="add"){
 const pairs=level===1?[[63,22],[27,42],[43,54],[32,46],[25,42],[20,35]]:level===2?[[26,47],[35,28],[48,16],[57,25],[38,26],[17,45]]:[[25,42],[53,29],[36,47],[44,38],[19,63],[56,27]];
 return pairs.map(([a,b])=>{const n=a+b;return {...item(a+" + "+b+" = ?",n,[n,n-10,n+10,n-2],"Décompose chaque nombre en dizaines et unités. Additionne les dizaines entre elles, puis les unités. Si les unités dépassent 9, échange 10 unités contre une dizaine.","Addition par décomposition des dizaines et des unités"),scratchpad:true,scratchRows:[a+" + "+b+" = ____","____ + ____ + ____ + ____ = ____","____ + ____ = ____"]}});
 }
 if(type==="negative"){
 const all=D.questions.negative;const start=level===1?0:level===2?2:level===3?1:0;
 return [...all.slice(start),...all.slice(0,start)].slice(0,Math.min(level===4?8:6,all.length)).map(([original,right,wrong])=>item("Transforme : « "+original+" »",right,[right,wrong,original],"Il faut deux parties : ne (ou n’) avant le verbe, et pas après le verbe.","Détective des phrases négatives"));
 }
 if(type==="time"){
 return D.questions.time.slice(level===1?0:2,level===1?6:8).map(([sentence,answer])=>item("« "+sentence+" » : quand cela se passe-t-il ?",answer,["passé","présent","futur"],"Hier = passé ; aujourd’hui = présent ; demain = futur.","La machine du temps"));
 }
 return [];
}
function mathLesson(type){
 const lessons={
  add:{audio:"lili-math-add",text:"Pour additionner, sépare les dizaines et les unités. Soixante-trois, c’est soixante plus trois. Vingt-deux, c’est vingt plus deux. Additionne d’abord les dizaines : soixante plus vingt, ça fait quatre-vingts. Puis les unités : trois plus deux, ça fait cinq. Enfin, quatre-vingts plus cinq, ça fait quatre-vingt-cinq. À toi d’essayer !"},
  subtract:{audio:"lili-math-subtract",text:"Pour soustraire en passant par la dizaine, enlève d’abord juste ce qu’il faut pour arriver à la dizaine. Trente-six moins sept : j’enlève six à trente-six, il reste trente. Il reste encore un à enlever : trente moins un, ça fait vingt-neuf. À toi d’essayer !"},
  tens:{audio:"lili-math-numbers",text:"Pour trouver le nombre avant, recule d’un. Pour trouver le nombre après, avance d’un. Pour comparer, regarde quel nombre est le plus grand et choisis le bon signe : plus petit, plus grand ou égal. Sur la droite, chaque petite graduation avance d’un. Dans la bande, compte les nombres dans l’ordre. À toi !"},
  friends:{audio:"lili-math-friends",text:"Pour trouver ce qui manque jusqu’à dix, compte en avançant. Par exemple, après six, il faut encore quatre pas : sept, huit, neuf, dix. Donc six plus quatre, ça fait dix. À toi d’essayer !"}
 };
 return lessons[type]||null;
}
function gameLesson(type,level){
 if(type==="add-cdu")return {
  audio:null,
  text:"Aligne bien les centaines (C), les dizaines (D) et les unités (U). Tu peux poser les nombres au doigt sur le tableau. Le résultat ne sera montré qu’après ta validation.",
  cards:["Exemple : 142 + 26","Unités : 2 + 6 = 8","Dizaines : 4 + 2 = 6","Centaines : 1","142 + 26 = 168"]
 };
 if(type==="carry")return {
  audio:null,
  text:"Si les unités font 10 ou plus, écris leur dernier chiffre en bas et reporte 1 dans la colonne des dizaines. Puis ajoute les dizaines et la retenue.",
  cards:["27 + 15 : commence par les unités","7 + 5 = 12 : écris 2, reporte 1 dizaine","2 dizaines + 1 dizaine + 1 retenue = 4","Le résultat est 42. À toi d’essayer !"]
 };
 if(type==="hundred")return {
  audio:null,
  text:"Un complément à 100, c’est ce qu’il faut ajouter pour arriver exactement à 100. Regarde les dizaines, puis les unités si besoin.",
  cards:["20 + ? = 100","20 + 80 = 100","35 + ? = 100","35 + 5 = 40, puis 40 + 60 = 100","35 + 65 = 100"]
 };
 const math=mathLesson(type);
 const graph=type.startsWith("read-")?type.slice(5):type.startsWith("spell-")||type.startsWith("write-")?type.slice(6):null;
 const audio=math?.audio||"lili-lesson-"+(type.startsWith("spell-")?"spell":type.startsWith("write-")?"write":type.startsWith("read-")?type:type);
 const cards={
  add:["63 = 60 + 3","22 = 20 + 2","60 + 20 = 80","3 + 2 = 5","80 + 5 = 85"],
  subtract:["36 − 7","36 − 6 = 30","Il reste 1 à enlever","30 − 1 = 29"],
  tens:["Avant : 64 ← 65 → 66","Après : 71 ← 72 → 73","46 < 64 · 73 > 37 · 55 = 55","On avance d’une graduation à la suivante"],
  friends:["6 + ? = 10","7 · 8 · 9 · 10","Quatre pas pour arriver à 10","6 + 4 = 10"],
  negative:["Phrase : Il joue","Le verbe : joue","Il + ne + joue + pas","Il ne joue pas"],
  time:["HIER → PASSÉ","AUJOURD’HUI → PRÉSENT","DEMAIN → FUTUR"],
  alphabet:["Roi · Rue · Route","Compare la 1re lettre","Si elle est pareille, compare la suivante","A → B → C → … → R"],
 };
 if(graph&&type.startsWith("read-"))cards[type]=["Écoute le son : « "+graph+" »",...(D.words[graph]?.[1]||[]).slice(0,3),"Trouve le mot de la bonne famille !"];
 if(type.startsWith("spell-"))cards[type]=["1 · Regarde le mot","2 · Photographie-le dans ta tête","3 · Le modèle disparaît","4 · Écris-le, puis vérifie"];
 if(type.startsWith("write-"))cards[type]=["1 · Observe le modèle","2 · Repère les lettres","3 · Attache-les en cursive","4 · Écris avec ton doigt"];
 const text=math?.text||({negative:"On place « ne » avant le verbe et « pas » après. Devant une voyelle, « ne » devient « n’ ».",time:"Hier indique le passé ; aujourd’hui, le présent ; demain, le futur.",alphabet:"Compare les mots lettre par lettre, en commençant par la première.",spell:"Observe le mot, mémorise-le, puis écris-le quand il disparaît.",write:"Observe le modèle, puis écris le mot en cursive avec ton doigt."}[type]||(type.startsWith("read-")?"Écoute le son, observe les lettres et trouve un mot qui contient ce son.":""));
 return cards[type]?{audio,text,cards:cards[type]}:null;
}
function renderLessonVisual(lesson){
 clearInterval(lessonTimer);const title=$("lessonVisualTitle"),step=$("lessonVisualStep"),progress=$("lessonVisualProgress"),slidesHost=$("lessonVisualSlides");
 slidesHost.replaceChildren();title.textContent="Regardons comment faire";
 const slides=lesson.cards.map((text,i)=>{const card=document.createElement("div");card.className="lesson-slide"+(i===0?" active":"");card.textContent=text;card.setAttribute("aria-label","Étape "+(i+1)+" : "+text);slidesHost.appendChild(card);return card});
 progress.replaceChildren();const dots=slides.map((_,i)=>{const dot=document.createElement("i");if(i===0)dot.classList.add("active");progress.appendChild(dot);return dot});
 let index=0;step.textContent="Étape 1 sur "+slides.length;
 const advance=()=>{slides[index].classList.remove("active");dots[index].classList.remove("active");index=(index+1)%slides.length;slides[index].classList.add("active");dots[index].classList.add("active");step.textContent="Étape "+(index+1)+" sur "+slides.length};
 lessonTimer=setInterval(advance,2600);
 window.GusMedia?.present?.();
}
function startGame(id,title,type,level){
 if(!available())return;
 const questions=generate(type,level);
 if(!questions.length)return;
 game={id,title,type,questions,pos:0,mistakes:0,correct:0,wrongOnCurrent:false,solved:false,writeTimer:null,hintLevel:0,hintTimer:null};
 document.body.classList.add("playing");$("gameName").textContent=title;show("home",false);show("finish",false);show("play",true);window.scrollTo({top:0,behavior:"smooth"});
 clearInterval(lessonTimer);window.GusMedia?.stop?.();$("question").textContent="";$("promptType").textContent=title;$("hint").textContent="";$("feedback").textContent="";$("choices").replaceChildren();
 show("numberLine",false);show("handwrite",false);show("nextBtn",false);show("lessonVisual",false);show("lessonGo",false);show("retryWrite",false);show("hintWrite",false);show("writeHint",false);show("boardBox",false);show("clearWrite",false);show("undoWrite",false);show("verifyWrite",false);
 startTimer();musicStart();
 const lesson=gameLesson(type,level),session=game;
 if(lesson){
  $("question").textContent="Gus te montre, Lili t’explique…";$("hint").textContent=lesson.text;renderLessonVisual(lesson);show("lessonVisual",true);
  if(lesson.audio){
   playVoice(lesson.audio,()=>{if(game===session){clearInterval(lessonTimer);window.GusMedia?.stop?.();renderQuestion();startIdleWatch()}});
  }else show("lessonGo",true);
 }else{renderQuestion();startIdleWatch()}
}
function renderQuestion(){
 if(!game)return;const q=game.questions[game.pos];
 clearInterval(lessonTimer);window.GusMedia?.stop?.();show("lessonVisual",false);show("lessonGo",false);
 clearTimeout(game.writeTimer);clearTimeout(game.writeFallback);clearTimeout(game.hintTimer);game.writeTimer=null;game.writeFallback=null;game.hintTimer=null;game.hintLevel=0;
 game.solved=false;game.wrongOnCurrent=false;$("promptType").textContent=q.label;
 $("question").textContent=q.prompt;$("hint").textContent=q.hint;$("feedback").textContent="";
 $("boardBox").classList.remove("wrong-answer");show("retryWrite",false);show("hintWrite",false);show("writeHint",false);$("writeHint").textContent="";
 $("bar").style.width=(game.pos/game.questions.length*100)+"%";$("count").textContent=(game.pos+1)+" / "+game.questions.length;
 show("nextBtn",false);show("numberAnswer",Boolean(q.numeric));
 if(q.numeric){$("answerValue").value="";$("answerValue").disabled=false;$("checkNumber").disabled=false}
 show("handwrite",q.mode==="write"||q.mode==="dictation"||Boolean(q.scratchpad));
 show("dictationControls",q.mode==="dictation");show("dictationManual",false);
 $("retryWrite").textContent="Réécrire le mot";
 $("handwrite").classList.toggle("scratch-active",Boolean(q.scratchpad));show("scratchHelp",Boolean(q.scratchpad));
 renderScratchGuide(q);
 show("numberLine",Boolean(q.numberLine));if(q.numberLine)drawNumberLine(q.numberLine);
 $("choices").replaceChildren();
 if(q.mode==="choice"&&!q.numeric){
 q.options.forEach(option=>{const b=document.createElement("button");b.textContent=option;
 b.addEventListener("click",()=>choose(b,option,q));$("choices").appendChild(b)});
 }
 if(q.scratchpad){
 $("memory").classList.add("hide");show("boardBox",true);show("clearWrite",true);show("undoWrite",true);show("verifyWrite",false);show("hintWrite",false);
 canvasStrokes=[];stroke=null;paintBoard();requestAnimationFrame(initCanvas);
 }else if(q.mode==="dictation"){
  $("memory").textContent="Écoute le mot, puis écris-le."; // Le mot reste caché jusqu’à validation.
  $("memory").classList.remove("hide");
  show("boardBox",true);show("clearWrite",true);show("undoWrite",true);
  show("verifyWrite",true);$("verifyWrite").disabled=false;
  canvasStrokes=[];stroke=null;requestAnimationFrame(initCanvas);
  speakDictation();
 }else if(q.mode==="write"){
 $("memory").textContent="Regarde bien le mot…";$("memory").classList.remove("hide");
 show("boardBox",false);show("clearWrite",false);show("undoWrite",false);show("verifyWrite",false);
 canvasStrokes=[];paintBoard();showWrite();
 }
}
function renderScratchGuide(q){
 const host=$("scratchGuide");host.replaceChildren();
 host.classList.toggle("is-carry",Boolean(q.carryNumbers));
 if(q.carryNumbers){
  const {a,b}=q.carryNumbers,model=document.createElement("div");
  model.className="carry-model";
  const title=document.createElement("strong");title.className="carry-guide-title";
  title.textContent="Écris au doigt la retenue et la réponse";model.append(title);
  const row=(values,kind)=>{
   const line=document.createElement("div");line.className="carry-grid "+kind;
   for(const value of values){
    const cell=document.createElement("span");cell.textContent=String(value);
    if(value==="□")cell.className="carry-empty";
    line.append(cell);
   }
   model.append(line);
  };
  const three=a>=100||b>=100;
  const digits=n=>three?[n>=100?Math.floor(n/100):"",Math.floor(n/10)%10,n%10]:[Math.floor(n/10),n%10];
  if(three)model.classList.add("is-cdu");
  row(["",...(three?["C","D","U"]:["D","U"])],"carry-head");
  row(["ret.",...Array(three?3:2).fill("□")],"carry-ret");
  row(["",...digits(a)],"carry-first");
  row(["+",...digits(b)],"carry-second");
  row(["=",...Array(three?3:2).fill("□")],"carry-answer");
  host.append(model);host.hidden=false;return;
 }
 for(const row of q.scratchRows||[]){
  const line=document.createElement("div");line.className="scratch-row";
  for(const token of String(row).match(/\d+|____|[+−=]/g)||[]){
   const part=document.createElement("span");
   if(token==="____"){part.className="scratch-slot";part.setAttribute("aria-hidden","true")}
   else{part.className="scratch-fixed";part.textContent=token}
   line.appendChild(part)
  }
  host.appendChild(line)
 }
 host.hidden=!q.scratchpad;
}
function drawNumberLine({min,max}){
 const line=$("numberLine");line.replaceChildren();line.setAttribute("aria-label","Droite graduée de "+min+" à "+max+", avec une graduation par nombre");
 for(let n=min;n<=max;n++){const tick=document.createElement("span");tick.className="number-tick"+(n%10===0?" decade":"");const mark=document.createElement("i");tick.appendChild(mark);if(n%10===0){const label=document.createElement("small");label.textContent=n;tick.appendChild(label)}line.appendChild(tick)}
}
function succeed(text){if(!game||game.solved)return;game.solved=true;game.correct++;markActivity();stopGusMoments();$("feedback").textContent=text||"Bravo Harmonie, tu as trouvé !";show("nextBtn",true);window.GusMedia?.playCorrect();}
function checkNumberAnswer(){
 if(!game||game.solved)return;
 const q=game.questions[game.pos];if(!q?.numeric)return;
 const raw=$("answerValue").value.trim();
 if(!/^\d{1,4}$/.test(raw)){
  $("feedback").textContent="Écris le résultat de ton addition dans la case, puis appuie sur Valider.";
  return;
 }
 markActivity();
 const answer=Number(raw);
 if(answer===Number(q.answer)){
  $("answerValue").disabled=true;$("checkNumber").disabled=true;
  succeed("Bravo ! "+q.prompt.replace(" = ?","")+" = "+q.answer+".");
 }else{
  game.mistakes++;game.wrongOnCurrent=true;
  $("feedback").textContent="Ce n’est pas encore le bon résultat. Recompte les unités, les dizaines et les centaines.";
  $("answerValue").focus();
  $("answerValue").select();
 }
}
function choose(button,selected,q){
 if(!game||game.solved)return;
 if(clean(selected)===clean(q.answer)){
 button.classList.add("correct");[...$("choices").children].forEach(b=>b.disabled=true);
 succeed("Bravo ! "+q.answer+".");say("Bravo Harmonie ! Tu as trouvé le bon mot. Continue comme ça !");
 }else{
 button.classList.add("wrong");button.disabled=true;game.mistakes++;game.wrongOnCurrent=true;
 window.GusMedia?.play("04_Oups");
  $("feedback").textContent="Pas tout à fait. "+q.hint+" Essaie une autre réponse.";say("Ce n’est pas grave, on essaie encore. "+q.hint);
 }
}
function paintBoard(){
 const c=$("board");if(!ctx||!c.width)return;
 ctx.clearRect(0,0,canvasWidth,canvasHeight);ctx.lineWidth=5;ctx.strokeStyle="#fff6d7";ctx.lineJoin="round";ctx.lineCap="round";
 for(const pts of canvasStrokes){if(!pts.length)continue;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke()}
 if(stroke?.length){ctx.beginPath();ctx.moveTo(stroke[0].x,stroke[0].y);for(const p of stroke.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke()}
}
function initCanvas(){
 const c=$("board"),rect=c.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvasWidth=Math.max(rect.width,100);canvasHeight=Math.max(rect.height,100);
 c.width=Math.round(canvasWidth*dpr);c.height=Math.round(canvasHeight*dpr);ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);paintBoard();
}
function showWrite(){
 if(!game)return;const q=game.questions[game.pos];
 const session=game,position=game.pos;
 $("memory").textContent=q.answer;$("memory").classList.remove("hide");
 show("boardBox",false);
 let minimumElapsed=false;const revealBoard=()=>{if(!minimumElapsed||!game||game!==session||game.pos!==position)return;$("memory").textContent="Écris de mémoire…";$("memory").classList.add("hide");show("boardBox",true);show("hintWrite",true);show("clearWrite",true);show("undoWrite",true);show("verifyWrite",true);requestAnimationFrame(initCanvas);game.writeTimer=null};
 game.writeTimer=setTimeout(()=>{minimumElapsed=true;revealBoard()},3000);
}
function recognitionCanvas(){
 const pts=canvasStrokes.filter(s=>s.length>1).flat();if(!pts.length)return null;
 const minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
 const scale=Math.min(3,820/Math.max(1,maxX-minX),210/Math.max(1,maxY-minY)),pad=28,out=document.createElement("canvas");out.width=Math.max(180,Math.ceil((maxX-minX)*scale+pad*2));out.height=Math.max(100,Math.ceil((maxY-minY)*scale+pad*2));
 const c=out.getContext("2d");c.fillStyle="#fff";c.fillRect(0,0,out.width,out.height);c.strokeStyle="#29283c";c.lineWidth=Math.max(4,5*scale);c.lineCap="round";c.lineJoin="round";
 for(const s of canvasStrokes){if(s.length<2)continue;c.beginPath();c.moveTo(pad+(s[0].x-minX)*scale,pad+(s[0].y-minY)*scale);for(const p of s.slice(1))c.lineTo(pad+(p.x-minX)*scale,pad+(p.y-minY)*scale);c.stroke()}return out;
}
async function recognizeHandwriting(canvas){
 const imageBase64=canvas.toDataURL("image/png").split(",")[1];
 const response=await fetch("/api/recognize-handwriting",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageBase64})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw Error(result.message||"La reconnaissance manuscrite est indisponible.");
 return result;
}
function letterAlignment(expected,actual){
 const normalize=s=>clean(s).replace(/[^\p{L}\p{N} ]/gu," ").replace(/\s+/g," ").trim();
 const left=normalize(expected),right=normalize(actual),rows=Array.from({length:left.length+1},()=>Array(right.length+1).fill(0));
 for(let i=0;i<=left.length;i++)rows[i][0]=i;for(let j=0;j<=right.length;j++)rows[0][j]=j;
 for(let i=1;i<=left.length;i++)for(let j=1;j<=right.length;j++)rows[i][j]=left[i-1]===right[j-1]?rows[i-1][j-1]:Math.min(rows[i-1][j-1]+1,rows[i-1][j]+1,rows[i][j-1]+1);
 const expectedLetters=[],actualLetters=[];let i=left.length,j=right.length;
 while(i||j){
  if(i&&j&&left[i-1]===right[j-1]&&rows[i][j]===rows[i-1][j-1]){expectedLetters.push({char:left[--i],wrong:false});actualLetters.push({char:right[--j],wrong:false});continue}
  if(i&&j&&rows[i][j]===rows[i-1][j-1]+1){expectedLetters.push({char:left[--i],wrong:true});actualLetters.push({char:right[--j],wrong:true});continue}
  if(i&&rows[i][j]===rows[i-1][j]+1){expectedLetters.push({char:left[--i],wrong:true});continue}
  actualLetters.push({char:right[--j],wrong:true});
 }
 return {expected:expectedLetters.reverse(),actual:actualLetters.reverse()};
}
function showLetterComparison(expected,actual){
 const rows=letterAlignment(expected,actual),box=document.createElement("div");box.className="letter-check";
 for(const [label,letters] of [["Mot attendu",rows.expected],["Mot lu",rows.actual]]){const line=document.createElement("div"),caption=document.createElement("span");line.className="letter-check-row";caption.className="letter-check-label";caption.textContent=label+" : ";line.append(caption);for(const part of letters){if(part.char===" "){line.append(document.createTextNode(" "));continue}const letter=document.createElement("span");letter.textContent=part.char;if(part.wrong)letter.className="letter-check-wrong";line.append(letter)}box.append(line)}$("feedback").append(box);
}
function animateWrongAnswer(){
 const board=$("boardBox");board.classList.remove("wrong-answer");void board.offsetWidth;board.classList.add("wrong-answer");
 board.addEventListener("animationend",()=>board.classList.remove("wrong-answer"),{once:true});
}
function giveWriteHint(){
 if(!game||game.solved)return;
 markActivity();const q=game.questions[game.pos];if(!q||q.mode!=="write")return;
 const target=String(q.answer).replace(/^(?:un|une|le|la|les|des|du|de la)\s+/i,"").split(/\s+/).at(-1)||String(q.answer);
 const letters=Array.from(target);game.hintLevel=Math.min(3,(game.hintLevel||0)+1);
 const message=game.hintLevel===1?"Indice : le mot commence par « "+(letters[0]||"").toLocaleUpperCase("fr")+" »."
  :game.hintLevel===2?"Encore un indice : « "+letters.slice(0,2).join("").toLocaleLowerCase("fr")+"… », "+letters.length+" lettres."
  :"Dernier indice : regarde bien le mot, puis il disparaît.";
 $("writeHint").textContent=message;show("writeHint",true);
 if(game.hintLevel===3){const session=game,position=game.pos;$("memory").textContent=q.answer;$("memory").classList.remove("hide");clearTimeout(game.hintTimer);game.hintTimer=setTimeout(()=>{if(game===session&&game.pos===position){$("memory").textContent="Écris de mémoire…";$("memory").classList.add("hide");game.hintTimer=null}},1400)}
}
function offerWriteRetry(message,{countMistake=false,expected=null,actual=null}={}){
 const choices=$("choices");choices.replaceChildren();$("feedback").textContent=message;
 if(expected&&actual)showLetterComparison(expected,actual);
 game.retryCountsMistake=countMistake;
 if(countMistake){animateWrongAnswer();window.GusMedia?.play("04_Oups")}
 show("retryWrite",true);
}
function retryWrite(){
  if(!game)return;
  const countMistake=Boolean(game.retryCountsMistake);
  if(countMistake){game.mistakes++;markActivity()}
  renderQuestion();
  if(countMistake)game.wrongOnCurrent=true;
  say(countMistake?"Regarde bien le modèle. Il y a une lettre à corriger, puis tu réessaies !":"Je n’arrive pas bien à lire ton écriture. Trace chaque lettre séparément, puis réessaie !");
}
function handwritingDecision(expected,actual,confidence){
 const normalize=s=>clean(s).replace(/[^\p{L}\p{N}]/gu,"");
 const read=String(actual||"").trim();
 if(Number(confidence)>=70&&normalize(read)===normalize(expected))return {status:"correct",read};
 if(Number(confidence)>=55&&read)return {status:"incorrect",read};
 return {status:"unreadable",read};
}
async function compareWrite(){
 if(!game||!canvasStrokes.length){$("feedback").textContent="Essaie d’écrire au moins une lettre avant de comparer.";return}
 const q=game.questions[game.pos];if(q.mode==="dictation"){await compareDictation();return}$("memory").textContent="Écris de mémoire…";$("memory").classList.add("hide");show("hintWrite",false);show("writeHint",false);show("clearWrite",false);show("verifyWrite",false);$("verifyWrite").disabled=true;$("feedback").textContent="Je regarde ton écriture…";
 try{
  const canvas=recognitionCanvas();if(!canvas)throw Error("Écriture trop courte");const result=await recognizeHandwriting(canvas);if(!game)return;
  const decision=handwritingDecision(q.answer,result.text,result.confidence);
  if(decision.status==="correct"){succeed("Bravo ! Le correcteur a reconnu « "+decision.read+" » : le mot est juste !");say("Bravo Harmonie ! Le correcteur a reconnu le bon mot. Continue comme ça !");return}
  if(decision.status==="incorrect")offerWriteRetry("Le comparateur a lu « "+decision.read+" ». Les lettres en rouge sont celles qui diffèrent du modèle. Réessaie tranquillement.",{countMistake:true,expected:q.answer,actual:decision.read});
  else offerWriteRetry("Le comparateur n’arrive pas encore à déchiffrer l’écriture cursive. Appuie sur « Réécrire le mot » et réessaie tranquillement.");
 }catch{
  if(!game)return;
  const word=game.questions[game.pos]?.answer||"";
  $("memory").textContent="Modèle : "+word;$("memory").classList.remove("hide");
  $("feedback").textContent="Le correcteur est indisponible. Compare ton écriture avec le modèle, puis demande à un adulte de vérifier.";
  const accept=document.createElement("button");accept.type="button";accept.textContent="Un adulte confirme mon écriture";
  accept.addEventListener("click",()=>{$("choices").replaceChildren();succeed("Écriture vérifiée avec un adulte. Bravo pour tes efforts !")});
  $("choices").replaceChildren(accept);show("retryWrite",true);
 }
 finally{if($("verifyWrite"))$("verifyWrite").disabled=false}
}
function finishDictationValidation(session,position,decision){
 if(game!==session||game.pos!==position)return;
 const q=game.questions[position];
 game.solved=true;markActivity();stopGusMoments();stopDictation();
 $("memory").textContent="Correction : "+q.answer;
 $("memory").classList.remove("hide");show("dictationControls",false);
 show("verifyWrite",false);show("hintWrite",false);show("writeHint",false);show("clearWrite",false);
 show("undoWrite",false);show("nextBtn",true);
 if(decision.status==="correct"){
  game.correct++;$("feedback").textContent="Bravo ! Le mot est correctement écrit : « "+q.answer+" ».";
  show("retryWrite",false);show("dictationManual",false);
 }else{
  if(decision.status==="incorrect"){
   game.mistakes++;game.wrongOnCurrent=true;
   $("feedback").textContent="Le correcteur a lu « "+decision.read+" ». Voici le bon mot : « "+q.answer+" ». Compare les lettres.";
   showLetterComparison(q.answer,decision.read);
  }else{
   $("feedback").textContent="Le correcteur n’a pas pu lire cette écriture avec certitude. Voici le mot attendu : « "+q.answer+" ».";
  }
  $("retryWrite").textContent="Réécrire ce mot";
  game.retryCountsMistake=false;
  show("retryWrite",true);show("dictationManual",true);
 }
}
async function compareDictation(){
 if(!game||game.solved||!canvasStrokes.length){
  $("feedback").textContent="Écris d’abord le mot sur le tableau, puis valide.";
  return;
 }
 const session=game,position=game.pos,q=game.questions[position];
 $("verifyWrite").disabled=true;show("dictationControls",false);
 $("feedback").textContent="Je vérifie ton écriture…";
 let decision={status:"unreadable",read:""};
 try{
  const canvas=recognitionCanvas();
  if(canvas){
   const result=await recognizeHandwriting(canvas);
   decision=handwritingDecision(q.answer,result.text,result.confidence);
  }
 }catch{
  // La correction reste visible après validation, même en cas d’indisponibilité du serveur.
 }
 finishDictationValidation(session,position,decision);
 $("verifyWrite").disabled=false;
}
function acceptDictationManually(){
 if(!game||!game.solved||game.questions[game.pos]?.mode!=="dictation")return;
 game.correct++;game.wrongOnCurrent=false;
 $("feedback").textContent="Réponse vérifiée avec un adulte. Le mot attendu était « "+game.questions[game.pos].answer+" ».";
 show("dictationManual",false);show("retryWrite",false);
}
function next(){
 if(!game||!game.solved)return;
 progress.results.push({date:chosen,mission:game.title,answer:game.questions[game.pos].answer,errors:Number(game.wrongOnCurrent),type:game.questions[game.pos].mode});
 save();game.pos++;
 if(game.pos<game.questions.length){renderQuestion();const q=game.questions[game.pos];if(q.mode==="choice")say(q.prompt+" "+q.hint);return}
 const done=game;if(typeof done.id==="number")complete(done.id);endGame();
 $("finishText").textContent="Tu as terminé "+done.questions.length+" défis avec "+done.correct+" réponses validées. Les erreurs sont normales : chaque essai compte !";
 show("home",false);show("finish",true);window.GusMedia?.playFinish?.();say("Bravo Harmonie ! Tu as terminé ta mission. Chaque essai t’a aidée à apprendre, je suis fière de toi !");
}
function endGame(){
 stopDictation();document.body.classList.remove("playing");
 clearInterval(lessonTimer);lessonTimer=null;
 if(!game){show("play",false);show("home",true);return}
 const t=game.writeTimer,f=game.writeFallback,h=game.hintTimer;game.writeTimer=null;game.writeFallback=null;game.hintTimer=null;if(t)clearTimeout(t);if(f)clearTimeout(f);if(h)clearTimeout(h);
 stopTimer();stopIdleWatch();game=null;stopVoice();musicStop();window.GusMedia?.stop();show("play",false);show("home",true);render();
}
function stopForDay(){
 if(activeModule)closeModule();
 stopDictation(); // Atteinte de la limite : pas de nouveau jeu ni de question suivante.
 clearInterval(lessonTimer);lessonTimer=null;
 const t=game?.writeTimer,f=game?.writeFallback,h=game?.hintTimer;if(t)clearTimeout(t);if(f)clearTimeout(f);if(h)clearTimeout(h);
 game=null;document.body.classList.remove("playing");stopTimer();stopIdleWatch();stopVoice();musicStop();window.GusMedia?.stop();show("play",false);show("finish",false);show("home",true);render();
 $("dayStatus").textContent="30 minutes terminées : bravo, repose-toi maintenant !";
}
function exportCSV(){
 const lines=[["date","mission","type","reponse_attendue","erreur_au_premier_essai"],...progress.results.map(x=>[x.date,x.mission,x.type,x.answer,x.errors])];
 const csv="\uFEFF"+lines.map(r=>r.map(s=>'"'+String(s??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="harmonie-progres.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function parent(){
 const total=progress.results.length,wrong=progress.results.filter(x=>x.errors).length,extra=progress.moduleResults||[];
 const sessions=Object.keys(progress.spent).sort().map(k=>k+": "+Math.ceil(progress.spent[k]/60)+" min, "+(progress.done[k]||[]).length+" missions");
 $("parentStats").replaceChildren();
 [total+" réponses enregistrées",wrong+" réponses corrigées après un premier essai",extra.length+" ateliers terminés",...extra.slice(-12).map(x=>x.date+" : "+x.module+" · "+x.count+" exercices, "+x.stars+" étoiles"),...sessions].forEach(s=>{const p=document.createElement("p");p.textContent=s;$("parentStats").appendChild(p)});
 if(typeof $("parentDialog").showModal==="function")$("parentDialog").showModal();else $("parentDialog").setAttribute("open","");
}
function closeParent(){$("parentDialog").close?.();$("parentDialog").removeAttribute("open")}
// Portail unifié : les moteurs ardoise et alphabet restent intacts dans des vues intégrées.
const modulePaths={ardoise:"../ardoise-magique/atelier-ecriture.html",alphabet:"../harmonie-alphabet/index.html"};
function selectView(view){
 for(const b of document.querySelectorAll("[data-harmonie-view]")){
  const active=b.dataset.harmonieView===view;
  b.classList.toggle("active",active);b.setAttribute("aria-current",active?"page":"false");
 }
}
function hideAllViews(){
 for(const id of ["home","play","finish","practicePanel","moduleView","poetryPanel"])show(id,false);
}
function closeModule(){
 if(!activeModule)return;
 stopTimer();const old=activeModule;activeModule=null;
 if(old==="poetry")window.HarmoniePoetry?.stop();
 if(old==="ardoise"||old==="alphabet")$("moduleFrame").src="about:blank";
}
function showHome(){
 if(game)endGame();
 if(activeModule)closeModule();
 practiceSource=null;hideAllViews();
 show("home",true);show("days",true);show("summary",true);
 $("gus-panel").hidden=false;selectView("home");render();
}
function openModule(kind){
 if(!["ardoise","alphabet","poetry"].includes(kind))return;
 if(game)endGame();if(activeModule)closeModule();
 practiceSource=null;hideAllViews();
 show("days",false);show("summary",true);$("gus-panel").hidden=true;
 activeModule=kind;selectView(kind);
 if(kind==="poetry"){show("poetryPanel",true);window.HarmoniePoetry?.open()}
 else {
  show("moduleView",true);
  $("moduleTitle").textContent=kind==="ardoise"?"Ardoise magique":"Défi alphabétique";
  const iframe=$("moduleFrame");iframe.title=$("moduleTitle").textContent;
  iframe.src=modulePaths[kind];
 }
 startTimer();
}
function openPracticePanel(kind){
 if(!["dictation","maths"].includes(kind))return;
 if(game)endGame();if(activeModule)closeModule();
 practiceSource=kind;hideAllViews();show("practicePanel",true);show("days",false);show("summary",true);
 $("gus-panel").hidden=true;selectView(kind);
 const options=kind==="dictation"?
  [["Dictée du son o — marche 1","dictation-o",1],["Dictée du son o — marche 2","dictation-o",2],
   ["Contrôle du son o — marches 1 à 3","dictation-o",3],["Dictée du son eu","dictation-eu",2],
   ["Dictée du son ou","dictation-ou",2],["Dictée du son u","dictation-u",2]]:
  [["Compléments à 100 — dizaines","hundred",1],["Compléments à 100 — niveau 2","hundred",2],
   ["Compléments à 100 — contrôle","hundred",3],["CDU + DU","add-cdu",1],
   ["DU + CDU","add-cdu",2],["CDU + CDU","add-cdu",3],["Additions avec retenue","carry",1],["Soustractions","subtract",2]];
 $("practiceTitle").textContent=kind==="dictation"?"Contrôle de dictée":"Atelier de mathématiques";
 $("practiceIntro").textContent=kind==="dictation"?
  "La maîtresse dicte, tu écris sur le tableau, puis tu découvres le bon mot seulement après validation.":
  "Choisis ton défi et entraîne-toi à ton rythme.";
 const host=$("practiceItems");host.replaceChildren();
 for(const [title,type,level] of options){
  const button=document.createElement("button");
  button.type="button";button.textContent=title;
  button.addEventListener("click",()=>{hideAllViews();startGame("free-"+type+"-"+level,title,type,level)});
  host.appendChild(button);
 }
}
function recordModuleResult(data){
 if(!data||!["ardoise","alphabet"].includes(data.module))return;
 const record={date:currentDay(),module:data.module,
  count:Math.min(100,Math.max(0,Number(data.count)||0)),
  stars:Math.min(100,Math.max(0,Number(data.stars)||0))};
 progress.moduleResults.push(record);save();
}
window.addEventListener("message",event=>{
 if(event.origin!==window.location.origin)return;
 const data=event.data;
 if(!data||typeof data!=="object")return;
 if(data.kind==="harmonie:module-finished")recordModuleResult(data);
 if(data.kind==="harmonie:open-module"&&["ardoise","alphabet"].includes(data.module))openModule(data.module);
});
window.addEventListener("harmonie:poetry-finished",event=>{
 const poetryIndex=(D.schedule[chosen]||[]).findIndex((mission)=>mission[1]==="poetry");
 if(poetryIndex>=0)complete(poetryIndex);
 progress.moduleResults.push({date:currentDay(),module:"poésie",count:Number(event.detail?.count)||0,stars:Number(event.detail?.stars)||0});
 save();window.GusMedia?.playFinish?.();
});
document.querySelectorAll("[data-harmonie-view]").forEach(b=>b.addEventListener("click",()=>{
 const choice=b.dataset.harmonieView;
 if(choice==="home")showHome();
 else if(choice==="dictation"||choice==="maths")openPracticePanel(choice);
 else openModule(choice);
}));
document.querySelectorAll("[data-open-module]").forEach(b=>b.addEventListener("click",()=>openModule(b.dataset.openModule)));
$("practiceBack").addEventListener("click",showHome);
$("moduleBack").addEventListener("click",showHome);
$("poetryBack").addEventListener("click",showHome);
$("parentBtn").addEventListener("click",parent);$("closeParent").addEventListener("click",closeParent);$("closeParentBottom").addEventListener("click",closeParent);
$("exportCsv").addEventListener("click",exportCSV);
$("resetDay").addEventListener("click",()=>{if(confirm("Recommencer les missions ? Le temps déjà passé ne sera pas effacé.")){delete progress.done[chosen];save();closeParent();parent();render()}});
$("backBtn").addEventListener("click",()=>{const p=practiceSource;endGame();if(p)openPracticePanel(p)});
$("finishHome").addEventListener("click",()=>{show("finish",false);show("home",true);render();if(practiceSource)openPracticePanel(practiceSource)});
$("nextBtn").addEventListener("click",next);
$("replayDictation").addEventListener("click",()=>{markActivity();speakDictation(true)});
$("dictationManual").addEventListener("click",acceptDictationManually);
$("carryPractice").addEventListener("click",()=>startGame("carry-bonus","Additions avec retenue","carry",1));
document.querySelectorAll("[data-add-cdu]").forEach(b=>b.addEventListener("click",()=>{
 const level=Number(b.dataset.addCdu);
 const names={1:"CDU + DU",2:"DU + CDU",3:"CDU + CDU"};
 practiceSource=null;startGame("addition-cdu-"+level,"Additions à trois chiffres — "+names[level],"add-cdu",level);
}));
$("checkNumber").addEventListener("click",checkNumberAnswer);
$("answerValue").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();checkNumberAnswer()}});

$("quickDictationEu").addEventListener("click",()=>{
 const list=D.schedule[chosen]||[];
 const i=list.findIndex(m=>m[1]==="dictation-eu");
 const m=i<0?["Révision orale du son eu","dictation-eu",3]:list[i];
 practiceSource=null;startGame(i>=0?i:"revision-eu",m[0],m[1],m[2]);
});
$("quickPoetry").addEventListener("click",()=>openModule("poetry"));
$("lessonGo").addEventListener("click",()=>{if(!game)return;show("lessonGo",false);renderQuestion();startIdleWatch()});
$("verifyWrite").addEventListener("click",compareWrite);
$("hintWrite").addEventListener("click",giveWriteHint);
$("retryWrite").addEventListener("click",retryWrite);
$("gus-sound").addEventListener("click",()=>{const b=$("gus-sound"),on=b.getAttribute("aria-pressed")!=="true";b.setAttribute("aria-pressed",String(on));b.textContent=on?"🔔 Sons de Gus":"🔕 Sons coupés"});
$("voiceToggle").addEventListener("click",()=>{audioSettings.voice=!audioSettings.voice;if(!audioSettings.voice)stopVoice(true);saveAudioSettings();paintAudioSettings()});
$("musicToggle").addEventListener("click",()=>{audioSettings.music=!audioSettings.music;if(audioSettings.music)musicStart();else musicStop();saveAudioSettings();paintAudioSettings()});
$("clearWrite").addEventListener("click",()=>{canvasStrokes=[];stroke=null;paintBoard();markActivity()});
$("undoWrite").addEventListener("click",()=>{if(stroke)stroke=null;else canvasStrokes.pop();paintBoard();markActivity()});
const board=$("board");
$("play").addEventListener("pointerdown",markActivity);$("play").addEventListener("keydown",markActivity);
function point(e){const r=board.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
board.addEventListener("pointerdown",e=>{e.preventDefault();board.setPointerCapture?.(e.pointerId);stroke=[point(e)];paintBoard()});
board.addEventListener("pointermove",e=>{if(!stroke)return;e.preventDefault();markActivity();stroke.push(point(e));paintBoard()});
function endStroke(){if(!stroke)return;const s=stroke;stroke=null;if(s.length===1)s.push({x:s[0].x+.1,y:s[0].y+.1});canvasStrokes.push(s);paintBoard()}
board.addEventListener("pointerup",endStroke);board.addEventListener("pointercancel",endStroke);
window.addEventListener("pagehide",()=>{if(game||activeModule)stopTimer()});
paintAudioSettings();
if(!D.schedule[chosen]){const days=Object.keys(D.schedule).sort();chosen=days.find(d=>d>=chosen)||days[days.length-1]}
render();
if(window.location.hash==="#additions")startGame("carry-bonus","Additions avec retenue","carry",1);
if(window.location.hash==="#dictee-eu")startGame("dictation-eu-direct","Contrôle de dictée — son eu","dictation-eu",2);
})();
