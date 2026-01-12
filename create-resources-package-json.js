const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, 'dist', 'Vivaro.app', 'Contents', 'Resources', 'package.json');
const packageJson = {
  name: 'Resources',
  version: '1.0.0',
  description: 'Resources for Vivaro app bundle',
  private: true,
  scripts: {
    build: 'echo "No build needed in dist directory" && exit 0'
  }
};

// Ensure directory exists
const dir = path.dirname(packageJsonPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Write package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log(`Created ${packageJsonPath}`);

// Create .npmrc to prevent package-lock.json creation
const npmrcPath = path.join(dir, '.npmrc');
fs.writeFileSync(npmrcPath, 'package-lock=false\n');
console.log(`Created ${npmrcPath} to prevent package-lock.json`);

// Also remove package-lock.json and node_modules if they exist (they shouldn't be in dist)
const packageLockPath = path.join(dir, 'package-lock.json');
if (fs.existsSync(packageLockPath)) {
  fs.unlinkSync(packageLockPath);
  console.log(`Removed ${packageLockPath} (not needed in dist)`);
}

// Remove node_modules if it exists (not needed in dist)
const nodeModulesPath = path.join(dir, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  fs.rmSync(nodeModulesPath, { recursive: true, force: true });
  console.log(`Removed ${nodeModulesPath} (not needed in dist)`);
}
