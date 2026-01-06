#!/bin/bash
# Helper script to get Neutralino binaries when update command fails

echo "Getting Neutralino binaries via workaround..."
echo ""

# Clean up any existing temp directories
rm -rf temp-neutralino
rm -rf temp-app

# Create temp directory
mkdir -p temp-neutralino
cd temp-neutralino

# Create a minimal Neutralino app (this downloads binaries)
echo "Creating temp Neutralino app to download binaries..."
npx @neutralinojs/neu create temp-app

# Debug: Show what was created
echo ""
echo "Checking created files..."
ls -la temp-app/ 2>/dev/null | head -5
echo ""

# Copy binaries to main project
BINARY_FOUND=false

# Newer Neutralino versions store binaries in bin/ directory
if [ -d "temp-app/bin" ]; then
  echo "Found binaries in bin/ directory"
  # Copy to .neutralino/bin for backup
  mkdir -p ../.neutralino/bin
  cp -r temp-app/bin/* ../.neutralino/bin/ 2>/dev/null
  # Also copy to project root bin/ (where Neutralino expects them)
  mkdir -p ../bin
  cp -r temp-app/bin/* ../bin/ 2>/dev/null
  chmod +x ../bin/neutralino-mac_arm64 2>/dev/null || true
  chmod +x ../bin/neutralino-mac_x64 2>/dev/null || true
  chmod +x ../bin/neutralino-mac_universal 2>/dev/null || true
  chmod +x ../.neutralino/bin/neutralino-mac_arm64 2>/dev/null || true
  chmod +x ../.neutralino/bin/neutralino-mac_x64 2>/dev/null || true
  chmod +x ../.neutralino/bin/neutralino-mac_universal 2>/dev/null || true
  BINARY_FOUND=true
elif [ -d "temp-app/.neutralino" ]; then
  echo "Found .neutralino directory (older version)"
  mkdir -p ../.neutralino
  cp -r temp-app/.neutralino/* ../.neutralino/ 2>/dev/null
  BINARY_FOUND=true
fi

if [ "$BINARY_FOUND" = true ]; then
  # Copy client library if it exists (to both build/ and root)
  if [ -f "temp-app/resources/js/neutralino.js" ]; then
    mkdir -p ../build
    cp temp-app/resources/js/neutralino.js ../build/ 2>/dev/null
    cp temp-app/resources/js/neutralino.js ../ 2>/dev/null
    echo "✓ Client library copied to build/ and root"
  elif [ -f "temp-app/neutralino.js" ]; then
    mkdir -p ../build
    cp temp-app/neutralino.js ../build/ 2>/dev/null
    cp temp-app/neutralino.js ../ 2>/dev/null
    echo "✓ Client library copied to build/ and root"
  fi

  echo "✓ Binaries copied successfully!"
else
  echo "✗ Failed to find binaries"
  cd ..
  rm -rf temp-neutralino
  exit 1
fi

# Cleanup
cd ..
rm -rf temp-neutralino

echo ""
echo "Done! You can now run: npm run neutralino:dev"

