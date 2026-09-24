// Copies the Vite production build (dist/) into backend/public so Laravel
// can serve the SPA shell (app.html) and hashed assets. Runs automatically
// after `npm run build` via the package.json "postbuild" hook.
import { existsSync, mkdirSync, readdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(root, 'dist');
const distAssetsDir = join(distDir, 'assets');
const publicDir = join(root, '..', 'backend', 'public');
const publicAssetsDir = join(publicDir, 'assets');

if (!existsSync(distDir)) {
  console.error('[sync-backend-assets] dist/ not found — run `npm run build` first.');
  process.exit(1);
}

// Remove stale hashed assets from previous builds before copying the new ones.
rmSync(publicAssetsDir, { recursive: true, force: true });
mkdirSync(publicAssetsDir, { recursive: true });

for (const file of readdirSync(distAssetsDir)) {
  copyFileSync(join(distAssetsDir, file), join(publicAssetsDir, file));
}

const html = readFileSync(join(distDir, 'index.html'), 'utf8');
writeFileSync(join(publicDir, 'app.html'), html);

console.log('[sync-backend-assets] Synced dist/ -> backend/public/ (app.html + assets/).');
