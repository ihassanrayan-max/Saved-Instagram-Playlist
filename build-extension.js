import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');

// Files to copy from public to dist
const filesToCopy = [
  'manifest.json',
  'icon16.png',
  'icon48.png',
  'icon128.png',
  'robots.txt'
];

console.log('📦 Building Chrome Extension...\n');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy files
filesToCopy.forEach(file => {
  const src = path.join(publicDir, file);
  const dest = path.join(distDir, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${file}`);
  } else {
    console.warn(`⚠ Warning: ${file} not found in public/`);
  }
});

console.log('\n✅ Extension build complete!');
console.log('📁 Extension files are in the dist/ folder');
console.log('\n📝 Next steps:');
console.log('  1. Open Chrome and go to chrome://extensions/');
console.log('  2. Enable "Developer mode" (top right)');
console.log('  3. Click "Load unpacked" and select the dist/ folder');
console.log('  4. Visit Instagram saved collections to test!\n');
