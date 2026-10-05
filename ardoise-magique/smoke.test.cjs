const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const page=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const client=fs.readFileSync(path.join(__dirname,'classroom.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'classroom.css'),'utf8');
const recognizer=fs.readFileSync(path.join(__dirname,'api/recognize-handwriting.js'),'utf8');
const teacherSpeech=fs.readFileSync(path.join(__dirname,'api/teacher-speech.js'),'utf8');
const lesson=JSON.parse(fs.readFileSync(path.join(__dirname,'lessons/r-01.json'),'utf8'));
const alphabetLesson=JSON.parse(fs.readFileSync(path.join(__dirname,'lessons/alphabet-2letters.json'),'utf8'));
const alphabet=fs.readFileSync(path.join(__dirname,'../harmonie-alphabet/index.html'),'utf8');

assert.deepEqual(lesson.words,['une rue','le roi','le repas','un arbre','mon frère','un fruit','une voiture','trois']);
assert.equal(lesson.marches.length,3);
assert.deepEqual(lesson.marches[1].words,['la reine','mon père','après','il roule','la route','quatre']);
assert.deepEqual(lesson.marches[2].words,['rond','ronde','aujourd’hui','hier','derrière','un carré']);
assert.equal(lesson.difficulty,'normal');
assert.equal(lesson.displaySeconds,3);
assert.equal(alphabetLesson.type,'alphabet');
assert.equal(alphabetLesson.items.length,10);
assert.ok(alphabetLesson.items.slice(0,7).every(x=>x.showPrefix!==false));
assert.ok(alphabetLesson.items.slice(7).every(x=>x.showPrefix===false));

for(const feature of ['La classe d’Harmonie','teacherTemplate','teacher-motion-source','teacher-motion-idle','teacher-motion-point','teacher-motion-bravo','teacher-motion-keyed','boardCanvas','alphabetZone','alphabetControls','alphabetCheck','chalkCorrection','stamp','progressScreen','J’ai fini !']){
  assert.ok(page.includes(feature),'page missing '+feature);
}
for(const feature of ['pointerdown','getCoalescedEvents','localStorage','speechSynthesis','teacher-speech','recognize-handwriting','startReview','recordAttempt','parseCustomItems','mistakePositions','requestVideoFrameCallback','texImage2D','HARMONIE_TEACHER_IDLE_VIDEO','HARMONIE_TEACHER_POINT_VIDEO','HARMONIE_TEACHER_BRAVO_VIDEO','teacherMotionVideos','startTeacherIdleMotion','startTeacherBravoMotion',"startTeacherVideo('bravo')",'itemsForMarche','marche-actions','selectedMarche','beginAlphabetExercise','alphabetExpected','checkAlphabetOrder','alphabetSelection']){
  assert.ok(client.includes(feature),'client missing '+feature);
}
for(const feature of ['pose-point','pose-check','pose-cheer','stampSlam','chalk-correction','teacher-motion-keyed','teacher-motion-source','alphabet-zone','alphabet-word','alphabet-prefix']){
  assert.ok(css.includes(feature),'css missing '+feature);
}
for(const feature of ['GOOGLE_VISION_API_KEY','DOCUMENT_TEXT_DETECTION','fullTextAnnotation','textAnnotations','mistakePositions']){
  assert.ok(recognizer.includes(feature),'recognizer missing '+feature);
}
for(const feature of ['makeRecognitionImage','toDataURL','image/png']){
  assert.ok(client.includes(feature),'vision client missing '+feature);
}
assert.ok(!recognizer.includes('MYSCRIPT_APPLICATION_KEY'),'MyScript credentials must no longer be required');
assert.ok(!client.includes('MYSCRIPT_NOT_CONFIGURED'),'MyScript UI error path must be removed');
for(const feature of ['GOOGLE_TTS_API_KEY','fr-FR-Chirp3-HD-Leda','text:synthesize','audioContent','stableSsml','<prosody rate="94%" volume="+1dB">','<break time="140ms"/>','<phoneme alphabet="ipa" ph="dø.zjɛm">deuxième</phoneme>']){
  assert.ok(teacherSpeech.includes(feature),'teacher speech API missing '+feature);
}
assert.ok(client.includes('teacherVoiceCache'),'natural teacher audio should be cached in the browser');
assert.ok(client.includes("replace(/\\b2e\\b/gi,'deuxième')"),'teacher speech should expand ordinal abbreviations');
assert.ok(client.includes('decodeAudioData'),'teacher voice should play through unlocked WebAudio on iPad');
assert.ok(fs.existsSync(path.join(__dirname,'media/bravo-harmonie-2.8s.mp4')),'Bravo teacher clip must be packaged with the app');
assert.ok(client.includes("if(pose==='cheer')"),'success pose must have a dedicated branch');
assert.ok(client.includes("startTeacherBravoMotion();"),'correct answer must trigger the Bravo video');
assert.ok(!page.includes('selfSuccess'),'manual child validation must stay removed');
assert.ok(!page.includes('teacher-motion-anim'),'the classroom must use real video, not animated WebP');
assert.ok(!page.includes('teacher-photo'),'the old static teacher photo must be removed from the classroom template');
assert.ok(!page.includes('teacher-motion-fallback'),'the old static/animated fallback must not come back');
assert.ok(client.includes("classList.toggle('video-idle',mode==='idle')"),'idle video must expose a dedicated visual state');
assert.ok(client.includes('uniform vec3 u_key'),'keyer must use one fixed chroma color for A1 and A2');
assert.ok(client.includes("gl.uniform3f(gl.getUniformLocation(program,'u_key')"),'fixed chroma color must be sent to the shader');
assert.ok(client.includes("Number(key.inner)||0.035"),'fixed key must use a narrow inner tolerance');
assert.ok(client.includes("Number(key.outer)||0.20"),'fixed key must use a slightly wider feather tolerance');
assert.ok(client.includes('uniform float u_greenLow')&&client.includes('uniform float u_greenHigh'),'standard chroma key must remove green spill by global green dominance');
assert.ok(client.includes("Number(key.greenLow)||0.015")&&client.includes("Number(key.greenHigh)||0.14"),'green dominance thresholds must remove darker compressed green background');
assert.ok(client.includes('float greenAlpha='),'standard chroma key must blend exact-key and green-dominance alpha');
assert.ok(!client.includes('float md('),'adaptive background sampling must be removed');
assert.ok(!client.includes('float warm='),'skin/hair protection hack must be removed');
assert.ok(!client.includes('blueProtect'),'jeans protection hack must be removed');
assert.ok(!client.includes('whiteProtect'),'white garment protection hack must be removed');
assert.ok(!css.includes('brightness(.90)'),'idle color grading hack must be removed');
assert.ok(!css.includes('saturate(.90)'),'idle saturation hack must be removed');

assert.ok(alphabet.includes('../ardoise-magique/index.html'),'alphabet game links to classroom');
assert.ok(!/if\s*\(\s*letter\s*===?\s*['"]R['"]/.test(client),'engine must not branch on R');
new vm.Script(client);
new vm.Script(recognizer);
console.log('Harmonie classroom smoke checks passed.');
