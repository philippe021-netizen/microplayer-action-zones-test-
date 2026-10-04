const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const page = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const lesson = JSON.parse(fs.readFileSync(path.join(__dirname, 'lessons/r-01.json'), 'utf8'));
const alphabet = fs.readFileSync(path.join(__dirname, '../harmonie-alphabet/index.html'), 'utf8');

assert.deepEqual(lesson.words, ['une rue','le roi','le repas','un arbre','mon frère','un fruit','une voiture','trois']);
assert.equal(lesson.difficulty, 'normal');
assert.equal(lesson.displaySeconds, 3);
for (const feature of ['Marelle-Regular.woff2', 'pointerdown', 'getCoalescedEvents', 'touch-action:none', 'localStorage', 'speechSynthesis', 'guideToggle', 'J’ai fini', 'Maintenir une seconde', 'pencilWrite', 'scribbleInput', 'usePencil', 'useFinger', 'L’iPad a transformé ton écriture']) {
  assert.ok(page.includes(feature), 'missing ' + feature);
}
assert.ok(page.indexOf('id="pencilWrite"') < page.indexOf('id="writeWrap"'), 'Pencil recognition should be the first writing mode');
assert.ok(page.includes("setWritingMode('pencil')"), 'Pencil mode should be the default');
assert.ok(!/if\s*\(\s*letter\s*===?\s*['"]R['"]/.test(page), 'the engine must not branch on the R lesson');
assert.ok(alphabet.includes('../ardoise-magique/index.html'), 'the alphabet game links to the new game');
const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length, 'game script exists');
new vm.Script(scripts.at(-1)[1]);
console.log('Harmonie slate smoke checks passed.');
