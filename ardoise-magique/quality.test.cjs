const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const page = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];

function loadHelper(name) {
  const start = script.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'missing helper ' + name);
  const open = script.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < script.length; i++) {
    if (script[i] === '{') depth++;
    if (script[i] === '}' && --depth === 0) {
      const sandbox = {};
      vm.runInNewContext(script.slice(start, i + 1), sandbox);
      return sandbox[name];
    }
  }
  assert.fail('unclosed helper ' + name);
}

const preview = loadHelper('writingPreviewSvg');
const strokes = [[{x: 20, y: 40}, {x: 90, y: 55}], [{x: 100, y: 52}, {x: 160, y: 40}]];
const svg = preview(strokes, 500, 300);
assert.match(svg, /<svg[^>]+viewBox="[^"]+"/);
assert.match(svg, /preserveAspectRatio="xMidYMid meet"/);
assert.equal((svg.match(/<polyline/g) || []).length, 2);
assert.ok(!/viewBox="0 0 0 0"/.test(svg));

const feedback = loadHelper('recognitionFeedback');
assert.equal(feedback('mon frère', 'Mon frère', 92).status, 'match');
assert.equal(feedback('une rue', 'UNE RUE', 20).status, 'match');
assert.match(feedback('une rue', 'UNE RUE', 20).message, /ressemble au modèle/);
assert.equal(feedback('une rue', 'une roue', 90).status, 'check');
assert.equal(feedback('une rue', 'une ru', 42).status, 'uncertain');
assert.match(feedback('une rue', 'une roue', 90).message, /une roue/);
assert.doesNotMatch(feedback('une rue', 'une roue', 90).message, /faux|échec|raté/i);
console.log('Writing preview and gentle-recognition checks passed.');
