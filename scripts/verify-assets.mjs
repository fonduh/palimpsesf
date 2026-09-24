import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(resolve(root, name), 'utf8');
const data = name => JSON.parse(read(name).split('=').slice(1).join('=').trim().replace(/;$/, ''));
const assets = readdirSync(resolve(root, 'geotag/thumbs')).filter(f => f.endsWith('.jpg'))
  .sort().map(f => 'geotag/thumbs/' + f);
const available = new Set(assets);
for (const asset of assets) {
  const bytes = readFileSync(resolve(root, asset));
  assert(bytes.length > 100 && bytes[0] === 255 && bytes[1] === 216, `Invalid JPEG: ${asset}`);
}
const index = data('mvp-index.js');
const landmarks = data('geotag/landmarks-data.js');
for (const entries of Object.values(index)) for (const entry of entries) {
  assert(available.has(`geotag/thumbs/${entry[1]}.jpg`), `Missing image: ${entry[1]}`);
}
for (const landmark of landmarks) for (const entry of landmark.timeline || []) {
  if (entry.t === 'photo') assert(available.has(`geotag/thumbs/${entry.recid}.jpg`), `Missing landmark image: ${entry.recid}`);
}
const geo = JSON.parse(read('geotag/photos.geojson'));
assert.deepEqual(geo, data('geotag/photos-data.js'));
assert.equal(read('index.html'), read('palimpsest.html'));
const manifest = 'window.PHOTO_ASSETS=' + JSON.stringify(assets) + ';\n';
if (process.argv.includes('--write')) writeFileSync(resolve(root, 'photo-assets.js'), manifest);
else assert.equal(read('photo-assets.js'), manifest, 'Regenerate the image manifest with --write');
console.log(`${assets.length} local images; ${Object.keys(index).length} indexed parcels; ${geo.features.length} archive records verified.`);
