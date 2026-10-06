const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');

const appRoot = __dirname;
const slate = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8');
const deployedAlphabetPath = path.join(appRoot, 'harmonie-alphabet', 'index.html');

test('the deployed slate links to a packaged alphabet exercise and back', () => {
  const target = slate.match(/const ALPHABET_URL\s*=\s*['"]([^'"]+)['"]/);
  assert.ok(target, 'the slate should declare its alphabet route');
  const deployedPath = new URL(target[1], 'https://harmonie.test/').pathname;
  assert.ok(
    fs.existsSync(deployedAlphabetPath),
    'the alphabet exercise must be included under the Vercel app root'
  );
  assert.equal(deployedPath, '/harmonie-alphabet/index.html');

  const alphabet = fs.readFileSync(deployedAlphabetPath, 'utf8');
  assert.match(alphabet, /href=["']\.\.[/]["']/,
    'the deployed alphabet exercise should link back to the app root');
});
