const { readFileSync, existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = join(__dirname, '..', 'extension');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json')));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
const resources = [manifest.action.default_popup, ...Object.values(manifest.action.default_icon), ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap(script => [...script.js, ...script.css])];
for (const resource of resources) assert.ok(existsSync(join(root, resource)), `Missing ${resource}`);
for (const file of readdirSync(root).filter(file => file.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' });
}
console.log('Manifest, packaged resources, permissions and JavaScript syntax verified.');
