const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Electron Builder afterPack hook
 * Ensures all required dependencies are included in the build
 */
exports.default = async function(context) {
  const { appOutDir } = context;

  // Find the .app bundle - it should be in appOutDir
  let appBundlePath;
  try {
    const appBundleName = context.packager.appInfo.productFilename + '.app';
    appBundlePath = path.join(appOutDir, appBundleName);

    // Verify the bundle exists, if not, try to find it
    if (!fs.existsSync(appBundlePath)) {
      console.log(`App bundle not found at ${appBundlePath}, searching...`);
      const files = fs.readdirSync(appOutDir);
      const appBundle = files.find(f => f.endsWith('.app'));
      if (appBundle) {
        appBundlePath = path.join(appOutDir, appBundle);
        console.log(`Found app bundle: ${appBundlePath}`);
      }
    }
  } catch (error) {
    console.warn(`Could not determine app bundle name: ${error.message}`);
    // Fallback: look for .app in appOutDir
    const files = fs.readdirSync(appOutDir);
    const appBundle = files.find(f => f.endsWith('.app'));
    if (appBundle) {
      appBundlePath = path.join(appOutDir, appBundle);
    } else {
      throw new Error('Could not find .app bundle in appOutDir');
    }
  }

  // Use the correct path structure for macOS .app bundles
  const appResourcesPath = path.join(appBundlePath, 'Contents', 'Resources', 'app');
  const sourceNodeModules = path.join(__dirname, 'node_modules');
  const targetNodeModules = path.join(appResourcesPath, 'node_modules');

  console.log('=== AFTERPACK HOOK STARTING ===');
  console.log(`App out dir: ${appOutDir}`);
  console.log(`App bundle path: ${appBundlePath}`);
  console.log(`App bundle exists: ${fs.existsSync(appBundlePath)}`);
  console.log(`Source node_modules: ${sourceNodeModules}`);
  console.log(`Target node_modules: ${targetNodeModules}`);
  console.log(`App resources path: ${appResourcesPath}`);

  // Ensure app resources directory exists
  if (!fs.existsSync(appResourcesPath)) {
    console.log(`Creating app resources directory: ${appResourcesPath}`);
    fs.mkdirSync(appResourcesPath, { recursive: true });
  }

  // Write a marker file to verify hook ran
  try {
    const markerFile = path.join(appResourcesPath, '.afterpack-ran');
    fs.writeFileSync(markerFile, new Date().toISOString());
    console.log(`Marker file written: ${markerFile}`);
  } catch (markerError) {
    console.warn(`Could not write marker file: ${markerError.message}`);
  }

  // List of critical dependencies that must be included
  const criticalDeps = [
    'call-bind-apply-helpers',
    'call-bound',
    'side-channel-map',
  ];

  // Ensure target node_modules directory exists
  if (!fs.existsSync(targetNodeModules)) {
    console.log(`Creating target node_modules directory: ${targetNodeModules}`);
    fs.mkdirSync(targetNodeModules, { recursive: true });
  }

  for (const dep of criticalDeps) {
    const sourcePath = path.join(sourceNodeModules, dep);
    const targetPath = path.join(targetNodeModules, dep);

    console.log(`Checking ${dep}...`);
    console.log(`  Source: ${sourcePath} (exists: ${fs.existsSync(sourcePath)})`);
    console.log(`  Target: ${targetPath} (exists: ${fs.existsSync(targetPath)})`);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`Warning: ${dep} not found in source node_modules at ${sourcePath}`);
      continue;
    }

    // Always copy to ensure completeness (remove target first if it exists)
    console.log(`Copying dependency: ${dep} (will overwrite if exists)`);
    try {
      // Remove target if it exists to ensure clean copy
      if (fs.existsSync(targetPath)) {
        console.log(`  Removing existing ${dep} at target...`);
        removeRecursiveSync(targetPath);
      }

      // Try using cp command first (more reliable on macOS)
      try {
        const sourceEscaped = sourcePath.replace(/'/g, "'\\''");
        const targetEscaped = path.dirname(targetPath).replace(/'/g, "'\\''");
        execSync(`cp -R '${sourceEscaped}' '${targetEscaped}/'`, { stdio: 'inherit' });
        console.log(`Successfully copied ${dep} using cp command`);
      } catch (cpError) {
        console.log(`cp command failed, falling back to manual copy: ${cpError.message}`);
        // Fallback to manual copy
        copyRecursiveSync(sourcePath, targetPath);
        console.log(`Successfully copied ${dep} using manual copy`);
      }

      // Verify it was copied
      if (fs.existsSync(targetPath)) {
        const stats = fs.statSync(targetPath);
        console.log(`Verified: ${dep} exists at target (${stats.isDirectory() ? 'directory' : 'file'})`);
      } else {
        console.error(`ERROR: ${dep} was not copied successfully - target does not exist`);
        throw new Error(`Failed to copy ${dep} - verification failed`);
      }
    } catch (error) {
      console.error(`Failed to copy ${dep}:`, error.message);
      console.error(error.stack);
      // Don't throw - continue with other dependencies
    }
  }

  console.log('=== AFTERPACK HOOK COMPLETE ===');
  console.log('Summary:');
  for (const dep of criticalDeps) {
    const targetPath = path.join(targetNodeModules, dep);
    const exists = fs.existsSync(targetPath);
    console.log(`  ${dep}: ${exists ? '✓ COPIED' : '✗ MISSING'}`);
  }
};

function removeRecursiveSync(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    fs.readdirSync(targetPath).forEach(childItemName => {
      removeRecursiveSync(path.join(targetPath, childItemName));
    });
    fs.rmdirSync(targetPath);
  } else {
    fs.unlinkSync(targetPath);
  }
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

