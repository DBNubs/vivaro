#!/bin/bash
set -e

# Complete script to fix Neutralino macOS exit crash
# This clones Neutralino, patches it, builds it, and installs it

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Neutralino macOS Exit Fix"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Clone Neutralino source code"
echo "  2. Patch app.exit() to use main thread on macOS"
echo "  3. Build the patched binary"
echo "  4. Install it to replace the current binary"
echo ""
read -p "Continue? (Y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
  exit 0
fi

# Check tools
echo ""
echo "Checking prerequisites..."
MISSING_TOOLS=()

if ! command -v cmake &> /dev/null; then
  MISSING_TOOLS+=("cmake")
fi

if ! command -v git &> /dev/null; then
  MISSING_TOOLS+=("git")
fi

if ! command -v python3 &> /dev/null; then
  MISSING_TOOLS+=("python3")
fi

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
  echo "❌ Missing required tools: ${MISSING_TOOLS[*]}"
  echo "Install with: brew install ${MISSING_TOOLS[*]}"
  exit 1
fi

if ! xcode-select -p &> /dev/null; then
  echo "❌ Xcode command line tools required"
  echo "Install with: xcode-select --install"
  exit 1
fi

echo "✓ All prerequisites met"
echo ""

# Get Neutralino version
NEU_VERSION=$(node -p "require('./package.json').devDependencies['@neutralinojs/neu']" 2>/dev/null | sed 's/[^0-9.]//g' || echo "")
echo "Neutralino version from package.json: ${NEU_VERSION:-not specified, using latest}"
echo ""

# Setup build directory
BUILD_DIR="$SCRIPT_DIR/neutralino-build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Clone Neutralino
echo "Cloning Neutralino repository..."
if [ -n "$NEU_VERSION" ] && [ "$NEU_VERSION" != "latest" ]; then
  # Try to clone specific version
  git clone --depth 50 https://github.com/neutralinojs/neutralinojs.git neutralino
  cd neutralino
  # Try to checkout version tag
  if git tag | grep -q "v${NEU_VERSION}"; then
    git checkout "v${NEU_VERSION}" 2>/dev/null || git checkout "$(git describe --tags --abbrev=0)" 2>/dev/null
    echo "✓ Checked out version v${NEU_VERSION}"
  else
    echo "⚠️  Version v${NEU_VERSION} not found, using latest"
  fi
else
  git clone --depth 1 https://github.com/neutralinojs/neutralinojs.git neutralino
  cd neutralino
  echo "✓ Using latest version"
fi

echo ""

# Find source files
echo "Locating source files..."
APP_CPP=$(find . -path "*/core/src/app.cpp" -o -path "*/src/app.cpp" | head -1)
WINDOW_CPP=$(find . -path "*/core/src/window.cpp" -o -path "*/src/window.cpp" | head -1)

if [ -z "$APP_CPP" ]; then
  echo "❌ Could not find app.cpp"
  exit 1
fi

echo "Found: $APP_CPP"
if [ -n "$WINDOW_CPP" ]; then
  echo "Found: $WINDOW_CPP"
fi
echo ""

# Show the exit function
echo "Current app::controllers::exit implementation:"
echo "----------------------------------------"
grep -A 30 "app::controllers::exit\|void.*exit.*json" "$APP_CPP" | head -40 || echo "Could not find exit function"
echo "----------------------------------------"
echo ""

# Create backup
cp "$APP_CPP" "$APP_CPP.backup"
echo "✓ Created backup: $APP_CPP.backup"
echo ""

# Apply patch using a more robust method
echo "Applying patch..."

# Create Python patcher
cat > patch_exit.py << 'PYEOF'
#!/usr/bin/env python3
import re
import sys

def patch_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()

    # Add dispatch include if needed
    has_dispatch = any('#include <dispatch/dispatch.h>' in line or
                      '#include "dispatch/dispatch.h"' in line for line in lines)

    if not has_dispatch:
        # Find last #include
        last_include_idx = -1
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].strip().startswith('#include'):
                last_include_idx = i
                break

        if last_include_idx >= 0:
            lines.insert(last_include_idx + 1, '\n')
            lines.insert(last_include_idx + 2, '#ifdef __APPLE__\n')
            lines.insert(last_include_idx + 3, '#include <dispatch/dispatch.h>\n')
            lines.insert(last_include_idx + 4, '#endif\n')

    # Find exit function
    content = ''.join(lines)

    # Pattern: void app::controllers::exit(const json &input) { ... }
    pattern = r'(void\s+app::controllers::exit\s*\([^)]*\)\s*\{)'

    match = re.search(pattern, content)
    if not match:
        print("Could not find app::controllers::exit function")
        return False

    # Check if already patched
    if 'dispatch_get_main_queue' in content[match.start():]:
        print("Already patched (found dispatch_get_main_queue)")
        return False

    # Find function body
    start_pos = match.end()
    brace_count = 1
    i = start_pos
    while i < len(content) and brace_count > 0:
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
        i += 1

    func_end = i - 1
    func_body = content[start_pos:func_end]

    # Check if function body has window operations
    window_patterns = [
        r'window::_close',
        r'window::close',
        r'window.*->close',
        r'_close\s*\(',
    ]

    has_window_ops = any(re.search(p, func_body) for p in window_patterns)

    if not has_window_ops:
        print("Warning: Could not find window close operations in exit function")
        print("Function body preview:")
        print(func_body[:300])
        print("\nProceeding with full function body wrap...")

    # Wrap function body
    new_body = '''#ifdef __APPLE__
    dispatch_async(dispatch_get_main_queue(), ^{
''' + func_body + '''    });
#else
''' + func_body + '''#endif'''

    new_content = content[:start_pos] + new_body + content[func_end:]

    with open(filepath, 'w') as f:
        f.write(new_content)

    return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: patch_exit.py <app.cpp>")
        sys.exit(1)

    if patch_file(sys.argv[1]):
        print("✓ Patch applied successfully")
    else:
        print("✗ Patch failed")
        sys.exit(1)
PYEOF

chmod +x patch_exit.py

# Apply patch
python3 patch_exit.py "$APP_CPP"

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Patch failed. You may need to apply it manually."
  echo "See the code above and wrap window close operations in:"
  echo "  #ifdef __APPLE__"
  echo "  dispatch_async(dispatch_get_main_queue(), ^{"
  echo "    // window close code"
  echo "  });"
  echo "  #else"
  echo "  // original code"
  echo "  #endif"
  exit 1
fi

echo ""
echo "Showing patch diff:"
echo "----------------------------------------"
diff -u "$APP_CPP.backup" "$APP_CPP" | head -60 || true
echo "----------------------------------------"
echo ""

read -p "Patch looks good? Continue with build? (Y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
  echo "Patch applied but build cancelled. Restore with:"
  echo "  cp $APP_CPP.backup $APP_CPP"
  exit 0
fi

# Build
echo ""
echo "Building Neutralino (this may take several minutes)..."
echo ""

if [ -f "CMakeLists.txt" ]; then
  mkdir -p build
  cd build
  cmake .. -DCMAKE_BUILD_TYPE=Release
  cmake --build . -j$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
  cd ..
else
  echo "❌ CMakeLists.txt not found"
  exit 1
fi

echo ""
echo "✓ Build complete"
echo ""

# Find binary
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  BINARY_NAME="neutralino-mac_arm64"
elif [ "$ARCH" = "x86_64" ]; then
  BINARY_NAME="neutralino-mac_x64"
else
  echo "⚠️  Unknown architecture: $ARCH"
  BINARY_NAME="neutralino-mac_arm64"
fi

BUILT_BINARY=$(find build -name "$BINARY_NAME" -type f | head -1)

if [ -z "$BUILT_BINARY" ] || [ ! -f "$BUILT_BINARY" ]; then
  echo "❌ Could not find built binary: $BINARY_NAME"
  echo "Searched in: build/"
  find build -name "*neutralino*" -type f || echo "No neutralino binaries found"
  exit 1
fi

echo "Found binary: $BUILT_BINARY"
echo ""

# Install
TARGET_BINARY="$SCRIPT_DIR/bin/$BINARY_NAME"
echo "Installing patched binary..."

# Backup original
if [ -f "$TARGET_BINARY" ]; then
  cp "$TARGET_BINARY" "$TARGET_BINARY.backup.$(date +%Y%m%d_%H%M%S)"
  echo "✓ Backed up original binary"
fi

mkdir -p "$SCRIPT_DIR/bin"
cp "$BUILT_BINARY" "$TARGET_BINARY"
chmod +x "$TARGET_BINARY"

echo "✓ Installed to: $TARGET_BINARY"
echo ""

# Cleanup (optional)
read -p "Remove build directory ($BUILD_DIR)? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf "$BUILD_DIR"
  echo "✓ Cleaned up build directory"
fi

echo ""
echo "=========================================="
echo "✅ Fix Complete!"
echo "=========================================="
echo ""
echo "The patched Neutralino binary has been installed."
echo "The app.exit() function now dispatches window operations"
echo "to the main thread on macOS, preventing the crash."
echo ""
echo "Test it: npm run neutralino:dev"
echo ""
echo "If you need to restore the original:"
echo "  cp $TARGET_BINARY.backup.* $TARGET_BINARY"
echo ""
