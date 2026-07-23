const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 Creating Akta portable version...');

// Copy compiled files
const sourceDir = './dist';
const portableDir = './Akta-Portable';

if (fs.existsSync(portableDir)) {
  fs.rmSync(portableDir, { recursive: true });
}

fs.mkdirSync(portableDir, { recursive: true });

// Copy renderer and main
['renderer', 'main'].forEach(dir => {
  const src = path.join(sourceDir, dir);
  const dst = path.join(portableDir, 'dist', dir);
  execSync(`xcopy /E /I /Y "${src}" "${dst}"`, { shell: 'cmd.exe' });
});

// Copy node_modules (simplified - only necessary parts)
const nodeModules = [
  'electron',
  'better-sqlite3',
  'active-win',
  'electron-store',
  'react',
  'react-dom',
  'recharts'
];

console.log('✅ Portable files created in ./Akta-Portable');
