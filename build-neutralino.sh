#!/bin/bash
set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Create version.json from git tag (or package.json) so the built app reports the right version
VERSION=$(git describe --tags 2>/dev/null | sed 's/^v//' || node -p "require('./package.json').version")
echo "{\"version\":\"$VERSION\"}" > version.json

# Build React app
npm run build

# Copy neutralino.js if it exists
if [ -f "neutralino.js" ]; then
  cp neutralino.js build/
  echo "✓ Copied neutralino.js to build/"
else
  echo "⚠ Warning: neutralino.js not found, skipping copy"
fi

# Clean up and copy resources
rm -rf resources
cp -r build resources

# Build Neutralino app
npx @neutralinojs/neu build

# Copy updated server.js and version.json to dist (in case they were modified)
if [ -f "server.js" ] && [ -f "dist/Vivaro.app/Contents/Resources/server.js" ]; then
  cp server.js dist/Vivaro.app/Contents/Resources/server.js
  echo "✓ Updated server.js in dist"
fi
if [ -f "version.json" ] && [ -d "dist/Vivaro.app/Contents/Resources" ]; then
  cp version.json dist/Vivaro.app/Contents/Resources/version.json
  echo "✓ Copied version.json to dist"
fi

# Create package.json in Resources
node create-resources-package-json.js
