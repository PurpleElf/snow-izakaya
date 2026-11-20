import { build } from 'esbuild';
import fs from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  minify: false,
  logLevel: 'info',
});

const bundle = result.outputFiles[0].text;
const template = fs.readFileSync('src/template.html', 'utf8');
const html = template.replace('/*__SCENE_BUNDLE__*/', () => bundle);
fs.writeFileSync('index.html', html);
fs.writeFileSync('snow-izakaya.html', html);
console.log(`Built index.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
