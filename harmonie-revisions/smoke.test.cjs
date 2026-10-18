const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
assert.equal(scripts.length, 2, 'the app has its game engine and iPad settings bootstrap');

const elements = new Map();
function element(id = '') {
  return elements.get(id) || elements.set(id, {
    id, value: '', textContent: '', innerHTML: '', disabled: false, dataset: {}, style: {},
    onclick: null, onpointerdown: null, onpointermove: null, onpointerup: null,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, setPointerCapture() {},
    getBoundingClientRect() { return { width: 400, height: 150, left: 0, top: 0 }; },
    getContext() { return { scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {} }; }
  }).get(id);
}
const store = new Map();
const document = {
  head: { insertAdjacentHTML() {} },
  getElementById: element,
  querySelectorAll() { return []; },
  querySelector() { return element(); }
};
const context = vm.createContext({
  document, window: {}, localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) },
  Intl, Date, Math, JSON, String, Array, Object, Number, RegExp, Error,
  setInterval: () => 1, clearInterval() {}, confirm: () => true,
  CSS: { escape: s => s }, devicePixelRatio: 2, console
});
for (const script of scripts) new vm.Script(script).runInContext(context);
new vm.Script('globalThis.appTest={get days(){return DAYS},get topics(){return TOPICS},get data(){return DATA},get lists(){return wordLists},set lists(x){wordLists=x},questions:topicQuestions,session:startSession,mini:startMini,answer,advance:()=>document.getElementById("nextQ").onclick(),finish:()=>document.getElementById("homeBtn").onclick()}').runInContext(context);

const app = context.appTest;
assert.equal(app.days.length, 10);
assert.equal(app.days.map(x => x.date).join(','), '2026-10-18,2026-10-19,2026-10-20,2026-10-26,2026-10-27,2026-10-30,2026-10-31,2026-11-01,2026-11-02,2026-11-03');
for (const skill of ['soundsU', 'soundsOu', 'readingU', 'write', 'math', 'tens', 'ten', 'additionTables', 'tenses', 'negative']) {
  assert.ok(app.topics[skill], 'missing skill ' + skill);
  assert.ok(app.data[skill]?.length, 'missing playable questions for ' + skill);
}
assert.ok(html.includes('25*60*1000'), 'a scheduled session has a hard 25-minute stop');
assert.ok(html.includes('soundsOu2') && html.includes('soundsOu3'), 'later ou lists are conditional');

// Each choice mini-game must accept its own answer key and complete without a runtime error.
for (const skill of ['soundsU', 'soundsOu', 'math', 'tens', 'ten', 'additionTables', 'tenses', 'negative']) {
  app.mini(skill);
  const game = new vm.Script('active').runInContext(context);
  for (let i = 0; i < game.questions.length; i++) {
    app.answer(game.questions[i].answer);
    app.advance();
  }
  assert.equal(new vm.Script('finished').runInContext(context), true, skill + ' should finish');
  app.finish();
}

app.mini('readingU');
let readingGame = new vm.Script('active').runInContext(context);
assert.equal(readingGame.questions.length, 4, 'the real binder reading is split into four child-sized steps');
for (let i = 0; i < readingGame.questions.length; i++) {
  assert.equal(readingGame.questions[i].kind, 'task');
  element('completeTask').onclick();
  app.advance();
}
assert.equal(new vm.Script('finished').runInContext(context), true);
app.finish();

// A missed prompt is replayed once and a corrected answer disappears from the review list.
app.mini('negative');
let reviewGame = new vm.Script('active').runInContext(context);
const originalCount = reviewGame.questions.length;
app.answer(reviewGame.questions[0].options[1]);
app.advance();
for (let i = 1; i < originalCount; i++) {
  app.answer(reviewGame.questions[i].answer);
  app.advance();
}
let repeatedGame = new vm.Script('active').runInContext(context);
assert.equal(new vm.Script('round').runInContext(context), originalCount);
assert.equal(repeatedGame.questions.length, originalCount + 1);
app.answer(reviewGame.questions[0].answer);
app.advance();
assert.equal(new vm.Script('finished').runInContext(context), true);
assert.deepEqual(Array.from(new vm.Script('wrong').runInContext(context)), []);
app.finish();

// Words supplied by the parent are used verbatim; none are preloaded as invented dictation lists.
assert.deepEqual(Array.from(app.lists.u), []);
app.lists = { u: ['une lune'], ou1: ['un loup'], ou2: ['rouge'], ou3: ['bonjour'] };
assert.ok(app.questions('soundsU').some(x => x.text.includes('une lune')));
assert.ok(app.questions('soundsOu2').some(x => x.text.includes('rouge')));
assert.ok(app.questions('soundsOu3').some(x => x.text.includes('bonjour')));

// The cursive practice accepts a finger/Pencil canvas and can be cleared and continued.
app.mini('write');
let writeGame = new vm.Script('active').runInContext(context);
assert.equal(writeGame.questions[0].kind, 'write');
element('clearBoard').onclick();
element('checkWrite').onclick();
app.advance();
assert.equal(new vm.Script('round').runInContext(context), 1);

for (const control of ['music', 'voice', 'sound', 'parentBtn', 'progressBtn', 'saveWords', 'resetProgress']) {
  assert.ok(element(control), 'missing control ' + control);
}

/* Regression: after two games a scheduled mission must resume, not loop on the pause. */
app.session(0);
for (let miniIndex = 0; miniIndex < 2; miniIndex++) {
  const game = new vm.Script('active').runInContext(context);
  assert.equal(game.topic, miniIndex === 0 ? 'readingU' : 'soundsU');
  for (const question of game.questions) {
    if (question.kind === 'task') element('completeTask').onclick();
    else if (question.kind === 'write') element('checkWrite').onclick();
    else app.answer(question.answer);
    app.advance();
  }
}
assert.equal(typeof element('resume').onclick, 'function', 'break must offer resume');
element('resume').onclick();
const resumedGame = new vm.Script('active').runInContext(context);
assert.equal(resumedGame.topic, 'math', 'resume must start the third mini-game');
for (const question of resumedGame.questions) {
  app.answer(question.answer);
  app.advance();
}
assert.equal(new vm.Script('finished').runInContext(context), true);
app.finish();

console.log('Harmonie revision smoke checks passed.');
