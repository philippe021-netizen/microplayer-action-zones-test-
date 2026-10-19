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

test('un programme quotidien continu du 18 octobre au 3 novembre',()=>{
 const dates=Object.keys(data.schedule).sort();
 assert.equal(dates.length,17);
 assert.equal(dates[0],'2026-10-18');
 assert.equal(dates.at(-1),'2026-11-03');
 for(let i=0;i<dates.length;i++){
   const date=dates[i];
   assert.equal(data.schedule[date].length,3,date);
   assert.equal(new Date(date).toISOString().slice(0,10),date);
   if(i>0){const previous=new Date(dates[i-1]+'T12:00:00');previous.setDate(previous.getDate()+1);assert.equal(dates[i],previous.toISOString().slice(0,10),'jour manquant après '+dates[i-1]);}
 }
});
test('mots des sons u et ou correctement rangés par marche',()=>{
 assert.deepEqual(Array.from(data.words.u[1]),['la rue','un fruit','une voiture','du sucre','de la confiture','un nuage']);
 assert.deepEqual(Array.from(data.words.ou[1]),['un loup','une souris','rouge','la route','une journée','la soupe','toujours']);
 assert.equal(data.words.ou[2].includes('beaucoup'),true);
 assert.equal(data.words.ou[3].includes('douze'),true);
 assert.equal(data.words.t[3].includes('toujours'),true);
 assert.equal(data.words.ou[1].includes('toujours'),true,'mot toujours visible dans les deux marches de la fiche');
});
test('les sept sons photographiés sont intégrés en trois marches',()=>{
 for(const sound of ['r','u','ou','eu','o','p','t']){
   assert.deepEqual(Object.keys(data.words[sound]).sort(),['1','2','3']);
   assert.ok(data.words[sound][1].length>0,sound+' marche 1 vide');
 }
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
test('les fichiers servis par le projet Vercel restent synchronisés',()=>{
 const deployed=path.join(base,'..','ardoise-magique','harmonie-revisions');
 assert.equal(fs.readFileSync(path.join(deployed,'data.js'),'utf8'),src);
 assert.equal(fs.readFileSync(path.join(deployed,'app.js'),'utf8'),app);
 assert.match(fs.readFileSync(path.join(deployed,'index.html'),'utf8'),/Trois petites missions sont prévues chaque jour/);
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
 assert.ok(total>182,'les missions quotidiennes doivent toutes générer des questions');
});

test('lecture des graphies : choix orthographiques non ambigus',()=>{
 const generator=vm.runInNewContext('(()=>{'+app.slice(app.indexOf('function shuffled'),app.indexOf('function startGame'))+';return generate})()',{D:data,Math});
 for(const [type,graph] of ['r','u','ou','eu','o','p','t'].map(sound=>['read-'+sound,sound])){
   const qs=generator(type,1);
   const targets=new Set(data.words[graph][1].map(x=>x.toLocaleLowerCase('fr')));
   for(const q of qs){
     assert.ok(targets.has(q.answer.toLocaleLowerCase('fr')),'réponse doit être dans la marche du son '+graph);
     for(const d of q.options.filter(x=>x!==q.answer))assert.ok(!targets.has(d.toLocaleLowerCase('fr')),'distracteur dans la même liste '+graph);
   }
 }
});
test('ordre alphabétique : le mot attendu est bien le premier',()=>{
 const generator=vm.runInNewContext('(()=>{'+app.slice(app.indexOf('function shuffled'),app.indexOf('function startGame'))+';return generate})()',{D:data,Math});
 for(const level of [1,2])for(const q of generator('alphabet',level)){
   const words=q.options;
   const key=x=>x.toLocaleLowerCase('fr').replace(/^(?:un|une|le|la|les|des|du)\s+/,"").replace(/^l'/,"");
   assert.equal(q.answer,[...words].sort((a,b)=>key(a).localeCompare(key(b),'fr'))[0]);
 }
});

test('les mots sont montrés trois secondes et lus par la voix réglée à l’ancienne',()=>{
 const generator=vm.runInNewContext('(()=>{'+app.slice(app.indexOf('function shuffled'),app.indexOf('function startGame'))+';return generate})()', {D:data,Math});
 const qs=generator('spell-u',1);
 assert.ok(qs.length>0);
 assert.ok(qs.every(q=>q.mode==='write'));
 assert.match(app,/setTimeout\(\(\)=>\{/);
 assert.match(app,/},3000\)/);
 assert.match(app,/SpeechSynthesisUtterance\(q\.answer\)/);
 assert.match(app,/pitch=1\.55/);
 assert.match(app,/speechElapsed/);
 assert.match(app,/AUDIO_KEY/);
});
test('ardoise scolaire, animations et médias Gus sont raccordés',()=>{
 assert.match(fs.readFileSync(path.join(base,'style.css'),'utf8'),/background:radial-gradient\(ellipse[^;]*#245344/);
 const gusDir=path.join(base,'..','gus_media');
 const gus=fs.readFileSync(path.join(gusDir,'integration.js'),'utf8');
 assert.match(gus,/new URL\("\.\/",document\.currentScript\.src\)/);
 const deployedGus=path.join(base,'..','ardoise-magique','gus_media');
 assert.deepEqual(fs.readdirSync(deployedGus).sort(),fs.readdirSync(gusDir).sort());
 assert.equal(fs.readFileSync(path.join(deployedGus,'integration.js'),'utf8'),gus);
 assert.match(app,/GusMedia\?\.playCorrect\(\)/);
 assert.match(app,/GusMedia\?\.play\("04_Oups"\)/);
});
test('ardoise : lecture automatique prudente avec validation humaine de secours',()=>{
 assert.match(app,/loadRecognitionLibrary/);
 assert.match(app,/engine\.recognize\(canvas,"fra"\)/);
 assert.match(app,/confidence>=70/);
 assert.match(app,/const accept=document\.createElement\("button"\)/);
 assert.match(app,/lecture automatique n’a pas pu démarrer/);
 assert.match(html,/id="voiceToggle"/);
 assert.match(html,/id="musicToggle"/);
});
