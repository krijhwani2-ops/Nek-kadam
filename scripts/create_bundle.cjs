const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const distDir = path.join(__dirname, '..', 'dist');
const bundlePath = path.join(distDir, 'bundle.zip');
const publicBundlePath = path.join(__dirname, '..', 'public', 'bundle.zip');

if (!fs.existsSync(distDir)) {
  console.error('dist directory does not exist! Run npm run build first.');
  process.exit(1);
}

// Remove old bundle if exists
if (fs.existsSync(bundlePath)) {
  fs.unlinkSync(bundlePath);
}

console.log('[BUNDLE] Packaging web assets from dist/ into bundle.zip...');
const output = fs.createWriteStream(bundlePath);
const ArchiveClass = archiver.ZipArchive || (typeof archiver === 'function' ? archiver : archiver.Archiver);
const archive = typeof archiver === 'function' ? archiver('zip', { zlib: { level: 9 } }) : new ArchiveClass({ zlib: { level: 9 } });

output.on('close', () => {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`[BUNDLE] Bundle created successfully: ${bundlePath} (${sizeMB} MB)`);
  
  // Also copy to public directory for Vite builds
  try {
    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    fs.copyFileSync(bundlePath, publicBundlePath);
    console.log(`[BUNDLE] Copied to public/bundle.zip`);
  } catch (err) {
    console.warn('[BUNDLE] Warning copying to public:', err.message);
  }
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add all files from dist except apk folder and existing zip files
const files = fs.readdirSync(distDir);
for (const file of files) {
  if (file === 'apk' || file === 'bundle.zip' || file.endsWith('.apk') || file.endsWith('.zip')) {
    continue;
  }
  const fullPath = path.join(distDir, file);
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    archive.directory(fullPath, file);
  } else {
    archive.file(fullPath, { name: file });
  }
}

archive.finalize();
