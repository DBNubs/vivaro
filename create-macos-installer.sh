#!/bin/bash
# Script to create a macOS .app bundle and DMG installer

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="Vivaro"
BUNDLE_NAME="${APP_NAME}.app"
DMG_NAME="${APP_NAME}-Installer.dmg"
BUILD_DIR="dist/vivaro"
BUNDLE_DIR="dist/${BUNDLE_NAME}"
CONTENTS_DIR="${BUNDLE_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

# Create/overwrite version.json from git tag (or package.json) so the app reports the correct version
VERSION=$(git describe --tags 2>/dev/null | sed 's/^v//' || node -p "require('./package.json').version")
echo "{\"version\":\"$VERSION\"}" > version.json

echo "Creating macOS app bundle..."

# Clean up any existing bundle
rm -rf "${BUNDLE_DIR}"

# Create app bundle structure
mkdir -p "${MACOS_DIR}"
mkdir -p "${RESOURCES_DIR}"

# Copy the executable to Resources first
if [ -f "${BUILD_DIR}/vivaro-mac_arm64" ]; then
  cp "${BUILD_DIR}/vivaro-mac_arm64" "${RESOURCES_DIR}/vivaro-mac_arm64"
  chmod +x "${RESOURCES_DIR}/vivaro-mac_arm64"
  echo "✓ Copied ARM64 binary to Resources"
elif [ -f "${BUILD_DIR}/vivaro-mac_x64" ]; then
  cp "${BUILD_DIR}/vivaro-mac_x64" "${RESOURCES_DIR}/vivaro-mac_x64"
  chmod +x "${RESOURCES_DIR}/vivaro-mac_x64"
  echo "✓ Copied x64 binary to Resources"
else
  echo "✗ No binary found in ${BUILD_DIR}"
  exit 1
fi

# Copy resources
if [ -f "${BUILD_DIR}/resources.neu" ]; then
  cp "${BUILD_DIR}/resources.neu" "${RESOURCES_DIR}/"
  echo "✓ Copied resources.neu"
fi

# Copy extensions if they exist
if [ -d "${BUILD_DIR}/extensions" ]; then
  cp -r "${BUILD_DIR}/extensions" "${RESOURCES_DIR}/"
  echo "✓ Copied extensions"
fi

# Copy React build directory (required for serving the app)
if [ -d "build" ]; then
  cp -r build "${RESOURCES_DIR}/"
  echo "✓ Copied React build directory"
else
  echo "⚠ Warning: build directory not found. Make sure to run 'npm run build' first!"
fi

# Copy server.js, version.json, and necessary files to Resources
if [ -f "server.js" ]; then
  cp server.js "${RESOURCES_DIR}/"
  echo "✓ Copied server.js"
fi
if [ -f "version.json" ]; then
  cp version.json "${RESOURCES_DIR}/"
  echo "✓ Copied version.json"
fi

# Copy necessary node_modules (only production dependencies for Express server)
# The server only needs: express, cors, multer (and their dependencies)
# We'll install only production dependencies in a temp directory to avoid copying dev deps
if [ -d "node_modules" ]; then
  echo "Preparing production node_modules (this may take a moment)..."

  # Create a temporary directory for production dependencies
  TEMP_PROD_DIR="dist/temp_prod_node_modules"
  rm -rf "${TEMP_PROD_DIR}"
  mkdir -p "${TEMP_PROD_DIR}"

  # Create a minimal package.json with only the server dependencies
  cat > "${TEMP_PROD_DIR}/package.json" << 'PKG_EOF'
{
  "name": "vivaro-server-deps",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1"
  }
}
PKG_EOF

  # Install only production dependencies (this will be much smaller)
  echo "Installing production dependencies..."
  cd "${TEMP_PROD_DIR}"
  npm install --production --silent 2>/dev/null || npm install --production 2>&1 | head -20
  cd - > /dev/null

  # Copy the production node_modules to the app bundle
  if [ -d "${TEMP_PROD_DIR}/node_modules" ]; then
    echo "Copying production dependencies to app bundle..."
    mkdir -p "${RESOURCES_DIR}/node_modules"
    cp -r "${TEMP_PROD_DIR}/node_modules"/* "${RESOURCES_DIR}/node_modules/" 2>/dev/null
    rm -rf "${TEMP_PROD_DIR}"
    echo "✓ Copied production node_modules"
  else
    echo "⚠ Warning: Failed to install production dependencies, falling back to manual copy"
    # Fallback: copy only essential modules
    mkdir -p "${RESOURCES_DIR}/node_modules"
    ESSENTIAL_MODULES=("express" "cors" "multer")
    for module in "${ESSENTIAL_MODULES[@]}"; do
      if [ -d "node_modules/${module}" ]; then
        cp -r "node_modules/${module}" "${RESOURCES_DIR}/node_modules/" 2>/dev/null || true
      fi
    done
    echo "✓ Copied essential modules (may be incomplete)"
  fi
fi

# Create launcher script that starts server then Neutralino
# This will be the main executable (macOS allows shell scripts as executables)
cat > "${MACOS_DIR}/${APP_NAME}" << 'LAUNCHER_EOF'
#!/bin/bash
# Launcher script for Vivaro - starts Express server then Neutralino

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# This script is in Contents/MacOS, so go up one level to Contents, then to Resources
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RESOURCES_DIR="${APP_DIR}/Resources"
MACOS_DIR="${APP_DIR}/MacOS"

# Get data directory
DATA_DIR="${HOME}/.vivaro/data"
mkdir -p "${DATA_DIR}"

# Set up paths
SERVER_JS="${RESOURCES_DIR}/server.js"
export PORT=3001
export NEUTRALINO=1
export DATA_DIR="${DATA_DIR}"
export NODE_PATH="${RESOURCES_DIR}"

# Verify server.js exists
if [ ! -f "${SERVER_JS}" ]; then
  osascript -e "display dialog \"server.js not found at ${SERVER_JS}\" buttons {\"OK\"} default button \"OK\"" > /dev/null 2>&1
  exit 1
fi

# Find node executable
NODE_CMD=$(which node)
if [ -z "$NODE_CMD" ]; then
  # Try common locations
  if [ -f "/usr/local/bin/node" ]; then
    NODE_CMD="/usr/local/bin/node"
  elif [ -f "/opt/homebrew/bin/node" ]; then
    NODE_CMD="/opt/homebrew/bin/node"
  else
    osascript -e 'display dialog "Node.js not found. Please install Node.js to run Vivaro." buttons {"OK"} default button "OK"' > /dev/null 2>&1
    exit 1
  fi
fi

# Start Express server in background for API calls (Neutralino serves React app directly)
# Check if server is already running
if lsof -ti:3001 > /dev/null 2>&1; then
  echo "Server already running on port 3001"
else
  # Start server from Resources directory (so relative paths in server.js work)
  # Start in background - don't wait, Neutralino serves the React app directly
  (cd "${RESOURCES_DIR}" && env PORT=3001 NEUTRALINO=1 NODE_ENV=production DATA_DIR="${DATA_DIR}" NODE_PATH="${RESOURCES_DIR}" "${NODE_CMD}" ./server.js > "${DATA_DIR}/server.log" 2>&1) &
  SERVER_PID=$!

  # Give server a moment to start (but don't block - Neutralino doesn't need it for the UI)
  sleep 1
fi

# Copy binary from Resources to MacOS (launcher will use it)
if [ -f "${RESOURCES_DIR}/vivaro-mac_arm64" ]; then
  cp "${RESOURCES_DIR}/vivaro-mac_arm64" "${MACOS_DIR}/vivaro-mac_arm64"
  chmod +x "${MACOS_DIR}/vivaro-mac_arm64"
  BINARY_NAME="vivaro-mac_arm64"
elif [ -f "${RESOURCES_DIR}/vivaro-mac_x64" ]; then
  cp "${RESOURCES_DIR}/vivaro-mac_x64" "${MACOS_DIR}/vivaro-mac_x64"
  chmod +x "${MACOS_DIR}/vivaro-mac_x64"
  BINARY_NAME="vivaro-mac_x64"
elif [ -f "${RESOURCES_DIR}/vivaro-mac_universal" ]; then
  cp "${RESOURCES_DIR}/vivaro-mac_universal" "${MACOS_DIR}/vivaro-mac_universal"
  chmod +x "${MACOS_DIR}/vivaro-mac_universal"
  BINARY_NAME="vivaro-mac_universal"
else
  osascript -e 'display dialog "Neutralino binary not found." buttons {"OK"} default button "OK"' > /dev/null 2>&1
  exit 1
fi

# Launch Neutralino binary
# CRITICAL: Run from Resources directory where resources.neu is located
# Neutralino looks for resources.neu in the current working directory
cd "${RESOURCES_DIR}"
# Give one final moment for server to be fully ready
sleep 0.5
# Run the binary from Resources directory - it will find resources.neu here
# Use the binary from Resources (not MacOS) so paths resolve correctly
exec "${RESOURCES_DIR}/${BINARY_NAME}"

# Cleanup on exit
trap "pkill -f 'node.*server.js' 2>/dev/null" EXIT
LAUNCHER_EOF

chmod +x "${MACOS_DIR}/${APP_NAME}"
echo "✓ Created launcher as main executable"

# Create Info.plist - use launcher script as executable
cat > "${CONTENTS_DIR}/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>${APP_NAME}</string>
  <key>CFBundleIdentifier</key>
  <string>com.lullabot.pm-dashboard</string>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF
echo "✓ Created Info.plist"

# Copy icon if it exists
if [ -f "icon.png" ]; then
  # Convert to .icns if iconutil is available
  if command -v iconutil &> /dev/null; then
    ICONSET_DIR="temp.iconset"
    mkdir -p "${ICONSET_DIR}"
    sips -z 16 16 icon.png --out "${ICONSET_DIR}/icon_16x16.png" 2>/dev/null || cp icon.png "${ICONSET_DIR}/icon_16x16.png"
    sips -z 32 32 icon.png --out "${ICONSET_DIR}/icon_16x16@2x.png" 2>/dev/null || cp icon.png "${ICONSET_DIR}/icon_16x16@2x.png"
    sips -z 32 32 icon.png --out "${ICONSET_DIR}/icon_32x32.png" 2>/dev/null || cp icon.png "${ICONSET_DIR}/icon_32x32.png"
    sips -z 64 64 icon.png --out "${ICONSET_DIR}/icon_32x32@2x.png" 2>/dev/null || cp icon.png "${ICONSET_DIR}/icon_32x32@2x.png"
    sips -z 128 128 icon.png --out "${ICONSET_DIR}/icon_128x128.png" 2>/dev/null || cp icon.png "${ICONSET_DIR}/icon_128x128.png"
    sips -z 256 256 icon.png --out "${ICONSET_DIR}/icon_128x128@2x.png" 2>/dev/null || cp icon.png "${ICONSET_DIR}/icon_128x128@2x.png"
    sips -z 256 256 icon.png --out "${ICONSET_DIR}/icon_256x256.png" 2>/dev/null || cp icon.png "${ICONSET_DIR}/icon_256x256.png"
    sips -z 512 512 icon.png --out "${ICONSET_DIR}/icon_256x256@2x.png" 2>/dev/null || cp icon.png "${ICONSET_DIR}/icon_256x256@2x.png"
    sips -z 512 512 icon.png --out "${ICONSET_DIR}/icon_512x512.png" 2>/dev/null || cp icon.png "${ICONSET_DIR}/icon_512x512.png"
    sips -z 1024 1024 icon.png --out "${ICONSET_DIR}/icon_512x512@2x.png" 2>/dev/null || cp icon.png "${ICONSET_DIR}/icon_512x512@2x.png"
    iconutil -c icns "${ICONSET_DIR}" -o "${RESOURCES_DIR}/AppIcon.icns" 2>/dev/null || cp icon.png "${RESOURCES_DIR}/AppIcon.icns"
    rm -rf "${ICONSET_DIR}"
    echo "✓ Created app icon"
  else
    cp icon.png "${RESOURCES_DIR}/AppIcon.icns"
    echo "✓ Copied app icon (not converted to .icns)"
  fi
fi

echo ""
echo "✓ App bundle created at: ${BUNDLE_DIR}"
echo "  Size: $(du -sh "${BUNDLE_DIR}" | cut -f1)"

# Create DMG if hdiutil is available
if command -v hdiutil &> /dev/null; then
  echo ""
  echo "Creating DMG installer..."

  DMG_TEMP="dist/dmg_temp"
  rm -rf "${DMG_TEMP}" "${DMG_NAME}"
  mkdir -p "${DMG_TEMP}"

  # Copy app to DMG
  cp -R "${BUNDLE_DIR}" "${DMG_TEMP}/"

  # Create Applications symlink
  ln -s /Applications "${DMG_TEMP}/Applications"

  # Create DMG
  hdiutil create -volname "${APP_NAME}" -srcfolder "${DMG_TEMP}" -ov -format UDZO "dist/${DMG_NAME}"

  # Clean up
  rm -rf "${DMG_TEMP}"

  echo "✓ DMG created at: dist/${DMG_NAME}"
  echo "  Size: $(du -sh "dist/${DMG_NAME}" | cut -f1)"
  echo ""
  echo "Users can double-click the DMG to install!"
else
  echo ""
  echo "hdiutil not found - skipping DMG creation"
  echo "App bundle is ready at: ${BUNDLE_DIR}"
  echo "Users can drag it to Applications folder"
fi

echo ""
echo "Done! 🎉"

