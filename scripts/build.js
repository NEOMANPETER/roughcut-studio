const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

fs.copyFileSync(path.join(__dirname, '..', 'manifest.json'), path.join(distDir, 'manifest.json'));
fs.copyFileSync(path.join(__dirname, '..', 'src', 'index.html'), path.join(distDir, 'index.html'));
fs.copyFileSync(path.join(__dirname, '..', 'src', 'main.js'), path.join(distDir, 'main.js'));

console.log('Built plugin into dist/');
