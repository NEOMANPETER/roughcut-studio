const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const releaseDir = path.join(__dirname, '..', 'release');
fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

const ccxPath = path.join(releaseDir, 'RoughCut-Studio-v1.0.0.ccx');

// A .ccx file is a standard ZIP archive containing manifest.json at its root
if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${ccxPath}.zip' -Force"`);
    fs.renameSync(`${ccxPath}.zip`, ccxPath);
} else {
    execSync(`cd "${distDir}" && zip -r "${ccxPath}" .`);
}

console.log('Packaged CCX installer at:', ccxPath);
