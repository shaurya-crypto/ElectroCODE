/**
 * electron-builder afterPack hook
 * Copies node_modules into the extraResources that electron-builder refuses to bundle.
 */
const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      // Skip .cache and other unnecessary dirs
      if (entry.name === '.cache' || entry.name === '.package-lock.json') continue;
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

exports.default = async function afterPack(context) {
  const resourcesDir = path.join(context.appOutDir, 'resources', '_internal');
  // __dirname = frontend/scripts/ → go up TWO levels to reach the project root (ElectroAI/)
  const projectRoot = path.resolve(__dirname, '..', '..');
  
  const targets = [
    { from: path.join(projectRoot, 'mcp-server', 'node_modules'), to: path.join(resourcesDir, 'mcp-server', 'node_modules') },
    { from: path.join(projectRoot, 'ai-engine', 'node_modules'), to: path.join(resourcesDir, 'ai-engine', 'node_modules') },
  ];

  for (const { from, to } of targets) {
    if (fs.existsSync(from)) {
      console.log(`  • [afterPack] Copying ${path.basename(path.dirname(from))}/node_modules...`);
      copyDirSync(from, to);
      const count = fs.readdirSync(to).length;
      console.log(`  • [afterPack] ✓ Copied ${count} packages`);
    } else {
      console.warn(`  • [afterPack] ⚠ Not found: ${from}`);
    }
  }
};
