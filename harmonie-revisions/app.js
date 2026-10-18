(() => {
"use strict";
const D=window.HARMONIE_DATA;
const $=id=>document.getElementById(id);
const KEY="harmonie-revisions-toussaint-2026-v1";
const MAX=D.maxMinutes*60;
let progress=readProgress(),chosen=currentDay(),game=null,ticker=null,lastTick=0;
let voice=false,canvasStrokes=[],stroke=null,ctx=null,canvasWidth=1,canvasHeight=1;
function readProgress(){try {const x=JSON.parse(localStorage.getItem(KEY)||"{}");return {spent:x.spent||{},done:x.done||{},results:x.results||[]}}catch{return {spent:{},done:{},results:[]}}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(progress))}catch{}}
function currentDay(){const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day}
const frDay=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
function available(){return chosen===currentDay()&&D.guardDays.includes(chosen)}
function seconds(){return Math.min(MAX,progress.spent[currentDay()]||0)}
function addSeconds(s){if(!available()||s<=0)return;progress.spent[chosen]=Math.min(MAX,(progress.spent[chosen]||0)+s);save();paintClock();if(seconds()>=MAX&&game)stopForDay()}
function startTimer(){stopTimer();lastTick=Date.now();ticker=setInterval(()=>{if(document.hidden)return;if(!available()){endGame();return}const now=Date.now(),delta=Math.min(2,Math.max(0,Math.floor((now-lastTick)/1000)));if(delta){lastTick=now;addSeconds(delta)}},1000)}
function stopTimer(){if(ticker){clearInterval(ticker);ticker=null}const previous=lastTick;lastTick=0;if(previous&&game&&!document.hidden){const delta=Math.min(2,Math.max(0,Math.floor((Date.now()-previous)/1000)));if(delta)addSeconds(delta)}}
document.addEventListener("visibilitychange",()=>{if(document.hidden){stopTimer()}else if(game){startTimer()}});
function paintClock(){$("clock").textContent=Math.ceil(seconds()/60)+" / 30 min";$("clock").style.color=seconds()>=MAX?"#a52d45":""}
function complete(m){if(!(progress.done[chosen]||[]).includes(m)){(progress.done[chosen]||=([])).push(m)}save()}
function isDone(m){return (progress.done[chosen]||[]).includes(m)}
function show(el,yes){$(el).hidden=!yes}
function renderDays(){
 const host=$("days");host.replaceChildren();
 D.guardDays.forEach(d=>{const b=document.createElement("button");b.className="day"+(d===chosen?" active":"")+(d===currentDay()?" today":"");b.type="button";const [day,month]=d.slice(8).split("-");b.innerHTML="<strong>"+frDay(d)+"</strong><span>"+((progress.done[d]||[]).length)+"/3 jeux</span>";b.addEventListener("click",()=>{if(game)endGame();chosen=d;render()});host.appendChild(b)})
}
function render(){
 paintClock();renderDays();
 $("dayDisplay").textContent=frDay(chosen).replace(/^./,c=>c.toUpperCase());
 const isToday=chosen===currentDay();
 $("dayStatus").textContent=!isToday?"Programme à consulter — pas de jeu hors de la date prévue":available()?seconds()>=MAX?"30 minutes atteintes : place au repos !":"C’est ton jour avec papa !":"Pas de mission aujourd’hui : profite de ta journée !";
 const host=$("missions");host.replaceChildren();const list=D.schedule[chosen]||[];
 $("doneLabel").textContent=(progress.done[chosen]||[]).length+" / "+list.length+" réussies";
 list.forEach(([title,type,level],i)=>{const c=document.createElement("article");c.className="mission"+(isDone(i)?" done":"");
 const b=document.createElement("button");b.textContent=isDone(i)?"Rejouer ✓":"Jouer ➜";b.disabled=!available()||seconds()>=MAX;
 const tag=document.createElement("span");tag.className="number";tag.textContent="Mission "+(i+1);
 const h=document.createElement("h3");h.textContent=title;
 const p=document.createElement("p");p.textContent=type.startsWith("write")?"Observe 3 secondes et écris avec ton doigt.":type.startsWith("spell")?"Écoute, puis retrouve l'orthographe exacte.":"5 à 10 minutes de jeu tranquille.";
 c.append(tag,h,p,b);b.addEventListener("click",()=>startGame(i,title,type,level));host.append(c)});
 if(!list.length){host.textContent="Aucune mission prévue ce jour."}
}
function shuffled(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
const clean=s=>String(s).normalize("NFC").trim().toLocaleLowerCase("fr").replace(/[’‘]/g,"'").replace(/\s+/g," ");
function item(prompt,answer,options,hint,label="Choisis la bonne réponse"){return {mode:"choice",prompt,answer:String(answer),options:shuffled([...new Set(options.map(String))]),hint,label}}
function speak(text,forced=false){if((!voice&&!forced)||!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="fr-FR";u.pitch=1.25;u.rate=.86;speechSynthesis.speak(u)}
function generate(type,level){
 if(type==="read-u"||type==="read-ou"){
 const sound=type.endsWith("ou")?"ou":"u";
 const targets=sound==="ou"?["un loup","la soupe","une souris","la route","bonjour","une couleur"]:["la rue","du sucre","un nuage","une plume","la musique","la nature"];
 const others=sound==="ou"?["la rue","une plume","du sucre","la nature","un nuage"]:["un loup","une souris","la soupe","bonjour","la route"];
 return targets.map((correct,i)=>item("Quel mot s’écrit avec « "+sound+" » ?",correct,[correct,others[i%others.length],others[(i+1)%others.length]],"Écoute et regarde les lettres du mot.","Lecture"));
 }
 if(type==="spell-u"||type==="spell-ou"){
 const kind=type.endsWith("ou")?"ou":"u";
 const words=[...new Set(Array.from({length:level},(_,i)=>D.words[kind][i+1]||[]).flat())];
 return shuffled(words).slice(0,Math.min(6,words.length)).map(w=>({mode:"spell",prompt:"Écoute le mot puis écris-le.",answer:w,label:"Dictée — son "+kind,hint:"Tu peux réécouter autant de fois que tu veux."}));
 }
 if(type==="write-u"||type==="write-ou"){
 const kind=type.endsWith("ou")?"ou":"u";
 const words=level===2?[...D.words[kind][1],...D.words[kind][2]]:D.words[kind][1];
 return shuffled(words).slice(0,4).map(w=>({mode:"write",prompt:"Écris le mot sur l’ardoise.",answer:w,label:"Écriture cursive",hint:"Regarde le modèle 3 secondes, puis écris sans le voir."}));
 }
 if(type==="tens"){
 const nums=level===1?[56,42,73,19,80,67]:[64,37,95,28,71,49];
 return nums.map(n=>item(n+" : combien de dizaines ?",Math.floor(n/10),[Math.floor(n/10),n%10,Math.floor(n/10)+1],"Le chiffre de gauche donne les dizaines. Le chiffre de droite donne les unités.","Dizaines et unités"))
 .flatMap((q,i)=>i%2===0?[q,item(nums[i]+" : combien d’unités ?",nums[i]%10,[nums[i]%10,Math.floor(nums[i]/10),9],"Les unités sont à droite.","Dizaines et unités")]:[q]).slice(0,8);
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
 game={id,title,questions,pos:0,mistakes:0,correct:0,wrongOnCurrent:false,solved:false,writeTimer:null};
 $("gameName").textContent=title;show("home",false);show("finish",false);show("play",true);
 renderQuestion();startTimer();
}
function renderQuestion(){
 if(!game)return;const q=game.questions[game.pos];
 game.solved=false;game.wrongOnCurrent=false;$("promptType").textContent=q.label;
 $("question").textContent=q.prompt;$("hint").textContent=q.hint;$("feedback").textContent="";
 $("bar").style.width=(game.pos/game.questions.length*100)+"%";$("count").textContent=(game.pos+1)+" / "+game.questions.length;
 show("nextBtn",false);show("typing",q.mode==="spell");show("handwrite",q.mode==="write");
 $("choices").replaceChildren();
 if(q.mode==="choice"){
 q.options.forEach(option=>{const b=document.createElement("button");b.textContent=option;
 b.addEventListener("click",()=>choose(b,option,q));$("choices").appendChild(b)});
 }else if(q.mode==="spell"){
 $("spellInput").value="";$("spellInput").disabled=false;$("spellCheck").disabled=false;
 $("hearBtn").textContent="🔊 Réécouter";$("question").textContent="Écoute le mot, puis écris-le.";
 speak(q.answer,true);
 }else if(q.mode==="write"){
 $("memory").textContent="Regarde bien le mot…";$("memory").classList.remove("hide");
 show("boardBox",false);show("showWrite",true);show("clearWrite",false);show("verifyWrite",false);
 canvasStrokes=[];paintBoard();
 }
}
function succeed(text){if(!game||game.solved)return;game.solved=true;game.correct++;$("feedback").textContent=text||"Bravo Harmonie, tu as trouvé !";show("nextBtn",true);speak("Bravo Harmonie !")}
function choose(button,selected,q){
 if(!game||game.solved)return;
 if(clean(selected)===clean(q.answer)){
 button.classList.add("correct");[...$("choices").children].forEach(b=>b.disabled=true);
 succeed("Bravo ! "+q.answer+".");
 }else{
 button.classList.add("wrong");button.disabled=true;game.mistakes++;game.wrongOnCurrent=true;
 $("feedback").textContent="Pas tout à fait. "+q.hint+" Essaie une autre réponse.";
 }
}
function spellCheck(){
 if(!game||game.solved)return;const q=game.questions[game.pos],response=$("spellInput").value;
 if(!response.trim()){$("feedback").textContent="Écris quelque chose, puis vérifie.";return}
 if(clean(response)===clean(q.answer)){
 $("spellInput").disabled=true;$("spellCheck").disabled=true;succeed("Bravo ! Le mot est bien écrit : « "+q.answer+" ».");
 }else{
 game.mistakes++;game.wrongOnCurrent=true;
 $("feedback").textContent="On peut réessayer. Indice : le mot commence par « "+q.answer[0].toLocaleUpperCase("fr")+" ». Clique sur Réécouter.";
 }
}
function paintBoard(){
 const c=$("board");if(!ctx||!c.width)return;
 ctx.clearRect(0,0,canvasWidth,canvasHeight);ctx.lineWidth=5;ctx.strokeStyle="#4d4178";ctx.lineJoin="round";ctx.lineCap="round";
 for(const pts of canvasStrokes){if(!pts.length)continue;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke()}
 if(stroke?.length){ctx.beginPath();ctx.moveTo(stroke[0].x,stroke[0].y);for(const p of stroke.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke()}
}
function initCanvas(){
 const c=$("board"),rect=c.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvasWidth=Math.max(rect.width,100);canvasHeight=Math.max(rect.height,100);
 c.width=Math.round(canvasWidth*dpr);c.height=Math.round(canvasHeight*dpr);ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);paintBoard();
}
function showWrite(){
 if(!game)return;const q=game.questions[game.pos];
 $("memory").textContent=q.answer;$("memory").classList.remove("hide");
 show("showWrite",false);show("boardBox",false);
 game.writeTimer=setTimeout(()=>{
 if(!game)return;$("memory").textContent="Écris de mémoire…";
 show("boardBox",true);show("clearWrite",true);show("verifyWrite",true);
 requestAnimationFrame(initCanvas);game.writeTimer=null;
 },3000);
}
function compareWrite(){
 if(!game||!canvasStrokes.length){$("feedback").textContent="Essaie d’écrire au moins une lettre avant de comparer.";return}
 const q=game.questions[game.pos];$("memory").textContent=q.answer;$("feedback").textContent="Compare ton écriture avec « "+q.answer+" ». On vérifie ensemble, sans reconnaissance automatique.";
 show("clearWrite",false);show("verifyWrite",false);succeed("Regarde si toutes les lettres sont présentes. Tu peux continuer ou refaire le mot plus tard.");
}
function next(){
 if(!game||!game.solved)return;
 progress.results.push({date:chosen,mission:game.title,answer:game.questions[game.pos].answer,errors:Number(game.wrongOnCurrent),type:game.questions[game.pos].mode});
 save();game.pos++;
 if(game.pos<game.questions.length){renderQuestion();return}
 const done=game;complete(done.id);endGame();
 $("finishText").textContent="Tu as terminé "+done.questions.length+" défis avec "+done.correct+" réponses validées. Les erreurs sont normales : chaque essai compte !";
 show("home",false);show("finish",true);
}
function endGame(){
 if(!game){show("play",false);show("home",true);return}
 const t=game.writeTimer;game.writeTimer=null;if(t)clearTimeout(t);
 stopTimer();game=null;show("play",false);show("home",true);render();
}
function stopForDay(){
 // Atteinte de la limite : pas de nouveau jeu ni de question suivante.
 const t=game?.writeTimer;if(t)clearTimeout(t);
 game=null;stopTimer();show("play",false);show("finish",false);show("home",true);render();
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
$("voiceBtn").addEventListener("click",()=>{voice=!voice;$("voiceBtn").setAttribute("aria-pressed",String(voice));$("voiceBtn").textContent=voice?"🔊":"🗣️";if(voice)speak("Coucou Harmonie !")});
$("parentBtn").addEventListener("click",parent);$("closeParent").addEventListener("click",closeParent);$("closeParentBottom").addEventListener("click",closeParent);
$("exportCsv").addEventListener("click",exportCSV);
$("resetDay").addEventListener("click",()=>{if(confirm("Recommencer les missions ? Le temps déjà passé ne sera pas effacé.")){delete progress.done[chosen];save();closeParent();parent();render()}});
$("backBtn").addEventListener("click",endGame);$("finishHome").addEventListener("click",()=>{show("finish",false);show("home",true);render()});
$("nextBtn").addEventListener("click",next);$("spellCheck").addEventListener("click",spellCheck);
$("spellInput").addEventListener("keydown",e=>{if(e.key==="Enter")spellCheck()});
$("hearBtn").addEventListener("click",()=>{if(game)speak(game.questions[game.pos].answer,true)});
$("showWrite").addEventListener("click",showWrite);$("verifyWrite").addEventListener("click",compareWrite);
$("clearWrite").addEventListener("click",()=>{canvasStrokes=[];stroke=null;paintBoard()});
const board=$("board");
function point(e){const r=board.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
board.addEventListener("pointerdown",e=>{e.preventDefault();board.setPointerCapture?.(e.pointerId);stroke=[point(e)];paintBoard()});
board.addEventListener("pointermove",e=>{if(!stroke)return;e.preventDefault();stroke.push(point(e));paintBoard()});
function endStroke(){if(!stroke)return;const s=stroke;stroke=null;if(s.length===1)s.push({x:s[0].x+.1,y:s[0].y+.1});canvasStrokes.push(s);paintBoard()}
board.addEventListener("pointerup",endStroke);board.addEventListener("pointercancel",endStroke);
window.addEventListener("pagehide",()=>{if(game)stopTimer()});
if(!D.schedule[chosen])chosen=D.guardDays.find(d=>d>=chosen)||D.guardDays[D.guardDays.length-1];
render();
})();
