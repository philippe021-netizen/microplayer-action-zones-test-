const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=__dirname;
const src=fs.readFileSync(path.join(base,'data.js'),'utf8');
const app=fs.readFileSync(path.join(base,'app.js'),'utf8');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const win={};
vm.runInNewContext(src,{window:win});
const data=win.HARMONIE_DATA;

test('10 jours de garde avec 3 missions par date',()=>{
 assert.equal(data.guardDays.length,10);
 assert.equal(Object.keys(data.schedule).length,10);
 for(const date of data.guardDays){
   assert.equal(data.schedule[date].length,3,date);
   assert.equal(new Date(date).toISOString().slice(0,10),date);
 }
});
test('mots des semaines 6 et 7 correctement rangés par marche',()=>{
 assert.deepEqual(Array.from(data.words.u[1]),['la rue','un fruit','une voiture','du sucre','de la confiture','un nuage']);
 assert.deepEqual(Array.from(data.words.ou[1]),['un loup','une souris','rouge','la route','une journée','la soupe','toujours']);
 assert.equal(data.words.ou[2].includes('beaucoup'),true);
 assert.equal(data.words.ou[3].includes('douze'),true);
});
test('la date du 2 novembre est prioritairement consacrée au son u et aux maths',()=>{
 const titles=data.schedule['2026-11-02'].map(x=>x[1]);
 assert.equal(titles[0],'read-u');assert.equal(titles[1],'subtract');assert.equal(titles[2],'tens');
});
test('limite de temps et références HTML',()=>{
 assert.equal(data.maxMinutes,30);
 assert.match(app,/document\.addEventListener\("visibilitychange"/);
 const ids=[...app.matchAll(/\$\("([^"]+)"\)/g)].map(m=>m[1]);
 const htmlIds=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const id of ids)assert.ok(htmlIds.has(id),'missing '+id);
});
test('JavaScript des deux modules chargé sans erreur de syntaxe',()=>{
 assert.doesNotThrow(()=>new Function(src));
 assert.doesNotThrow(()=>new Function(app));
});

test('chaque mini-jeu a des questions solvables, avec une réponse unique',()=>{
 const start=app.indexOf('function shuffled');
 const end=app.indexOf('function startGame');
 assert.ok(start>=0&&end>start);
 const generator=vm.runInNewContext('(()=>{'+app.slice(start,end)+';return generate})()', {D:data,Math});
 let total=0;
 for(const missions of Object.values(data.schedule)){
   for(const [name,type,level] of missions){
     const questions=generator(type,level);
     assert.ok(questions.length>0,name);
     for(const q of questions){
       total++;
       assert.ok(q.answer && q.prompt, type);
       if(q.mode==='choice'){
         assert.ok(q.options.length>=3,type+' : pas assez de choix');
         assert.equal(new Set(Array.from(q.options)).size,q.options.length,type);
         assert.ok(q.options.some(x=>x===q.answer),type+' : réponse introuvable');
       }
     }
   }
 }
 assert.equal(total,182);
});

test('lecture u et ou : choix orthographiques non ambigus',()=>{
 const generator=vm.runInNewContext('(()=>{'+app.slice(app.indexOf('function shuffled'),app.indexOf('function startGame'))+';return generate})()',{D:data,Math});
 for(const [type,graph] of [['read-u','u'],['read-ou','ou']]){
   const qs=generator(type,1);
   for(const q of qs){
     const selected=q.answer.toLowerCase();
     if(graph==='ou') assert.ok(selected.includes('ou'),'cible doit contenir ou');
     else {assert.ok(selected.includes('u'),'cible doit contenir u');assert.ok(!selected.includes('ou'),'cible u ambiguë')}
     for(const d of q.options.filter(x=>x!==q.answer)){
       if(graph==='ou')assert.ok(!d.toLowerCase().includes('ou'),'distracteur contient aussi ou');
       else assert.ok(d.toLowerCase().includes('ou'),'distracteur doit contenir ou');
     }
   }
 }
});

test('ardoise : validation humaine avant de compter le mot comme réussi',()=>{
 assert.match(app,/const accept=document\.createElement\("button"\)/);
 assert.match(app,/Le jeu ne reconnaît pas automatiquement|le jeu ne reconnaît pas automatiquement/);
});
