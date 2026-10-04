const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const page=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const client=fs.readFileSync(path.join(__dirname,'classroom.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'classroom.css'),'utf8');
const recognizer=fs.readFileSync(path.join(__dirname,'api/recognize-handwriting.js'),'utf8');
const lesson=JSON.parse(fs.readFileSync(path.join(__dirname,'lessons/r-01.json'),'utf8'));
const alphabet=fs.readFileSync(path.join(__dirname,'../harmonie-alphabet/index.html'),'utf8');

assert.deepEqual(lesson.words,['une rue','le roi','le repas','un arbre','mon frère','un fruit','une voiture','trois']);
assert.equal(lesson.difficulty,'normal');
assert.equal(lesson.displaySeconds,3);

for(const feature of ['La classe d’Harmonie','teacherTemplate','boardCanvas','chalkCorrection','stamp','progressScreen','J’ai fini !']){
  assert.ok(page.includes(feature),'page missing '+feature);
}
for(const feature of ['pointerdown','getCoalescedEvents','localStorage','speechSynthesis','recognize-handwriting','startReview','recordAttempt','parseCustomItems','mistakePositions']){
  assert.ok(client.includes(feature),'client missing '+feature);
}
for(const feature of ['pose-point','pose-check','pose-cheer','stampSlam','chalk-correction']){
  assert.ok(css.includes(feature),'css missing '+feature);
}
for(const feature of ['MYSCRIPT_APPLICATION_KEY','MYSCRIPT_HMAC_KEY','customLexicon','fr_FR','createHmac','contentType','Math','mistakePositions']){
  assert.ok(recognizer.includes(feature),'recognizer missing '+feature);
}
assert.ok(!page.includes('selfSuccess'),'manual child validation must stay removed');
assert.ok(alphabet.includes('../ardoise-magique/index.html'),'alphabet game links to classroom');
assert.ok(!/if\s*\(\s*letter\s*===?\s*['"]R['"]/.test(client),'engine must not branch on R');
new vm.Script(client);
new vm.Script(recognizer);
console.log('Harmonie classroom smoke checks passed.');
