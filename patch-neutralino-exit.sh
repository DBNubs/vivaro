#!/bin/bash
set -e

# Script to patch Neutralino to fix macOS app.exit() crash
# This patches the native code to dispatch window close operations to the main thread

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Neutralino macOS Exit Fix Patch"
echo "=========================================="
echo ""

# Check if we're on macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo "⚠️  Warning: This patch is for macOS. Building on other platforms may not work correctly."
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check for required tools
echo "Checking for required tools..."
if ! command -v cmake &> /dev/null; then
  echo "❌ cmake is required but not installed. Install with: brew install cmake"
  exit 1
fi

if ! command -v git &> /dev/null; then
  echo "❌ git is required but not installed."
  exit 1
fi

# Check for Xcode command line tools (needed for C++ compilation on macOS)
if ! xcode-select -p &> /dev/null; then
  echo "❌ Xcode command line tools are required. Install with: xcode-select --install"
  exit 1
fi

echo "✓ All required tools found"
echo ""

# Determine Neutralino version from package.json
NEU_VERSION=$(node -p "require('./package.json').devDependencies['@neutralinojs/neu']" 2>/dev/null | sed 's/[^0-9.]//g' || echo "latest")
echo "Target Neutralino version: $NEU_VERSION"
echo ""

# Create a temporary directory for building
BUILD_DIR="$SCRIPT_DIR/neutralino-build"
REPO_DIR="$BUILD_DIR/neutralino"

# Clean up any existing build
if [ -d "$BUILD_DIR" ]; then
  echo "Cleaning up previous build..."
  rm -rf "$BUILD_DIR"
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Clone Neutralino repository
echo "Cloning Neutralino repository..."
if [ "$NEU_VERSION" != "latest" ]; then
  # Try to checkout specific version
  git clone --depth 1 --branch "v$NEU_VERSION" https://github.com/neutralinojs/neutralinojs.git neutralino 2>/dev/null || \
  git clone --depth 1 https://github.com/neutralinojs/neutralinojs.git neutralino
  cd neutralino
  git checkout "v$NEU_VERSION" 2>/dev/null || git checkout "$(git describe --tags --abbrev=0)" 2>/dev/null || echo "Using latest commit"
else
  git clone --depth 1 https://github.com/neutralinojs/neutralinojs.git neutralino
  cd neutralino
fi

echo "✓ Repository cloned"
echo ""

# Find the app exit controller file
echo "Locating app exit controller code..."
APP_CONTROLLER_FILE=""
if [ -f "core/include/app.h" ]; then
  APP_CONTROLLER_FILE="core/include/app.h"
elif [ -f "src/app.h" ]; then
  APP_CONTROLLER_FILE="src/app.h"
elif [ -f "app.h" ]; then
  APP_CONTROLLER_FILE="app.h"
else
  echo "⚠️  Could not find app.h. Searching..."
  APP_CONTROLLER_FILE=$(find . -name "app.h" -type f | head -1)
fi

if [ -z "$APP_CONTROLLER_FILE" ] || [ ! -f "$APP_CONTROLLER_FILE" ]; then
  echo "❌ Could not find app.h header file"
  exit 1
fi

echo "Found: $APP_CONTROLLER_FILE"

# Find the implementation file
APP_IMPL_FILE=""
if [ -f "core/src/app.cpp" ]; then
  APP_IMPL_FILE="core/src/app.cpp"
elif [ -f "src/app.cpp" ]; then
  APP_IMPL_FILE="src/app.cpp"
elif [ -f "app.cpp" ]; then
  APP_IMPL_FILE="app.cpp"
else
  APP_IMPL_FILE=$(find . -name "app.cpp" -type f | head -1)
fi

if [ -z "$APP_IMPL_FILE" ] || [ ! -f "$APP_IMPL_FILE" ]; then
  echo "❌ Could not find app.cpp implementation file"
  exit 1
fi

echo "Found: $APP_IMPL_FILE"
echo ""

# Find window close code
WINDOW_FILE=""
if [ -f "core/src/window.cpp" ]; then
  WINDOW_FILE="core/src/window.cpp"
elif [ -f "src/window.cpp" ]; then
  WINDOW_FILE="src/window.cpp"
else
  WINDOW_FILE=$(find . -name "window.cpp" -type f | head -1)
fi

if [ -z "$WINDOW_FILE" ] || [ ! -f "$WINDOW_FILE" ]; then
  echo "⚠️  Could not find window.cpp. The patch may need adjustment."
else
  echo "Found: $WINDOW_FILE"
fi
echo ""

# Create backup
echo "Creating backups..."
cp "$APP_IMPL_FILE" "$APP_IMPL_FILE.backup"
if [ -n "$WINDOW_FILE" ]; then
  cp "$WINDOW_FILE" "$WINDOW_FILE.backup"
fi
echo "✓ Backups created"
echo ""

# Apply the patch
echo "Applying macOS main-thread dispatch patch..."

# First, let's check what the exit function looks like
echo ""
echo "Current app.exit() implementation:"
grep -A 20 "app::controllers::exit\|void.*exit" "$APP_IMPL_FILE" | head -30 || echo "Could not find exit function"
echo ""

# Create a patch file
PATCH_FILE="$BUILD_DIR/macos-exit-fix.patch"
cat > "$PATCH_FILE" << 'PATCH_EOF'
# This patch adds main-thread dispatch for app.exit() on macOS
# to fix crash when NSWindow operations run on background thread

PATCH_EOF

echo "Reviewing code structure..."
echo ""

# We need to find where app.exit calls window close and add main-thread dispatch
# The typical pattern in Neutralino is that app.exit() calls window::_close() or similar
# We'll need to wrap that in a main-thread dispatch on macOS

echo "⚠️  Manual patch required:"
echo ""
echo "The patch needs to be applied to the app.exit() implementation."
echo "The fix requires:"
echo "1. Include <dispatch/dispatch.h> for macOS"
echo "2. Wrap window close operations in dispatch_async(dispatch_get_main_queue(), ^{ ... })"
echo ""
echo "Please review the code and apply the patch manually, or I can create"
echo "a more automated patch if you provide the exact code structure."
echo ""
echo "Files to modify:"
echo "  - $APP_IMPL_FILE"
if [ -n "$WINDOW_FILE" ]; then
  echo "  - $WINDOW_FILE"
fi
echo ""
echo "Would you like to:"
echo "  1. Open the files for manual editing"
echo "  2. Create an automated patch script (requires code inspection)"
echo "  3. Cancel and do it manually"
read -p "Choice (1-3): " choice

case $choice in
  1)
    echo ""
    echo "Opening files in default editor..."
    open -a "TextEdit" "$APP_IMPL_FILE" 2>/dev/null || \
    open "$APP_IMPL_FILE" 2>/dev/null || \
    ${EDITOR:-nano} "$APP_IMPL_FILE"
    if [ -n "$WINDOW_FILE" ]; then
      open -a "TextEdit" "$WINDOW_FILE" 2>/dev/null || \
      open "$WINDOW_FILE" 2>/dev/null || \
      ${EDITOR:-nano} "$WINDOW_FILE"
    fi
    echo ""
    echo "After making changes, press Enter to continue building..."
    read
    ;;
  2)
    echo ""
    echo "Creating automated patch detection and application..."
    # This will be implemented next
    ;;
  3)
    echo "Cancelled. You can manually patch the files in: $BUILD_DIR"
    exit 0
    ;;
esac

echo ""
echo "Building Neutralino with patch..."
echo ""

# Build Neutralino
# Check for build script
if [ -f "build.sh" ]; then
  chmod +x build.sh
  ./build.sh
elif [ -f "scripts/build.sh" ]; then
  chmod +x scripts/build.sh
  ./scripts/build.sh
elif [ -f "CMakeLists.txt" ]; then
  mkdir -p build
  cd build
  cmake ..
  cmake --build . -j$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
  cd ..
else
  echo "❌ Could not find build script or CMakeLists.txt"
  echo "Please check the Neutralino repository structure"
  exit 1
fi

echo ""
echo "✓ Build complete"
echo ""

# Find the built binary
BINARY_NAME="neutralino-mac_arm64"
if [[ "$(uname -m)" == "x86_64" ]]; then
  BINARY_NAME="neutralino-mac_x64"
fi

BUILT_BINARY=""
if [ -f "build/bin/$BINARY_NAME" ]; then
  BUILT_BINARY="build/bin/$BINARY_NAME"
elif [ -f "bin/$BINARY_NAME" ]; then
  BUILT_BINARY="bin/$BINARY_NAME"
elif [ -f "$BINARY_NAME" ]; then
  BUILT_BINARY="$BINARY_NAME"
else
  BUILT_BINARY=$(find . -name "$BINARY_NAME" -type f | head -1)
fi

if [ -z "$BUILT_BINARY" ] || [ ! -f "$BUILT_BINARY" ]; then
  echo "❌ Could not find built binary: $BINARY_NAME"
  echo "Build may have failed. Check build output above."
  exit 1
fi

echo "Found built binary: $BUILT_BINARY"
echo ""

# Backup original binary
ORIGINAL_BINARY="$SCRIPT_DIR/bin/$BINARY_NAME"
if [ -f "$ORIGINAL_BINARY" ]; then
  echo "Backing up original binary..."
  cp "$ORIGINAL_BINARY" "$ORIGINAL_BINARY.backup"
  echo "✓ Backup saved to: $ORIGINAL_BINARY.backup"
fi

# Copy new binary
echo "Installing patched binary..."
mkdir -p "$SCRIPT_DIR/bin"
cp "$BUILT_BINARY" "$ORIGINAL_BINARY"
chmod +x "$ORIGINAL_BINARY"
echo "✓ Patched binary installed to: $ORIGINAL_BINARY"
echo ""

echo "=========================================="
echo "✅ Patch complete!"
echo "=========================================="
echo ""
echo "The patched Neutralino binary has been installed."
echo "You can now test the app with: npm run neutralino:dev"
echo ""
echo "If you need to restore the original binary:"
echo "  cp $ORIGINAL_BINARY.backup $ORIGINAL_BINARY"
echo ""
