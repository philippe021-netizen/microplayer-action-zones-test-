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
test('les séances passées restent jouables et leur reprise utilise le quota du jour réel',()=>{
 assert.match(app,/function available\(\)\{return chosen<=currentDay\(\)&&Boolean\(D\.schedule\[chosen\]\)\}/);
 assert.match(app,/function seconds\(\)\{return Math\.min\(MAX,progress\.spent\[currentDay\(\)\]\|\|0\)\}/);
 assert.match(app,/const day=currentDay\(\);progress\.spent\[day\]/);
 assert.match(app,/Tu peux reprendre les missions de cette journée/);
 const available=app.match(/function available\(\)\{[^\n]*\}/)[0];
 for(const [day,expected] of [['2026-10-18',true],['2026-10-19',true],['2026-10-20',false]]){
   assert.equal(vm.runInNewContext('(()=>{'+available+';return available()})()',{D:data,chosen:day,currentDay:()=>'2026-10-19'}),expected,day);
 }
 const seconds=app.match(/function seconds\(\)\{[^\n]*\}/)[0];
 assert.equal(vm.runInNewContext('(()=>{'+seconds+';return seconds()})()',{MAX:1800,progress:{spent:{'2026-10-18':900,'2026-10-19':120}},currentDay:()=>'2026-10-19'}),120);
});
test('relance taquine après 30 secondes sans activité, avec des variantes sans répétition immédiate',()=>{
 assert.match(app,/Date\.now\(\)-lastActivity>=30000/);
 assert.match(app,/function markActivity\(\)/);
 assert.match(app,/function startIdleWatch\(\)/);
 assert.match(app,/function stopIdleWatch\(\)/);
 const block=app.match(/const encouragements=\[(.*?)\];/);
 assert.ok(block);
 const phrases=Array.from(block[1].matchAll(/"([^"]+)"/g),m=>m[1]);
 assert.equal(phrases.length,5);
 assert.equal(new Set(phrases).size,phrases.length);
 assert.ok(phrases.some(x=>x.includes('tu dors ou quoi')));
 assert.match(app,/i===lastEncouragement/);
 assert.match(app,/stopIdleWatch\(\)/);
});
test('les fichiers servis par le projet Vercel restent synchronisés',()=>{
 const deployed=path.join(base,'..','ardoise-magique','harmonie-revisions');
 assert.equal(fs.readFileSync(path.join(deployed,'data.js'),'utf8'),src);
 assert.equal(fs.readFileSync(path.join(deployed,'app.js'),'utf8'),app);
 assert.deepEqual(fs.readdirSync(path.join(deployed,'audio')).sort(),fs.readdirSync(path.join(base,'audio')).sort());
 for(const file of fs.readdirSync(path.join(base,'audio')))assert.deepEqual(fs.readFileSync(path.join(deployed,'audio',file)),fs.readFileSync(path.join(base,'audio',file)),file);
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
 const helpers=app.slice(app.indexOf('function shuffled'),app.indexOf('function startGame'));
 const generator=vm.runInNewContext('(()=>{'+helpers+';return {generate,alphabetKey}})()', {D:data,Math});
 for(const [type,graph] of ['r','u','ou','eu','o','p','t'].map(sound=>['read-'+sound,sound])){
   const qs=generator.generate(type,1);
   const targets=new Set(data.words[graph][1].map(generator.alphabetKey));
   for(const q of qs){
     assert.ok(targets.has(generator.alphabetKey(q.answer)),'réponse doit être dans la marche du son '+graph);
     const optionKeys=q.options.map(generator.alphabetKey);
     assert.equal(new Set(optionKeys).size,optionKeys.length,'doublon lexical pour le son '+graph+': '+q.options.join(' / '));
     for(const d of q.options.filter(x=>generator.alphabetKey(x)!==generator.alphabetKey(q.answer)))assert.ok(!targets.has(generator.alphabetKey(d)),'distracteur dans la même liste '+graph);
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

test('les révisions de nombres reprennent les quatre exercices de la fiche jusqu’à 99',()=>{
 const generator=vm.runInNewContext('(()=>{'+app.slice(app.indexOf('function shuffled'),app.indexOf('function startGame'))+';return generate})()', {D:data,Math});
 const qs=generator('tens',1);
 assert.ok(qs.some(q=>q.prompt.includes('nombre avant')));
 assert.ok(qs.some(q=>q.prompt.includes('nombre après')));
 assert.ok(qs.some(q=>q.prompt.includes('Compare')));
 assert.ok(qs.some(q=>q.numberLine&&q.numberLine.min===59&&q.numberLine.max===100));
 assert.ok(qs.some(q=>q.prompt.includes('Complète la bande')));
 for(const q of qs){assert.ok(q.answer);assert.ok(q.options.includes(q.answer));}
});

test('additions et soustractions montrent les étapes exactes des méthodes du cahier',()=>{
 const generator=vm.runInNewContext('(()=>{'+app.slice(app.indexOf('function shuffled'),app.indexOf('function startGame'))+';return generate})()', {D:data,Math});
 const additions=generator('add',1),subtractions=generator('subtract',1);
 assert.ok(additions.some(q=>q.prompt.startsWith('63 + 22')));
 assert.ok(additions.some(q=>q.prompt.startsWith('43 + 54')));
 assert.match(additions.find(q=>q.prompt.startsWith('63 + 22')).hint,/60 \+ 3 \+ 20 \+ 2.*60 \+ 20 \+ 3 \+ 2.*80 \+ 5.*85/);
 assert.ok(subtractions.some(q=>q.prompt.startsWith('36 − 7')));
 assert.ok(subtractions.some(q=>q.prompt.startsWith('66 − 9')));
 assert.match(subtractions.find(q=>q.prompt.startsWith('36 − 7')).hint,/36 − 6 = 30.*30 − 1 = 29/);
});
test('les additions et soustractions proposent une ardoise de calcul libre, effaçable',()=>{
 const generator=vm.runInNewContext('(()=>{'+app.slice(app.indexOf('function shuffled'),app.indexOf('function startGame'))+';return generate})()', {D:data,Math});
 for(const type of ['add','subtract'])for(const level of [1,2,3]){
   const questions=generator(type,level);
   assert.ok(questions.length>0,type+' niveau '+level);
   assert.ok(questions.every(q=>q.scratchpad===true),type+' doit afficher l’ardoise pour chaque calcul');
 }
 assert.match(html,/id="scratchHelp"/);
 assert.match(app,/show\("handwrite",q\.mode==="write"\|\|Boolean\(q\.scratchpad\)\)/);
 assert.match(app,/if\(q\.mode==="choice"\)[\s\S]*if\(q\.scratchpad\)\{[\s\S]*show\("boardBox",true\);show\("clearWrite",true\)/);
 assert.match(html,/id="clearWrite"[^>]*>🧽 Effacer l’ardoise/);
});

test('chaque jeu de maths choisit une explication orale Lili adaptée avant la première question',()=>{
 assert.match(app,/function mathLesson\(type\)/);
 assert.match(app,/lili-math-add/);
 assert.match(app,/lili-math-subtract/);
 assert.match(app,/lili-math-numbers/);
 assert.match(app,/lili-math-friends/);
 const start=app.slice(app.indexOf('function startGame'),app.indexOf('function renderQuestion'));
 assert.match(start,/gameLesson\(type,level\)/);
 assert.match(app,/const math=mathLesson\(type\)/);
 assert.match(start,/renderQuestion\(\);startIdleWatch\(\)/);
});
test('chaque type de mission quotidienne prépare une explication visuelle avant les questions',()=>{
 const start=app.indexOf('function shuffled');
 const end=app.indexOf('function startGame');
 const lessonFor=vm.runInNewContext('(()=>{'+app.slice(start,end)+';return gameLesson})()', {D:data});
 const seen=new Set();
 for(const missions of Object.values(data.schedule))for(const [,type,level] of missions){
   const lesson=lessonFor(type,level);
   assert.ok(lesson,`explication manquante pour ${type}`);
   assert.ok(lesson.audio,`voix manquante pour ${type}`);
   assert.ok(lesson.cards.length>=2,`décomposition visuelle insuffisante pour ${type}`);
   seen.add(type);
 }
 for(const type of ['add','subtract','tens','friends','negative','time','alphabet','read-u','spell-u','write-u'])assert.ok(seen.has(type));
 assert.match(app,/function renderLessonVisual\(lesson\)/);
 assert.match(app,/show\("lessonVisual",true\)/);
});
test('un nouveau jeu efface les choix et indices de la mission précédente pendant son explication',()=>{
 const start=app.slice(app.indexOf('function startGame'),app.indexOf('function renderQuestion'));
 assert.match(start,/\$\("choices"\)\.replaceChildren\(\)/);
 assert.match(start,/show\("numberLine",false\)/);
 assert.match(start,/show\("nextBtn",false\)/);
 assert.match(start,/\$\("feedback"\)\.textContent=""/);
 assert.match(start,/show\("lessonVisual",false\)/);
});

test('les mots restent visibles trois secondes et Lili utilise des audios ralentis',()=>{
 const generator=vm.runInNewContext('(()=>{'+app.slice(app.indexOf('function shuffled'),app.indexOf('function startGame'))+';return generate})()', {D:data,Math});
 const qs=generator('spell-u',1);
 assert.ok(qs.length>0);
 assert.ok(qs.every(q=>q.mode==='write'));
 assert.match(app,/setTimeout\(\(\)=>\{/);
 assert.match(app,/},3000\)/);
 assert.match(app,/function playVoice\(file,onend\)/);
 assert.match(app,/type\.startsWith\("spell-"\)\?"spell"/,'les mots à mémoriser ont une explication dédiée');
 assert.match(app,/type\.startsWith\("write-"\)\?"write"/,'les mots à recopier ont une explication dédiée');
 assert.doesNotMatch(app,/sequence=.*lili-u-(?:marche1|words)/,'les enregistrements qui récitent toute la liste ne sont pas joués au démarrage');
 assert.match(app,/function encourage\(\).*playVoice\("lili-encourage-"\+\(i\+1\)\)/);
 assert.doesNotMatch(app,/SpeechSynthesisUtterance|speechSynthesis/);
 const voiceBlock=app.slice(app.indexOf('function playVoice'),app.indexOf('function say'));
 assert.doesNotMatch(voiceBlock,/GusMedia\?\.stop/);
 assert.match(app,/AUDIO_KEY/);
 for(const file of ['lili-intro.mp3','lili-u-marche1.mp3','lili-u-words.mp3',...Array.from({length:5},(_,i)=>`lili-encourage-${i+1}.mp3`)])assert.ok(fs.statSync(path.join(base,'audio',file)).size>5000,file);
 assert.ok(fs.statSync(path.join(base,'audio','harmonie-background.mp3')).size>500000);
 assert.match(app,/harmonie-background\.mp3/);
 assert.match(html,/id="gus-music-player"/);
});
test('ardoise scolaire, animations et médias Gus sont raccordés',()=>{
 assert.match(fs.readFileSync(path.join(base,'style.css'),'utf8'),/background:radial-gradient\(ellipse[^;]*#245344/);
 const gusDir=path.join(base,'..','gus_media');
 const gus=fs.readFileSync(path.join(gusDir,'integration.js'),'utf8');
 assert.match(gus,/new URL\("\.\/",document\.currentScript\.src\)/);
 const deployedGus=path.join(base,'..','ardoise-magique','gus_media');
 assert.deepEqual(fs.readdirSync(deployedGus).sort(),fs.readdirSync(gusDir).sort());
 assert.equal(fs.readFileSync(path.join(deployedGus,'integration.js'),'utf8'),gus);
 assert.match(gus,/HarmonieMusicVolume/);
 assert.match(gus,/function present\(\)/);
 assert.match(gus,/#gus-video-stage\.presenter\{left:max\(4px/);
 assert.match(gus,/width:clamp\(160px,24vw,280px\)/);
 assert.match(app,/GusMedia\?\.playCorrect\(\)/);
 assert.match(app,/GusMedia\?\.play\("04_Oups"\)/);
});
test('ardoise : le correcteur valide les réponses reconnues et interdit l’auto-validation',()=>{
 assert.match(app,/recognizeHandwriting\(canvas\)/);
 assert.match(app,/fetch\("\/api\/recognize-handwriting"/);
 assert.doesNotMatch(app,/Tesseract|tesseract/i,'le navigateur ne doit plus tenter de lire la cursive avec l’OCR générique');
 assert.match(app,/function handwritingDecision\(expected,actual,confidence\)/);
 const checker=vm.runInNewContext('(()=>{'+app.slice(app.indexOf('function handwritingDecision'),app.indexOf('async function compareWrite'))+';return handwritingDecision})()',{clean:s=>String(s).normalize('NFC').trim().toLocaleLowerCase('fr')});
 assert.deepEqual(JSON.parse(JSON.stringify(checker('la rue','La rue',82))),{status:'correct',read:'La rue'});
 assert.deepEqual(JSON.parse(JSON.stringify(checker('la rue','la roue',84))),{status:'incorrect',read:'la roue'});
 assert.deepEqual(JSON.parse(JSON.stringify(checker('la rue','la rue',41))),{status:'unreadable',read:'la rue'});
 assert.match(app,/function offerWriteRetry\(message,\{countMistake=false,expected=null,actual=null\}=\{\}\)/);
 assert.match(app,/correcteur a reconnu « /);
 assert.match(app,/comparateur a lu « /);
 assert.match(app,/comparateur n’arrive pas encore à déchiffrer l’écriture cursive/);
 assert.doesNotMatch(app,/Écris-le plus grand/,'ne pas prétendre que l’écriture est trop petite si le moteur OCR échoue');
 assert.match(app,/Réessaie dans un instant/);
 const compare=app.slice(app.indexOf('async function compareWrite'),app.indexOf('function next()'));
 assert.match(compare,/\$\("memory"\)\.classList\.add\("hide"\)/,'le modèle reste caché pendant le contrôle et après une erreur');
 assert.doesNotMatch(compare,/\$\("memory"\)\.classList\.remove\("hide"\)/,'le correcteur ne doit pas réafficher le modèle avant la prochaine tentative');
 assert.doesNotMatch(app,/J’ai comparé : c’est bien ça|function offerWriteDecision/);
 assert.match(html,/id="voiceToggle"/);
 assert.match(html,/id="musicToggle"/);
});

test('comparateur : les lettres lues de travers ou oubliées sont repérées sans inventer de faute',()=>{
 const align=vm.runInNewContext('(()=>{'+app.slice(app.indexOf('function letterAlignment'),app.indexOf('function showLetterComparison'))+';return letterAlignment})()',{clean:s=>String(s).normalize('NFC').trim().toLocaleLowerCase('fr')});
 const missing=align('un fruit','un frut');
 assert.equal(missing.expected.filter(x=>x.wrong).map(x=>x.char).join(''),'i');
 const extra=align('la rue','la roue');
 assert.equal(extra.actual.filter(x=>x.wrong).map(x=>x.char).join(''),'o');
 const exact=align('un fruit','un fruit');
 assert.equal(exact.expected.some(x=>x.wrong),false);
 assert.equal(exact.actual.some(x=>x.wrong),false);
 assert.match(app,/function showLetterComparison\(expected,actual\)/);
 assert.match(app,/className="letter-check-wrong"/);
 assert.match(app,/{countMistake:true,expected:q.answer,actual:decision.read}/);
});

test('ardoise : réécriture sous le tableau, animation d’erreur et écran recentré',()=>{
 const boardAt=html.indexOf('id="boardBox"'),retryAt=html.indexOf('id="retryWrite"');
 assert.ok(boardAt>=0&&retryAt>boardAt,'le bouton de réécriture doit apparaître après l’ardoise dans le HTML');
 assert.match(app,/show\("retryWrite",true\)/);
 assert.match(app,/function retryWrite\(\)/);
 assert.match(app,/if\(countMistake\)\{animateWrongAnswer\(\);window\.GusMedia\?\.play\("04_Oups"\)\}/,'l’animation douce et le Oups de Gus se déclenchent quand le mot est reconnu incorrect');
 assert.match(app,/function animateWrongAnswer\(\)/);
 assert.match(app,/document\.body\.classList\.add\("playing"\)/);
 assert.match(app,/document\.body\.classList\.remove\("playing"\)/);
 const css=fs.readFileSync(path.join(base,'style.css'),'utf8');
 assert.match(css,/body\.playing>\.app>#play\{display:flex/);
 assert.match(css,/body\.playing #boardBox\{height:clamp\(/);
 assert.match(css,/@keyframes wrong-wiggle/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{#boardBox\.wrong-answer\{animation:none\}\}/);
});

test('ardoise : ampoule d’indices progressifs pour retrouver un mot oublié',()=>{
 assert.ok(html.indexOf('id="hintWrite"')>html.indexOf('id="boardBox"'),'l’ampoule se trouve sous le tableau');
 assert.match(html,/💡 Un indice/);
 assert.match(app,/function giveWriteHint\(\)/);
 const fn=app.slice(app.indexOf('function giveWriteHint'),app.indexOf('function offerWriteRetry'));
 const memory={textContent:'',classList:{add(){this.hidden=true},remove(){this.hidden=false}}};
 const hint={textContent:''};let shown=false;
 const scope={game:{pos:0,questions:[{mode:'write',answer:'un fruit'}],hintLevel:0},markActivity(){},$:id=>id==='memory'?memory:hint,show(id,value){if(id==='writeHint')shown=value},setTimeout:()=>1,clearTimeout(){}};
 vm.runInNewContext(fn+';giveWriteHint();',scope);
 assert.match(hint.textContent,/commence par « F »/);assert.equal(scope.game.hintLevel,1);
 vm.runInNewContext(fn+';giveWriteHint();',scope);
 assert.match(hint.textContent,/« fr… », 5 lettres/);assert.equal(scope.game.hintLevel,2);
 vm.runInNewContext(fn+';giveWriteHint();',scope);
 assert.equal(memory.textContent,'un fruit');assert.equal(memory.classList.hidden,false);assert.equal(shown,true);
});

test('Gus : le prout original peut apparaître rarement après une bonne réponse',()=>{
 const gus=fs.readFileSync(path.join(base,'..','gus_media','integration.js'),'utf8');
 assert.match(gus,/Math\.random\(\)<\.12\)return play\("01_Prout"\)/);
 assert.ok(fs.statSync(path.join(base,'..','gus_media','01_Prout.m4a')).size>50000);
 assert.ok(fs.statSync(path.join(base,'..','gus_media','01_Prout.webp')).size>500000);
});
