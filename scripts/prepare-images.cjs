const fs = require('fs');
const sharp = require('sharp');
const sources = JSON.parse(fs.readFileSync('scripts/generated-assets.local.json', 'utf8').replace(/^\uFEFF/, ''));
Promise.all(Object.entries(sources).map(async ([name, source]) => {
  const info = await sharp(source).metadata();
  await sharp(source).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: name === 'foreground' ? 88 : 85 }).toFile('public/images/' + name + '.webp');
  console.log(name, info.width, info.height, 'alpha:', info.hasAlpha);
})).catch(error => { console.error(error.message); process.exitCode = 1; });
