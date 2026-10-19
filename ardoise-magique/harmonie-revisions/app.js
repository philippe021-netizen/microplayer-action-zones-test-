(() => {
"use strict";
const D=window.HARMONIE_DATA;
const $=id=>document.getElementById(id);
const KEY="harmonie-revisions-toussaint-2026-v1";
const MAX=D.maxMinutes*60;
let progress=readProgress(),chosen=currentDay(),game=null,ticker=null,lastTick=0,lastActivity=0,idleTimer=null,lastEncouragement=-1;
let canvasStrokes=[],stroke=null,ctx=null,canvasWidth=1,canvasHeight=1;
const AUDIO_KEY="harmonie-audio-v1";
let audioSettings=readAudioSettings(),recognitionLoad=null,voicePlayer=null,backgroundPlayer=$("gus-music-player");
if(backgroundPlayer){backgroundPlayer.src="./audio/harmonie-background.mp3";backgroundPlayer.loop=true;backgroundPlayer.volume=.16}
function readAudioSettings(){try{const s=JSON.parse(localStorage.getItem(AUDIO_KEY)||"{}");return {voice:s.voice!==false,music:s.music!==false}}catch{return {voice:true,music:true}}}
function saveAudioSettings(){try{localStorage.setItem(AUDIO_KEY,JSON.stringify(audioSettings))}catch{}}
function paintAudioSettings(){for(const [id,key,on,off] of [["voiceToggle","voice","🗣️ Voix","🤐 Voix coupée"],["musicToggle","music","🎵 Musique","🔇 Musique coupée"]]){const b=$(id),active=audioSettings[key];b.textContent=active?on:off;b.setAttribute("aria-pressed",String(active))}}
function musicVolume(level=.16){if(!backgroundPlayer)return;const withGus=window.GusMedia?.hasOriginalSound()?Math.min(level,.035):level,withVoice=voicePlayer&&!voicePlayer.paused?Math.min(withGus,.06):withGus;backgroundPlayer.volume=withVoice}
window.HarmonieMusicVolume=level=>voicePlayer&&!voicePlayer.paused?Math.min(level,.06):level;
function musicStop(){backgroundPlayer?.pause()}
function musicStart(){if(!audioSettings.music||!game||!backgroundPlayer)return;musicVolume();if(backgroundPlayer.paused){const p=backgroundPlayer.play();p?.then?.(musicVolume).catch?.(()=>{})}}
function stopVoice(continueSequence=false){if(voicePlayer){const audio=voicePlayer,next=audio.onended;audio.onended=null;audio.onerror=null;audio.pause();voicePlayer=null;musicVolume();if(continueSequence)next?.()}}
function playVoice(file,onend){if(!audioSettings.voice){onend?.();return}stopVoice();const audio=new Audio("./audio/"+file+".mp3");voicePlayer=audio;let finished=false;const done=()=>{if(finished)return;finished=true;if(voicePlayer===audio){voicePlayer=null;musicStart();musicVolume()}onend?.()};audio.onended=done;audio.onerror=done;const p=audio.play();musicVolume();p?.catch?.(done)}
function say(){/* Les voix système du navigateur sont désactivées : Lili utilise uniquement les enregistrements du projet. */}
const encouragements=["Alors, tu dors ou quoi ? Réveille les neurones !","Ton crayon fait la sieste ? On s’y remet !","Ouh là, ça réfléchit fort ! Tu vas trouver !","Ce mot se cache bien : démasque-le !","Allez, championne, encore une lettre !"];
function encourage(){if(!game||game.solved||document.hidden||!audioSettings.voice||voicePlayer&&!voicePlayer.paused)return;let i=Math.floor(Math.random()*encouragements.length);if(encouragements.length>1&&i===lastEncouragement)i=(i+1+Math.floor(Math.random()*(encouragements.length-1)))%encouragements.length;lastEncouragement=i;playVoice("lili-encourage-"+(i+1))}
function markActivity(){if(!game)return;lastActivity=Date.now()}
function startIdleWatch(){clearInterval(idleTimer);lastActivity=Date.now();idleTimer=setInterval(()=>{if(game&&!document.hidden&&!game.solved&&Date.now()-lastActivity>=30000){if(!voicePlayer||voicePlayer.paused){encourage();lastActivity=Date.now()}}},1000)}
function stopIdleWatch(){clearInterval(idleTimer);idleTimer=null;lastActivity=0}
function readProgress(){try {const x=JSON.parse(localStorage.getItem(KEY)||"{}");return {spent:x.spent||{},done:x.done||{},results:x.results||[]}}catch{return {spent:{},done:{},results:[]}}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(progress))}catch{}}
function currentDay(){const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day}
const frDay=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
function available(){return chosen<=currentDay()&&Boolean(D.schedule[chosen])}
function seconds(){return Math.min(MAX,progress.spent[currentDay()]||0)}
function addSeconds(s){if(!available()||s<=0)return;const day=currentDay();progress.spent[day]=Math.min(MAX,(progress.spent[day]||0)+s);save();paintClock();if(seconds()>=MAX&&game)stopForDay()}
function startTimer(){stopTimer();lastTick=Date.now();ticker=setInterval(()=>{if(document.hidden)return;if(!available()){endGame();return}const now=Date.now(),delta=Math.min(2,Math.max(0,Math.floor((now-lastTick)/1000)));if(delta){lastTick=now;addSeconds(delta)}},1000)}
function stopTimer(){if(ticker){clearInterval(ticker);ticker=null}const previous=lastTick;lastTick=0;if(previous&&game&&!document.hidden){const delta=Math.min(2,Math.max(0,Math.floor((Date.now()-previous)/1000)));if(delta)addSeconds(delta)}}
document.addEventListener("visibilitychange",()=>{if(document.hidden){stopTimer()}else if(game){startTimer();markActivity()}});
function paintClock(){$("clock").textContent=Math.ceil(seconds()/60)+" / 30 min";$("clock").style.color=seconds()>=MAX?"#a52d45":""}
function complete(m){if(!(progress.done[chosen]||[]).includes(m)){(progress.done[chosen]||=([])).push(m)}save()}
function isDone(m){return (progress.done[chosen]||[]).includes(m)}
function show(el,yes){$(el).hidden=!yes}
function renderDays(){
 const host=$("days");host.replaceChildren();
 Object.keys(D.schedule).sort().forEach(d=>{const b=document.createElement("button");b.className="day"+(d===chosen?" active":"")+(d===currentDay()?" today":"");b.type="button";b.innerHTML="<strong>"+frDay(d)+"</strong><span>"+((progress.done[d]||[]).length)+"/3 jeux</span>";b.addEventListener("click",()=>{if(game)endGame();chosen=d;render()});host.appendChild(b)})
}
function render(){
 paintClock();renderDays();
 $("dayDisplay").textContent=frDay(chosen).replace(/^./,c=>c.toUpperCase());
 const isToday=chosen===currentDay(),isFuture=chosen>currentDay();
 $("dayStatus").textContent=isFuture?"Ces devoirs seront disponibles le jour prévu.":available()?seconds()>=MAX?"30 minutes d’activité atteintes aujourd’hui : place au repos !":isToday?"Tes missions du jour sont prêtes !":"Tu peux reprendre les missions de cette journée.":"Aucune mission n’est prévue ce jour.";
 const host=$("missions");host.replaceChildren();const list=D.schedule[chosen]||[];
 $("doneLabel").textContent=(progress.done[chosen]||[]).length+" / "+list.length+" réussies";
 list.forEach(([title,type,level],i)=>{const c=document.createElement("article");c.className="mission"+(isDone(i)?" done":"");
 const b=document.createElement("button");b.textContent=isDone(i)?"Rejouer ✓":"Jouer ➜";b.disabled=!available()||seconds()>=MAX;
 const tag=document.createElement("span");tag.className="number";tag.textContent="Mission "+(i+1);
 const h=document.createElement("h3");h.textContent=title;
 const p=document.createElement("p");p.textContent=(type.startsWith("write")||type.startsWith("spell"))?"Observe le mot pendant 3 secondes, puis écris-le avec ton doigt sur l’ardoise.":"5 à 10 minutes de jeu tranquille.";
 c.append(tag,h,p,b);b.addEventListener("click",()=>startGame(i,title,type,level));host.append(c)});
 if(!list.length){host.textContent="Aucune mission prévue ce jour."}
}
function shuffled(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
const clean=s=>String(s).normalize("NFC").trim().toLocaleLowerCase("fr").replace(/[’‘]/g,"'").replace(/\s+/g," ");
function cumulativeWords(graph,level){return [...new Set(Array.from({length:level},(_,i)=>D.words[graph]?.[i+1]||[]).flat())]}
function alphabetKey(word){return clean(word).replace(/^(?:un|une|le|la|les|des|du)\s+/,"").replace(/^l'/,"")}
function item(prompt,answer,options,hint,label="Choisis la bonne réponse"){return {mode:"choice",prompt,answer:String(answer),options:shuffled([...new Set(options.map(String))]),hint,label}}
function generate(type,level){
 if(type.startsWith("read-")){
 const graph=type.slice(5),words=cumulativeWords(graph,level),targets=words.slice(0,6);
 const targetKeys=new Set(words.map(clean));
 const others=[...new Set(Object.values(D.words).flatMap(m=>Object.values(m).flat()))].filter(w=>!targetKeys.has(clean(w)));
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
 const nums=level===1?[56,42,73,19,80,67]:[64,37,95,28,71,49];
 return nums.map(n=>item(n+" : combien de dizaines ?",Math.floor(n/10),[Math.floor(n/10),n%10,Math.floor(n/10)+1,Math.max(0,Math.floor(n/10)-1)],"Le chiffre de gauche donne les dizaines. Le chiffre de droite donne les unités.","Dizaines et unités"))
 .flatMap((q,i)=>i%2===0?[q,item(nums[i]+" : combien d’unités ?",nums[i]%10,[nums[i]%10,Math.floor(nums[i]/10),9,Math.max(0,nums[i]%10-1)],"Les unités sont à droite.","Dizaines et unités")]:[q]).slice(0,8);
 }
 if(type==="friends"){
 return [7,4,6,9,3,5,8,2].slice(level===2?2:0,level===2?8:6).map(a=>item(a+" + ? = 10",10-a,[10-a,Math.max(0,9-a),Math.min(9,11-a)],"Compte les cases qui manquent jusqu’à 10.","Les amis de 10"));
 }
 if(type==="subtract"){
 const pairs=level===1?[[35,7],[43,6],[52,8],[61,4],[74,9],[32,5]]:level===2?[[46,8],[64,7],[83,6],[51,9],[72,5],[55,8]]:[[35,7],[62,8],[74,6],[91,7],[43,9],[80,5]];
 return pairs.map(([a,b])=>{const toTen=a%10||10,first=Math.min(b,toTen);const rest=b-first,answer=a-b;return item(a+" − "+b+" = ?",answer,[answer,answer+10,answer-2,answer+2],a+" − "+first+" = "+(a-first)+(rest?", puis − "+rest+" = "+answer:"")+".","Soustraction en passant par la dizaine")});
 }
 if(type==="add"){
 const pairs=level===1?[[25,42],[31,47],[42,26],[16,31],[20,35],[44,23]]:level===2?[[26,47],[35,28],[48,16],[57,25],[38,26],[17,45]]:[[25,42],[53,29],[36,47],[44,38],[19,63],[56,27]];
 return pairs.map(([a,b])=>{const n=a+b;return item(a+" + "+b+" = ?",n,[n,n-10,n+10,n-2],Math.floor(a/10)*10+" + "+Math.floor(b/10)*10+" = "+(Math.floor(a/10)+Math.floor(b/10))*10+" ; "+(a%10)+" + "+(b%10)+" = "+((a%10)+(b%10))+". Réunis les deux résultats.","Additions et retenues")});
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
function startGame(id,title,type,level){
 if(!available()||seconds()>=MAX)return;
 const questions=generate(type,level);
 if(!questions.length)return;
 game={id,title,type,questions,pos:0,mistakes:0,correct:0,wrongOnCurrent:false,solved:false,writeTimer:null};
 $("gameName").textContent=title;show("home",false);show("finish",false);show("play",true);
 startTimer();musicStart();window.GusMedia?.play("05_Presentation");
 if(type.startsWith("spell-")||type.startsWith("write-")){
  $("question").textContent="Lili t’explique le jeu…";$("promptType").textContent=title;$("hint").textContent="Écoute bien, puis écris les mots sur l’ardoise.";
  const sequence=["lili-intro",...(type==="spell-u"?[level===1?"lili-u-marche1":"lili-u-words"]:[])];
  const speakNext=i=>{if(!game)return;if(i>=sequence.length){renderQuestion();startIdleWatch();return}playVoice(sequence[i],()=>speakNext(i+1))};speakNext(0);
 }else{renderQuestion();startIdleWatch()}
}
function renderQuestion(){
 if(!game)return;const q=game.questions[game.pos];
 clearTimeout(game.writeTimer);clearTimeout(game.writeFallback);game.writeTimer=null;game.writeFallback=null;
 game.solved=false;game.wrongOnCurrent=false;$("promptType").textContent=q.label;
 $("question").textContent=q.prompt;$("hint").textContent=q.hint;$("feedback").textContent="";
 $("bar").style.width=(game.pos/game.questions.length*100)+"%";$("count").textContent=(game.pos+1)+" / "+game.questions.length;
 show("nextBtn",false);show("handwrite",q.mode==="write");
 $("choices").replaceChildren();
 if(q.mode==="choice"){
 q.options.forEach(option=>{const b=document.createElement("button");b.textContent=option;
 b.addEventListener("click",()=>choose(b,option,q));$("choices").appendChild(b)});
 }else if(q.mode==="write"){
 $("memory").textContent="Regarde bien le mot…";$("memory").classList.remove("hide");
 show("boardBox",false);show("clearWrite",false);show("verifyWrite",false);
 canvasStrokes=[];paintBoard();showWrite();
 }
}
function succeed(text){if(!game||game.solved)return;game.solved=true;game.correct++;markActivity();$("feedback").textContent=text||"Bravo Harmonie, tu as trouvé !";show("nextBtn",true);window.GusMedia?.playCorrect();}
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
 let minimumElapsed=false;const revealBoard=()=>{if(!minimumElapsed||!game||game!==session||game.pos!==position)return;$("memory").textContent="Écris de mémoire…";$("memory").classList.add("hide");show("boardBox",true);show("clearWrite",true);show("verifyWrite",true);requestAnimationFrame(initCanvas);game.writeTimer=null};
 game.writeTimer=setTimeout(()=>{minimumElapsed=true;revealBoard()},3000);
}
function recognitionCanvas(){
 const pts=canvasStrokes.filter(s=>s.length>1).flat();if(!pts.length)return null;
 const minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
 const scale=Math.min(3,820/Math.max(1,maxX-minX),210/Math.max(1,maxY-minY)),pad=28,out=document.createElement("canvas");out.width=Math.max(180,Math.ceil((maxX-minX)*scale+pad*2));out.height=Math.max(100,Math.ceil((maxY-minY)*scale+pad*2));
 const c=out.getContext("2d");c.fillStyle="#fff";c.fillRect(0,0,out.width,out.height);c.strokeStyle="#29283c";c.lineWidth=Math.max(4,5*scale);c.lineCap="round";c.lineJoin="round";
 for(const s of canvasStrokes){if(s.length<2)continue;c.beginPath();c.moveTo(pad+(s[0].x-minX)*scale,pad+(s[0].y-minY)*scale);for(const p of s.slice(1))c.lineTo(pad+(p.x-minX)*scale,pad+(p.y-minY)*scale);c.stroke()}return out;
}
function loadRecognitionLibrary(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);if(recognitionLoad)return recognitionLoad;
 recognitionLoad=new Promise((resolve,reject)=>{const script=document.createElement("script");script.async=true;let fallback=false;script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error("Moteur de lecture indisponible"));script.onerror=()=>{if(fallback){reject(Error("Moteur de lecture indisponible"));return}fallback=true;script.src="https://unpkg.com/tesseract.js@6.0.1/dist/tesseract.min.js"};script.src="https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js";document.head.append(script)});return recognitionLoad;
}
function offerWriteRetry(message,{countMistake=false}={}){
 const choices=$("choices");choices.replaceChildren();$("feedback").textContent=message;
 const retry=document.createElement("button");retry.textContent="Réécrire le mot";retry.addEventListener("click",()=>{
  if(!game)return;
  if(countMistake){game.mistakes++;game.wrongOnCurrent=true;markActivity()}
  renderQuestion();
  if(countMistake)game.wrongOnCurrent=true;
  say(countMistake?"Regarde bien le modèle. Il y a une lettre à corriger, puis tu réessaies !":"Je n’arrive pas bien à lire ton écriture. Écris le mot un peu plus grand, puis réessaie !");
 });choices.append(retry);
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
 const q=game.questions[game.pos];$("memory").textContent=q.answer;$("memory").classList.remove("hide");show("clearWrite",false);show("verifyWrite",false);$("verifyWrite").disabled=true;$("feedback").textContent="Je regarde ton écriture…";
 try{
  const canvas=recognitionCanvas();if(!canvas)throw Error("Écriture trop courte");const engine=await loadRecognitionLibrary();const result=await engine.recognize(canvas,"fra");if(!game)return;
  const decision=handwritingDecision(q.answer,result.data?.text,result.data?.confidence);
  if(decision.status==="correct"){succeed("Bravo ! Le correcteur a reconnu « "+decision.read+" » : le mot est juste !");say("Bravo Harmonie ! Le correcteur a reconnu le bon mot. Continue comme ça !");return}
  if(decision.status==="incorrect")offerWriteRetry("Le correcteur a lu « "+decision.read+" ». Le mot attendu est « "+q.answer+" ». Regarde la différence et réessaie.",{countMistake:true});
  else offerWriteRetry("Le correcteur n’arrive pas à lire assez clairement ce mot. Écris-le un peu plus grand, puis réessaie.");
 }catch{if(!game)return;offerWriteRetry("Le correcteur automatique est momentanément indisponible. Réessaie dans un instant.")}
 finally{if($("verifyWrite"))$("verifyWrite").disabled=false}
}
function next(){
 if(!game||!game.solved)return;
 progress.results.push({date:chosen,mission:game.title,answer:game.questions[game.pos].answer,errors:Number(game.wrongOnCurrent),type:game.questions[game.pos].mode});
 save();game.pos++;
 if(game.pos<game.questions.length){renderQuestion();const q=game.questions[game.pos];if(q.mode==="choice")say(q.prompt+" "+q.hint);return}
 const done=game;complete(done.id);endGame();
 $("finishText").textContent="Tu as terminé "+done.questions.length+" défis avec "+done.correct+" réponses validées. Les erreurs sont normales : chaque essai compte !";
 show("home",false);show("finish",true);say("Bravo Harmonie ! Tu as terminé ta mission. Chaque essai t’a aidée à apprendre, je suis fière de toi !");
}
function endGame(){
 if(!game){show("play",false);show("home",true);return}
 const t=game.writeTimer,f=game.writeFallback;game.writeTimer=null;game.writeFallback=null;if(t)clearTimeout(t);if(f)clearTimeout(f);
 stopTimer();stopIdleWatch();game=null;stopVoice();musicStop();window.GusMedia?.stop();show("play",false);show("home",true);render();
}
function stopForDay(){
 // Atteinte de la limite : pas de nouveau jeu ni de question suivante.
 const t=game?.writeTimer,f=game?.writeFallback;if(t)clearTimeout(t);if(f)clearTimeout(f);
 game=null;stopTimer();stopIdleWatch();stopVoice();musicStop();window.GusMedia?.stop();show("play",false);show("finish",false);show("home",true);render();
 $("dayStatus").textContent="30 minutes terminées : bravo, profite maintenant de tes vacances !";
}
function exportCSV(){
 const lines=[["date","mission","type","reponse_attendue","erreur_au_premier_essai"],...progress.results.map(x=>[x.date,x.mission,x.type,x.answer,x.errors])];
 const csv="\uFEFF"+lines.map(r=>r.map(s=>'"'+String(s??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="harmonie-progres.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function parent(){
 const total=progress.results.length,wrong=progress.results.filter(x=>x.errors).length;
 const sessions=Object.keys(progress.spent).sort().map(k=>k+": "+Math.ceil(progress.spent[k]/60)+" min, "+(progress.done[k]||[]).length+" missions");
 $("parentStats").replaceChildren();
 [total+" réponses enregistrées",wrong+" réponses corrigées après un premier essai",...sessions].forEach(s=>{const p=document.createElement("p");p.textContent=s;$("parentStats").appendChild(p)});
 if(typeof $("parentDialog").showModal==="function")$("parentDialog").showModal();else $("parentDialog").setAttribute("open","");
}
function closeParent(){$("parentDialog").close?.();$("parentDialog").removeAttribute("open")}
$("parentBtn").addEventListener("click",parent);$("closeParent").addEventListener("click",closeParent);$("closeParentBottom").addEventListener("click",closeParent);
$("exportCsv").addEventListener("click",exportCSV);
$("resetDay").addEventListener("click",()=>{if(confirm("Recommencer les missions ? Le temps déjà passé ne sera pas effacé.")){delete progress.done[chosen];save();closeParent();parent();render()}});
$("backBtn").addEventListener("click",endGame);$("finishHome").addEventListener("click",()=>{show("finish",false);show("home",true);render()});
$("nextBtn").addEventListener("click",next);
$("verifyWrite").addEventListener("click",compareWrite);
$("gus-sound").addEventListener("click",()=>{const b=$("gus-sound"),on=b.getAttribute("aria-pressed")!=="true";b.setAttribute("aria-pressed",String(on));b.textContent=on?"🔔 Sons de Gus":"🔕 Sons coupés"});
$("voiceToggle").addEventListener("click",()=>{audioSettings.voice=!audioSettings.voice;if(!audioSettings.voice)stopVoice(true);saveAudioSettings();paintAudioSettings()});
$("musicToggle").addEventListener("click",()=>{audioSettings.music=!audioSettings.music;if(audioSettings.music)musicStart();else musicStop();saveAudioSettings();paintAudioSettings()});
$("clearWrite").addEventListener("click",()=>{canvasStrokes=[];stroke=null;paintBoard()});
const board=$("board");
$("play").addEventListener("pointerdown",markActivity);$("play").addEventListener("keydown",markActivity);
function point(e){const r=board.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
board.addEventListener("pointerdown",e=>{e.preventDefault();board.setPointerCapture?.(e.pointerId);stroke=[point(e)];paintBoard()});
board.addEventListener("pointermove",e=>{if(!stroke)return;e.preventDefault();markActivity();stroke.push(point(e));paintBoard()});
function endStroke(){if(!stroke)return;const s=stroke;stroke=null;if(s.length===1)s.push({x:s[0].x+.1,y:s[0].y+.1});canvasStrokes.push(s);paintBoard()}
board.addEventListener("pointerup",endStroke);board.addEventListener("pointercancel",endStroke);
window.addEventListener("pagehide",()=>{if(game)stopTimer()});
paintAudioSettings();
if(!D.schedule[chosen]){const days=Object.keys(D.schedule).sort();chosen=days.find(d=>d>=chosen)||days[days.length-1]}
render();
})();
