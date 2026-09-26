// Sets the app version everywhere it is written down.
//   node scripts/bump.mjs 0.2.0
// Then commit, and tag with release notes as the tag message:
//   git tag -a v0.2.0 -m "What's new: ..." && git push origin main v0.2.0
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || '')) { console.error('Usage: node scripts/bump.mjs 1.2.3'); process.exit(1); }
const edit = (file, fn) => { const p = path.join(root, file); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); console.log('updated', file); };
edit('package.json', s => s.replace(/"version": "[^"]+"/, `"version": "${v}"`));
edit('src-tauri/tauri.conf.json', s => s.replace(/"version": "[^"]+"/, `"version": "${v}"`));
edit('src-tauri/Cargo.toml', s => s.replace(/^version = "[^"]+"/m, `version = "${v}"`));
edit('src-tauri/Cargo.lock', s => s.replace(/(name = "gouache-studio"\nversion = )"[^"]+"/, `$1"${v}"`));
