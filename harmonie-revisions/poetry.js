/* Atelier de poésie orale — aucune piste audio ni transcription sauvegardée. */
(() => {
 "use strict";
 const $ = id => document.getElementById(id);
 const STORE="harmonie-poesie-v1";
 const DEFAULT_TEXT="J’ai dessiné\nUn monstre affreux\nAvec des bosses\nAvec des creux\nDes racines\nDes antennes\nDes rustines\nDes mitaines\nUn œil vert\nSans paupière\net trois pieds\nSans souliers\nQuand il m’a regardé\nJ’ai voulu le gommer\nMais il s’est échappé.";
 const GROUPS=[[0,3],[4,7],[8,11],[12,14]];
 let model={title:"Le monstre",text:DEFAULT_TEXT,passed:[],completedAt:null,fullPassedAt:null,lastFullRecordDate:null};
 let lines=[],position=0,recognizer=null,listening=false,revealed=false,started=false,completedThisRound=false;
 let fullMode=true,fullHintCount=0,fullListening=false,fullTranscript="",fullUncovered=false;
 const frenchVoices=["audrey","amélie","amelie","marie","denise","julie","léa","lea","hortense","céline","celine","virginie","alice","claire","camille","chloé"];
 const ASR=window.SpeechRecognition||window.webkitSpeechRecognition;
 const normalize=s=>String(s||"").toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’‘]/g,"'").replace(/[^a-z0-9' -]/g," ").replace(/\s+/g," ").trim();
 function load(){
  try{
   const state=JSON.parse(localStorage.getItem(STORE)||"{}");
   if(typeof state.title==="string")model.title=state.title.slice(0,100);
   if(typeof state.text==="string"&&state.text.trim())model.text=state.text.slice(0,6000);
   if(Array.isArray(state.passed))model.passed=state.passed.filter(Number.isInteger).slice(0,120);
   if(typeof state.completedAt==="string")model.completedAt=state.completedAt;
   if(typeof state.fullPassedAt==="string")model.fullPassedAt=state.fullPassedAt;
   if(typeof state.lastFullRecordDate==="string")model.lastFullRecordDate=state.lastFullRecordDate;
  }catch{}
  lines=model.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,120);
  if(!model.text.trim())model.text=DEFAULT_TEXT;
 }
 function save(){try{localStorage.setItem(STORE,JSON.stringify(model))}catch{}}
 function status(message){$("poetryStatus").textContent=message}
 function teacherVoice(){
  const french=window.speechSynthesis?.getVoices?.().filter(v=>String(v.lang||"").toLowerCase().startsWith("fr"))||[];
  return frenchVoices.map(n=>french.find(v=>String(v.name).toLocaleLowerCase("fr").includes(n))).find(Boolean)||
    french.find(v=>/fr[-_]fr/i.test(v.lang))||french[0]||null;
 }
 function speak(text){
  if(!("speechSynthesis" in window)){status("La lecture vocale n’est pas disponible sur ce navigateur.");return}
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang="fr-FR";utterance.rate=.83;utterance.pitch=1.02;
  const voice=teacherVoice();if(voice)utterance.voice=voice;
  utterance.onerror=()=>status("La voix n’a pas démarré. Vérifie le son de l’iPad puis réessaie.");
  window.speechSynthesis.speak(utterance);
 }
 function stop(){
  if(recognizer){try{recognizer.onresult=null;recognizer.onerror=null;recognizer.onend=null;recognizer.abort()}catch{}recognizer=null}
  listening=false;
  if("speechSynthesis" in window)window.speechSynthesis.cancel();
  $("poetryMic").disabled=false;$("poetryMic").textContent="Je récite ce vers";
 }
 function ratio(a,b){
  const A=normalize(a).split(" ").filter(Boolean),B=normalize(b).split(" ").filter(Boolean);
  if(!A.length||!B.length)return 0;
  const distance=Array.from({length:A.length+1},()=>Array(B.length+1).fill(0));
  for(let i=0;i<=A.length;i++)distance[i][0]=i;
  for(let j=0;j<=B.length;j++)distance[0][j]=j;
  for(let i=1;i<=A.length;i++)for(let j=1;j<=B.length;j++){
   const cost=A[i-1]===B[j-1]?0:1;
   distance[i][j]=Math.min(distance[i-1][j]+1,distance[i][j-1]+1,distance[i-1][j-1]+cost);
  }
  return 1-distance[A.length][B.length]/Math.max(A.length,B.length);
 }
function renderFull(){
  if(!lines.length)return;
  $("poetrySetup").hidden=true;$("poetryExercise").hidden=false;
  $("poetryVerseMode").hidden=true;$("poetryFullMode").hidden=false;
  $("poetryTitle").textContent=model.title;
  $("poetryStep").textContent="Récitation intégrale · "+lines.length+" vers";
  $("poetryProgressBar").style.width=model.fullPassedAt?"100%":"0%";
  $("poetryProgressLabel").textContent=model.fullPassedAt?"Poésie entière validée":"Objectif : réciter les "+lines.length+" vers dans l’ordre";
  $("poetryFullText").textContent=fullUncovered?lines.join("\n"):"Le texte est caché. Récite toute la poésie sans regarder.";
  $("poetryFullText").classList.toggle("poetry-hidden",!fullUncovered);
  $("poetryFullReveal").textContent=fullUncovered?"Cacher le texte":"Afficher le texte";
  $("poetryFullMic").disabled=fullListening;
  $("poetryFullMic").textContent=fullListening?"Je t’écoute…":"Je récite toute la poésie";
  $("poetryFullMic").hidden=!ASR;
  $("poetryFullMicNote").textContent=ASR?
    "Le micro peut s’arrêter avant la fin sur iPad : une validation accompagnée reste disponible.":
    "L’écoute automatique n’est pas proposée sur ce navigateur. Un adulte peut écouter toute la récitation.";
  $("poetryFullTranscript").hidden=!fullTranscript;
  $("poetryFullTranscript").textContent=fullTranscript?"Transcription entendue : "+fullTranscript:"";
}
function resetFull({keepMode=false}={}){
  stop();fullListening=false;fullHintCount=0;fullTranscript="";fullUncovered=false;
  if(!keepMode)fullMode=true;
  status("Récite toute la poésie de mémoire. La maîtresse peut te donner un indice si tu bloques.");
  render();
}
function fullSuccess(manual=false){
  const localDay=new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Paris"});
  const firstToday=model.lastFullRecordDate!==localDay;
  model.fullPassedAt=new Date().toISOString();model.lastFullRecordDate=localDay;save();
  fullListening=false;fullUncovered=false;
  if(firstToday)window.dispatchEvent(new CustomEvent("harmonie:poetry-finished",{
    detail:{title:model.title,count:lines.length,stars:lines.length,full:true}
  }));
  status(manual?"Bravo Harmonie ! Tu as récité toute la poésie avec un adulte.":
    "Bravo Harmonie ! J’ai entendu la poésie entière. Une répétition devant un adulte reste conseillée.");
  renderFull();
}
function listenFull(){
  if(!ASR||!lines.length||fullListening)return;
  stop();fullListening=true;fullUncovered=false;fullTranscript="";renderFull();
  status("Je t’écoute, Harmonie. Commence au premier vers et va jusqu’à la fin.");
  const expected=lines.join(" "),atText=model.text;
  let recognition;
  try{
    recognition=new ASR();recognizer=recognition;
    recognition.lang="fr-FR";recognition.continuous=true;recognition.interimResults=true;
    recognition.maxAlternatives=1;
    recognition.onresult=e=>{
      if(model.text!==atText||!fullMode)return;
      const resultItems=Array.from(e.results||[]);
      fullTranscript=resultItems.filter(x=>x.isFinal).map(x=>x[0]?.transcript||"").join(" ").trim();
      const tentative=resultItems.map(x=>x[0]?.transcript||"").join(" ").trim();
      if(tentative)$("poetryFullTranscript").textContent="J’entends ta récitation…";
      // Ne valide pas avant la fin : le moteur peut fournir un passage partiel.
    };
    recognition.onerror=e=>{
      fullListening=false;
      status(e.error==="not-allowed"?"Le microphone n’est pas autorisé. Un adulte peut écouter Harmonie.":
        "Le microphone n’a pas pu suivre toute la récitation. Fais confirmer par un adulte.");
      renderFull();
    };
    recognition.onend=()=>{
      fullListening=false;recognizer=null;
      const score=ratio(expected,fullTranscript);
      if(score>=.82&&normalize(fullTranscript).split(" ").length>=Math.ceil(normalize(expected).split(" ").length*.8))fullSuccess(false);
      else{
        status("La reconnaissance n’a pas confirmé la poésie entière. Cela ne signifie pas qu’Harmonie s’est trompée : fais écouter la récitation à un adulte.");
        renderFull();
      }
    };
    recognition.start();
  }catch{fullListening=false;recognizer=null;status("Ce navigateur ne permet pas l’écoute de toute la poésie. Un adulte peut la valider.");renderFull()}
}
function showEditor(){
  $("poetrySetup").hidden=false;
  $("poetryExercise").hidden=true;
  $("poetryTitleInput").value=model.title;
  $("poetryTextInput").value=model.text;
  status(lines.length?"La poésie est enregistrée sur cet iPad.":"Copie ici le texte exact de la poésie de l’école pour préparer la récitation.");
 }
 function clearTranscript(){
  $("poetryTranscript").textContent="";
  $("poetryTranscript").hidden=true;
 }
 function render(){
  if(!lines.length){showEditor();return}
  $("poetrySetup").hidden=true;$("poetryExercise").hidden=false;
  if(fullMode){renderFull();return}
  $("poetryVerseMode").hidden=false;$("poetryFullMode").hidden=true;
  const i=Math.min(position,lines.length-1);position=i;
  $("poetryTitle").textContent=model.title;
  $("poetryStep").textContent="Vers "+(i+1)+" sur "+lines.length;
  $("poetryLine").textContent=revealed?lines[i]:"Écoute, puis récite le vers à haute voix.";
  $("poetryLine").classList.toggle("poetry-hidden",!revealed);
  $("poetryReveal").textContent=revealed?"Cacher le vers":"Voir le vers";
  $("poetryPrevious").disabled=i===0;
  $("poetryNext").disabled=i===lines.length-1;
  $("poetryProgressBar").style.width=((i+1)/lines.length*100)+"%";
  $("poetryProgressLabel").textContent=model.passed.filter(n=>n>=0&&n<lines.length).length+" / "+lines.length+" vers récités";
  $("poetryMic").textContent=listening?"J’écoute...":"Je récite ce vers";
  $("poetryMic").disabled=listening;
  $("poetryMicNote").textContent=ASR?
    "L’écoute automatique peut demander l’autorisation du microphone. Si elle se trompe, utilise la validation accompagnée.":
    "L’écoute automatique n’est pas proposée par ce navigateur. Un adulte peut écouter et valider le vers.";
  $("poetryMic").hidden=!ASR;
  $("poetryAdult").hidden=false;
  $("poetryHint").disabled=false;
  $("poetryListen").disabled=false;
 }
 function newLine(i){stop();position=Math.max(0,Math.min(i,lines.length-1));revealed=false;clearTranscript();status("Écoute la maîtresse ou récite le vers de mémoire.");render()}
 function success(manual=false){
  const wasComplete=model.passed.length===lines.length;
  model.passed=[...new Set([...model.passed,position])].sort((a,b)=>a-b);
  save();
  $("poetryLine").textContent=lines[position];$("poetryLine").classList.remove("poetry-hidden");revealed=true;
  $("poetryReveal").textContent="Cacher le vers";
  status(manual?"Bien récité ! Vérification faite avec un adulte.":"Très bien Harmonie ! Tu as retrouvé le vers.");
  if(model.passed.length===lines.length&&!wasComplete){
   model.completedAt=new Date().toISOString();save();
   window.dispatchEvent(new CustomEvent("harmonie:poetry-finished",{detail:{title:model.title,count:lines.length,stars:lines.length}}));
   status("Poésie terminée ! Tu as récité tous les vers. Bravo Harmonie !");
  }
  render();
 }
 function listenForVerse(){
  if(!ASR||!lines.length||listening)return;
  stop();listening=true;render();status("Je t’écoute. Récite le vers à ton rythme.");
  let recognition;
  try{
   recognition=new ASR();recognizer=recognition;
   recognition.lang="fr-FR";recognition.interimResults=false;recognition.continuous=false;recognition.maxAlternatives=2;
   const expected=lines[position],at=position;
   recognition.onresult=e=>{
    if(position!==at)return;
    const choices=Array.from(e.results?.[0]||[]).map(x=>x.transcript).filter(Boolean);
    const match=Math.max(0,...choices.map(t=>ratio(expected,t)));
    const heard=choices[0]||"";
    $("poetryTranscript").hidden=false;
    $("poetryTranscript").textContent=heard?"J’ai entendu : « "+heard+" »":"Je n’ai pas compris la récitation.";
    if(match>=.72){success(false)}
    else status("J’ai entendu quelque chose de différent. Cela peut venir du micro. Réécoute ou demande à un adulte de vérifier.");
   };
   recognition.onerror=e=>{
    const reason=e.error==="not-allowed"?"Le microphone n’est pas autorisé.":e.error==="no-speech"?"Je n’ai pas entendu ta voix.":"La reconnaissance vocale n’a pas fonctionné.";
    status(reason+" Tu peux réciter à un adulte, ou essayer de nouveau.");
    listening=false;render();
   };
   recognition.onend=()=>{listening=false;recognizer=null;render()};
   recognition.start();
  }catch{listening=false;recognizer=null;status("L’écoute automatique ne fonctionne pas sur cet iPad. Utilise la validation accompagnée.");render()}
 }
 $("poetrySave").addEventListener("click",()=>{
  const text=$("poetryTextInput").value.trim(),title=$("poetryTitleInput").value.trim()||"Le monstre";
  if(!text||text.split(/\r?\n/).filter(x=>x.trim()).length<2){
   status("Ajoute au moins deux vers du texte exact de l’école.");return;
  }
  const changed=text!==model.text||title!==model.title;
  model.text=text.slice(0,6000);model.title=title.slice(0,100);
  if(changed){model.passed=[];model.completedAt=null;model.fullPassedAt=null;model.lastFullRecordDate=null;completedThisRound=false}
  save();lines=model.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,120);
  position=0;revealed=false;started=true;fullMode=true;clearTranscript();
  resetFull();
 });
 $("poetryEdit").addEventListener("click",()=>{stop();showEditor()});
 $("poetryWhole").addEventListener("click",()=>resetFull());
 $("poetryStudyVerse").addEventListener("click",()=>{stop();fullMode=false;position=0;revealed=false;clearTranscript();status("On retravaille chaque vers, puis on récite tout d’un seul coup.");render()});
 $("poetryFullBack").addEventListener("click",()=>resetFull());
 $("poetryFullListen").addEventListener("click",()=>{stop();status("Écoute bien le texte entier, puis récite-le toi-même.");speak(lines.join("… "))});
 $("poetryFullMic").addEventListener("click",listenFull);
 $("poetryFullReveal").addEventListener("click",()=>{fullUncovered=!fullUncovered;renderFull()});
 $("poetryFullHint").addEventListener("click",()=>{
  const part=GROUPS[fullHintCount%GROUPS.length]||GROUPS[0];
  const prompt=lines[part[0]];
  fullHintCount++;
  status("Petit indice, passage "+((fullHintCount-1)%GROUPS.length+1)+" : « "+prompt+"… ». Retrouve la suite à voix haute.");
  speak(prompt);
 });
 $("poetryFullAdult").addEventListener("click",()=>{if(lines.length){stop();fullSuccess(true)}});
 $("poetryFullRestart").addEventListener("click",()=>resetFull());
 
 $("poetryListen").addEventListener("click",()=>{if(!lines.length)return;stop();status("Écoute bien le vers, puis essaie de le redire.");speak(lines[position])});
 $("poetryHint").addEventListener("click",()=>{
  if(!lines.length)return;
  const words=lines[position].split(/\s+/);
  status("Indice : « "+words.slice(0,Math.min(2,words.length)).join(" ")+"… ». À toi de retrouver la suite.");
 });
 $("poetryReveal").addEventListener("click",()=>{revealed=!revealed;render()});
 $("poetryMic").addEventListener("click",listenForVerse);
 $("poetryAdult").addEventListener("click",()=>{if(lines.length)success(true)});
 $("poetryPrevious").addEventListener("click",()=>newLine(position-1));
 $("poetryNext").addEventListener("click",()=>newLine(position+1));
 $("poetryRestart").addEventListener("click",()=>{model.passed=[];model.completedAt=null;completedThisRound=false;save();newLine(0)});
 load();render();
 window.HarmoniePoetry={open:()=>{started=true;fullMode=true;render()},stop,get isListening(){return listening||fullListening}};
})();
