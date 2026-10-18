/* Harmonie: original Gus sounds + transparent animated images (Safari/iPad).
   Assets: gus_media/NN_Name.webp + gus_media/NN_Name.m4a */
(()=>{
"use strict";
if(!document.getElementById("gus-panel")) return;
const BASE="./gus_media/";
const CHOICES=[
["01_Prout","💨 Prout"],["02_Bravo","👏 Bravo"],["03_Danse","🕺 Danse"],
["04_Oups","🤔 Oups"],["05_Presentation","👉 Présentation"],["06_Rires","😂 Rires"],
["07_Surprise","😲 Surprise"],["08_Au_revoir","👋 Au revoir"],
["09_Presentation_bis","👉 Présentation 2"],["10_Bravo_bis","👏 Bravo 2"]];
const style=document.createElement("style");
style.textContent="#gus-video-tray{display:flex;gap:7px;overflow-x:auto;padding:8px 6px 12px;scrollbar-width:thin;max-width:100%;margin-bottom:12px}"+
"#gus-video-tray button{flex:none;white-space:nowrap;background:#fff;border:1px solid #dfc9f3;color:#5b4285;font:750 13px system-ui;border-radius:15px;padding:9px 12px;min-height:43px}"+
"#gus-video-tray button:focus-visible{outline:3px solid #875bdc}"+
"#gus-video-stage{position:fixed;z-index:60;left:max(5px,env(safe-area-inset-left));bottom:max(3px,env(safe-area-inset-bottom));pointer-events:none;width:clamp(105px,21vw,230px);height:clamp(170px,34vw,340px);overflow:hidden;opacity:0;transition:opacity .14s ease}"+
"#gus-video-stage.show{opacity:1}#gus-video-stage img{width:100%;height:100%;object-fit:contain;object-position:bottom left}"+
"@media(max-width:560px){#gus-video-stage{width:118px;height:182px}#gus-video-tray button{font-size:12px;padding:7px 9px}}"+
"@media(prefers-reduced-motion:reduce){#gus-video-stage{transition:none}}";
document.head.append(style);
const panel=document.getElementById("gus-panel");
const tray=document.createElement("div");tray.id="gus-video-tray";tray.setAttribute("aria-label","Tester les animations de Gus");
const stage=document.createElement("div");stage.id="gus-video-stage";stage.setAttribute("aria-hidden","true");
const picture=document.createElement("img");picture.alt="";picture.decoding="async";stage.append(picture);
const sound=document.createElement("audio");sound.preload="none";document.body.append(sound);document.body.append(stage);
const bgMusic=document.getElementById("gus-music-player");
let ready=false,counter=0,timer=0,lastMessage="",active="";
function stop(){
 clearTimeout(timer);stage.classList.remove("show");sound.pause();active="";
 if(bgMusic && bgMusic.volume<.12)bgMusic.volume=.16;
}
function play(name){
 if(!CHOICES.some(x=>x[0]===name))return;
 ready=true;clearTimeout(timer);sound.pause();
 const nonce=++counter;active=name;
 picture.onload=()=>{
  if(nonce!==counter)return;
  stage.classList.add("show");
  const allowSound=document.getElementById("gus-sound")?.getAttribute("aria-pressed")!=="false";
  if(allowSound){
   sound.src=BASE+name+".m4a";sound.currentTime=0;
   sound.play().catch(()=>{});
  }
  if(bgMusic && !bgMusic.paused)bgMusic.volume=.035;
  timer=setTimeout(stop,5150);
 };
 picture.onerror=()=>{
  if(nonce!==counter)return;
  // Missing assets must never stop spelling, maths, or writing exercises.
  stage.classList.remove("show");
 };
 stage.classList.remove("show");
 picture.src=BASE+name+".webp?cycle="+nonce;
}
for(const [id,label] of CHOICES){
 const b=document.createElement("button");b.type="button";b.textContent=label;
 b.addEventListener("click",()=>play(id));tray.append(b);
}
panel.insertAdjacentElement("afterend",tray);
document.getElementById("gus-start")?.addEventListener("click",()=>{ready=true;play("05_Presentation")});
document.getElementById("gus-fart")?.addEventListener("click",()=>play("01_Prout"));
document.getElementById("gus-tap")?.addEventListener("click",()=>play("06_Rires"));
const feed=document.getElementById("feedback");
if(feed)new MutationObserver(()=>{
 const msg=feed.textContent.trim();
 if(!msg||msg===lastMessage||!ready)return;lastMessage=msg;
 if(/^(Bravo|Bien joué|Super|Génial|Trop fort)/i.test(msg)){
  const opts=["02_Bravo","03_Danse","06_Rires","10_Bravo_bis"];
  play(opts[Math.floor(Math.random()*opts.length)]);
 }else if(/^(Pas tout|On peut réessayer|Presque|Tu peux corriger|Réessaie)/i.test(msg)){
  play("04_Oups");
 }
}).observe(feed,{childList:true,characterData:true,subtree:true});
const finished=document.getElementById("finish");
if(finished)new MutationObserver(()=>{
 if(!finished.hidden&&ready)play("08_Au_revoir");
}).observe(finished,{attributes:true,attributeFilter:["hidden"]});
document.addEventListener("visibilitychange",()=>{if(document.hidden)stop()});
window.addEventListener("pagehide",stop);
})();