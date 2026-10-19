/* Gus's transparent animated WebP clips and original M4A soundtracks. */
(()=>{
"use strict";
if(!document.getElementById("gus-panel")) return;
const BASE=new URL("./",document.currentScript.src).href;
const CHOICES=[
 ["01_Prout","💨 Prout"],["02_Bravo","👏 Bravo"],["03_Danse","🕺 Danse"],
 ["04_Oups","🤔 Oups"],["05_Presentation","👉 Présentation"],["06_Rires","😂 Rires"],
 ["07_Surprise","😲 Surprise"],["08_Au_revoir","👋 Au revoir"],
 ["09_Presentation_bis","👉 Présentation 2"],["10_Bravo_bis","👏 Bravo 2"]
];
const SILENT_SOURCES=new Set(["05_Presentation","09_Presentation_bis"]);
const style=document.createElement("style");
style.textContent="#gus-video-tray{display:flex;gap:7px;overflow-x:auto;padding:8px 6px 12px;scrollbar-width:thin;max-width:100%;margin-bottom:12px}"+
"#gus-video-tray button{flex:none;white-space:nowrap;background:#fff;border:1px solid #dfc9f3;color:#5b4285;font:750 13px system-ui;border-radius:15px;padding:9px 12px;min-height:43px}"+
"#gus-video-tray button:focus-visible{outline:3px solid #875bdc}"+
"#gus-video-stage{position:fixed;z-index:60;left:max(5px,env(safe-area-inset-left));bottom:max(3px,env(safe-area-inset-bottom));pointer-events:none;width:clamp(105px,21vw,230px);height:clamp(170px,34vw,340px);overflow:hidden;opacity:0;transition:opacity .14s ease}"+
"#gus-video-stage.show{opacity:1}#gus-video-stage img{width:100%;height:100%;object-fit:contain;object-position:bottom left}"+
"#gus-video-stage.presenter{left:max(4px,env(safe-area-inset-left));right:auto;bottom:max(8px,env(safe-area-inset-bottom));width:clamp(160px,24vw,280px);height:clamp(235px,40vw,410px);z-index:61}"+
"@media(max-width:560px){#gus-video-stage{width:118px;height:182px}#gus-video-stage.presenter{width:clamp(140px,37vw,190px);height:clamp(210px,56vw,300px)}#gus-video-tray button{font-size:12px;padding:7px 9px}}"+
"@media(prefers-reduced-motion:reduce){#gus-video-stage{transition:none}}";
document.head.append(style);
const panel=document.getElementById("gus-panel");
const tray=document.createElement("div");tray.id="gus-video-tray";tray.setAttribute("aria-label","Tester les animations de Gus");
const stage=document.createElement("div");stage.id="gus-video-stage";stage.setAttribute("aria-hidden","true");
const picture=document.createElement("img");picture.alt="";picture.decoding="async";stage.append(picture);
const sound=document.createElement("audio");sound.preload="none";sound.setAttribute("playsinline","");document.body.append(sound);document.body.append(stage);
const bgMusic=document.getElementById("gus-music-player");
let counter=0,timer=0,active="";
function setBackgroundVolume(level){
 if(!bgMusic)return;
 const adjusted=typeof window.HarmonieMusicVolume==="function"?window.HarmonieMusicVolume(level):level;
 bgMusic.volume=Number.isFinite(adjusted)?adjusted:level;
}
function stop(){
 clearTimeout(timer);stage.classList.remove("show","presenter");sound.pause();active="";
 if(bgMusic&&bgMusic.volume<.12)setBackgroundVolume(.16);
}
function play(name,duration=5200){
 if(!CHOICES.some(x=>x[0]===name))return false;
 clearTimeout(timer);sound.pause();
 const nonce=++counter;active=name;
 if(!SILENT_SOURCES.has(name)){try{window.speechSynthesis?.cancel()}catch(_){}}
 const allowSound=document.getElementById("gus-sound")?.getAttribute("aria-pressed")!=="false";
 // Start audio synchronously in the activating event; Safari can reject a
 // delayed play() call made only after an image load callback.
 if(allowSound){
  sound.src=BASE+name+".m4a";sound.currentTime=0;
  const promise=sound.play();if(promise?.catch)promise.catch(()=>{
   const notice=document.getElementById("gus-notice");if(notice)notice.textContent="Le son de Gus est bloqué par Safari. Touche une animation pour réessayer.";
  });
 }
 if(bgMusic&&!bgMusic.paused)setBackgroundVolume(.035);
 picture.onload=()=>{if(nonce!==counter)return;stage.classList.add("show")};
 picture.onerror=()=>{if(nonce!==counter)return;stage.classList.remove("show")};
 stage.classList.remove("show");picture.src=BASE+name+".webp?cycle="+nonce;
 timer=setTimeout(stop,duration);
 return true;
}
function present(){stage.classList.add("presenter");return play("05_Presentation",60000)}
function playCorrect(){
 if(Math.random()<.12)return play("01_Prout");
 const options=["02_Bravo","03_Danse","06_Rires","10_Bravo_bis"];
 return play(options[Math.floor(Math.random()*options.length)]);
}
if(panel.dataset.controls!=="false"){
 for(const [id,label] of CHOICES){
  const b=document.createElement("button");b.type="button";b.textContent=label;
  b.addEventListener("click",()=>play(id));tray.append(b);
 }
 panel.insertAdjacentElement("afterend",tray);
}
window.GusMedia={enabled:true,play,playCorrect,present,stop,hasOriginalSound:()=>!!active&&!SILENT_SOURCES.has(active),get active(){return active}};
document.getElementById("gus-sound")?.addEventListener("click",()=>{
 if(document.getElementById("gus-sound")?.getAttribute("aria-pressed")==="false")sound.pause();
});
document.addEventListener("visibilitychange",()=>{if(document.hidden)stop()});
window.addEventListener("pagehide",stop);
})();
