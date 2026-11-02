'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = __dirname;
const dataSource = fs.readFileSync(path.join(base,'data.js'),'utf8');
const app = fs.readFileSync(path.join(base,'app.js'),'utf8');
const html = fs.readFileSync(path.join(base,'index.html'),'utf8');
const css = fs.readFileSync(path.join(base,'style.css'),'utf8');
const ctx = {window:{}};
vm.runInNewContext(dataSource,ctx);
const start = app.indexOf('function shuffled');
const end = app.indexOf('function startGame');
assert.ok(start>0 && end>start);
const generate = vm.runInNewContext('(()=>{'+app.slice(start,end)+';return generate})()', {D:ctx.window.HARMONIE_DATA, Math});

test('six additions avec une vraie retenue dans chaque session',()=>{
 for(let run=0;run<8;run++){
  const qs=generate('carry',1);
  assert.equal(qs.length,6);
  assert.equal(new Set(qs.map(q=>q.prompt)).size,6);
  for(const q of qs){
   assert.equal(q.mode,'choice');
   assert.equal(q.scratchpad,true);
   const {a,b}=q.carryNumbers;
   assert.ok(a%10+b%10>=10, q.prompt+' doit nécessiter une retenue');
   assert.equal(Number(q.answer),a+b);
   assert.ok(q.options.includes(q.answer));
   assert.equal(new Set(Array.from(q.options)).size,q.options.length);
  }
 }
});

test('ardoise tactile, annulation et correction via choix sans OCR inventé',()=>{
 for(const id of ['carryPractice','lessonGo','board','undoWrite','clearWrite','choices'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Écris la retenue/);
 assert.match(app,/function renderScratchGuide\(q\)/);
 assert.match(app,/host.classList.toggle\("is-carry",Boolean\(q.carryNumbers\)\)/);
 assert.match(app,/board.addEventListener\("pointerdown"/);
 assert.match(app,/board.addEventListener\("pointermove"/);
 assert.match(app,/canvasStrokes.pop\(\)/);
 assert.match(css,/#boardBox #board\{z-index:2;touch-action:none\}/);
 assert.match(app,/if\(done.type!=="carry"\)complete\(done.id\)/);
});
test('les fichiers Vercel sont identiques aux sources',()=>{
 for(const f of ['app.js','index.html','style.css'])
  assert.equal(fs.readFileSync(path.join(base,f),'utf8'),
    fs.readFileSync(path.join(base,'..','ardoise-magique','harmonie-revisions',f),'utf8'));
});
