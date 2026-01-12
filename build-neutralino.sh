#!/bin/bash
set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

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

# Copy updated server.js to dist (in case it was modified)
if [ -f "server.js" ] && [ -f "dist/Vivaro.app/Contents/Resources/server.js" ]; then
  cp server.js dist/Vivaro.app/Contents/Resources/server.js
  echo "✓ Updated server.js in dist"
fi

# Create package.json in Resources
node create-resources-package-json.js
