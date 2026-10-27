const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = process.cwd();
const masterRoot = path.join(root, 'output/halloween-2026');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async () => {
  const plan = JSON.parse(await fs.readFile(path.join(masterRoot, 'conversation-photos/production.json'), 'utf8'));
  const delivered = [];
  for (const photo of plan.photos) {
    if (!photo.source) continue;
    const original = await fs.readFile(photo.source);
    const png = path.join(masterRoot, photo.png);
    const webp = path.join(root, photo.webp);
    await fs.mkdir(path.dirname(png), {recursive:true});
    await fs.mkdir(path.dirname(webp), {recursive:true});
    try { await fs.writeFile(png, original, {flag:'wx'}); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (digest(await fs.readFile(png)) !== digest(original)) throw new Error('Refusing to overwrite different master: '+png);
    }
    try { await fs.access(webp); }
    catch { await sharp(png).webp({quality:84, effort:6}).toFile(webp); }
    const metadata = await sharp(webp).metadata();
    if (metadata.width !== 1672 || metadata.height !== 941) throw new Error('Unexpected photograph dimensions');
    const webpBytes = await fs.readFile(webp);
    delivered.push({...photo, width:metadata.width, height:metadata.height, pngBytes:original.length, webpBytes:webpBytes.length, sha256:digest(webpBytes)});
  }
  const manifestPath = path.join(masterRoot, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.conversationPhotos = delivered;
  await fs.writeFile(manifestPath, JSON.stringify(manifest,null,2)+'\n');
  process.stdout.write(JSON.stringify(delivered.map(p=>({id:p.id, pngBytes:p.pngBytes, webpBytes:p.webpBytes, width:p.width, height:p.height})),null,2)+'\n');
})();
