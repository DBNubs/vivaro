#!/bin/bash
set -e

# Automated patch script for Neutralino macOS exit fix
# This script automatically finds and patches the app.exit() code

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Neutralino macOS Exit Fix - Auto Patch"
echo "=========================================="
echo ""

BUILD_DIR="$SCRIPT_DIR/neutralino-build"
REPO_DIR="$BUILD_DIR/neutralino"

# Check if Neutralino is already cloned
if [ ! -d "$REPO_DIR" ]; then
  echo "❌ Neutralino source not found. Please run patch-neutralino-exit.sh first"
  echo "   or clone Neutralino manually to: $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"

# Find app.cpp
APP_IMPL_FILE=$(find . -name "app.cpp" -type f | grep -E "(core/src|src)" | head -1)
if [ -z "$APP_IMPL_FILE" ]; then
  APP_IMPL_FILE=$(find . -name "app.cpp" -type f | head -1)
fi

if [ -z "$APP_IMPL_FILE" ] || [ ! -f "$APP_IMPL_FILE" ]; then
  echo "❌ Could not find app.cpp"
  exit 1
fi

echo "Found app.cpp: $APP_IMPL_FILE"
echo ""

# Find window.cpp
WINDOW_FILE=$(find . -name "window.cpp" -type f | grep -E "(core/src|src)" | head -1)
if [ -z "$WINDOW_FILE" ]; then
  WINDOW_FILE=$(find . -name "window.cpp" -type f | head -1)
fi

if [ -z "$WINDOW_FILE" ] || [ ! -f "$WINDOW_FILE" ]; then
  echo "⚠️  Could not find window.cpp, will patch app.cpp only"
fi

# Create backup
echo "Creating backups..."
cp "$APP_IMPL_FILE" "$APP_IMPL_FILE.backup"
if [ -n "$WINDOW_FILE" ]; then
  cp "$WINDOW_FILE" "$WINDOW_FILE.backup"
fi
echo "✓ Backups created"
echo ""

# Check if already patched
if grep -q "dispatch_get_main_queue" "$APP_IMPL_FILE" 2>/dev/null; then
  echo "⚠️  File appears to already be patched (found dispatch_get_main_queue)"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
  fi
fi

echo "Applying patch..."
echo ""

# Find the app::controllers::exit function
# The pattern is typically:
# void app::controllers::exit(const json &input) {
#   ... code that calls window::_close() or similar
# }

# First, add the dispatch include at the top if not present
if ! grep -q "#include.*dispatch/dispatch.h" "$APP_IMPL_FILE"; then
  echo "Adding dispatch.h include..."
  # Find the last include statement
  LAST_INCLUDE_LINE=$(grep -n "^#include" "$APP_IMPL_FILE" | tail -1 | cut -d: -f1)
  if [ -n "$LAST_INCLUDE_LINE" ]; then
    # Add macOS dispatch include
    sed -i.bak "${LAST_INCLUDE_LINE}a\\
#ifdef __APPLE__\\
#include <dispatch/dispatch.h>\\
#endif\\
" "$APP_IMPL_FILE"
    rm -f "$APP_IMPL_FILE.bak"
    echo "✓ Added dispatch.h include"
  fi
fi

# Now patch the exit function
# We need to find where it calls window close operations and wrap them

# Look for the exit function
EXIT_FUNC_START=$(grep -n "app::controllers::exit\|void.*exit.*json" "$APP_IMPL_FILE" | head -1 | cut -d: -f1)

if [ -z "$EXIT_FUNC_START" ]; then
  echo "❌ Could not find app::controllers::exit function"
  echo "Please check the code structure manually"
  exit 1
fi

echo "Found exit function at line $EXIT_FUNC_START"
echo ""

# Check what the function looks like
echo "Current exit function (first 30 lines):"
sed -n "${EXIT_FUNC_START},$((EXIT_FUNC_START + 30))p" "$APP_IMPL_FILE"
echo ""

# Find where window::_close is called
WINDOW_CLOSE_LINE=$(grep -n "window::_close\|window::close\|->close" "$APP_IMPL_FILE" | head -1 | cut -d: -f1)

if [ -z "$WINDOW_CLOSE_LINE" ]; then
  echo "⚠️  Could not find window close call in app.cpp"
  echo "The exit function might call it differently, or it might be in window.cpp"
  echo ""
  echo "Please review the code and apply the patch manually:"
  echo "  1. Wrap window close operations in:"
  echo "     #ifdef __APPLE__"
  echo "     dispatch_async(dispatch_get_main_queue(), ^{"
  echo "       // window close code here"
  echo "     });"
  echo "     #else"
  echo "     // original code"
  echo "     #endif"
  echo ""
  echo "File: $APP_IMPL_FILE"
  exit 1
fi

echo "Found window close call at line $WINDOW_CLOSE_LINE"
echo ""

# This is complex - we need to find the function body and wrap the window operations
# For now, let's create a Python script that does smarter patching
cat > "$BUILD_DIR/apply_patch.py" << 'PYTHON_EOF'
#!/usr/bin/env python3
import re
import sys

def patch_app_cpp(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # Add dispatch include if not present
    if '#include <dispatch/dispatch.h>' not in content and '#include "dispatch/dispatch.h"' not in content:
        # Find last include
        include_pattern = r'(#include\s+[<"].*?[>"])'
        includes = list(re.finditer(include_pattern, content))
        if includes:
            last_include = includes[-1]
            insert_pos = last_include.end()
            # Add macOS dispatch include
            content = content[:insert_pos] + '\n#ifdef __APPLE__\n#include <dispatch/dispatch.h>\n#endif\n' + content[insert_pos:]

    # Find app::controllers::exit function
    # Pattern: void app::controllers::exit(...) { ... }
    exit_func_pattern = r'(void\s+app::controllers::exit\s*\([^)]*\)\s*\{)'
    match = re.search(exit_func_pattern, content)

    if not match:
        print("Could not find app::controllers::exit function")
        return False

    func_start = match.start()
    func_body_start = match.end()

    # Find the matching closing brace
    brace_count = 1
    i = func_body_start
    while i < len(content) and brace_count > 0:
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
        i += 1

    func_end = i
    func_body = content[func_body_start:func_end-1]

    # Check if already patched
    if 'dispatch_get_main_queue' in func_body:
        print("Function appears already patched")
        return False

    # Find window close calls
    window_close_patterns = [
        r'window::_close\s*\(',
        r'window::close\s*\(',
        r'->close\s*\(',
        r'window.*close',
    ]

    has_window_close = any(re.search(pattern, func_body) for pattern in window_close_patterns)

    if not has_window_close:
        print("Could not find window close operations in exit function")
        print("Function body:")
        print(func_body[:500])
        return False

    # Wrap the entire function body in dispatch_async on macOS
    # We'll wrap everything except the return/early exit statements at the start
    patched_body = '''#ifdef __APPLE__
    dispatch_async(dispatch_get_main_queue(), ^{
        ''' + func_body + '''
    });
#else
    ''' + func_body + '''
#endif'''

    new_content = content[:func_body_start] + patched_body + content[func_end-1:]

    # Write back
    with open(filepath, 'w') as f:
        f.write(new_content)

    return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: apply_patch.py <app.cpp path>")
        sys.exit(1)

    if patch_app_cpp(sys.argv[1]):
        print("✓ Patch applied successfully")
    else:
        print("✗ Patch failed or already applied")
        sys.exit(1)
PYTHON_EOF

chmod +x "$BUILD_DIR/apply_patch.py"

echo "Applying automated patch..."
python3 "$BUILD_DIR/apply_patch.py" "$APP_IMPL_FILE"

if [ $? -eq 0 ]; then
  echo "✓ Patch applied to app.cpp"
else
  echo "⚠️  Automated patch failed. Showing diff for manual review:"
  diff -u "$APP_IMPL_FILE.backup" "$APP_IMPL_FILE" | head -50 || true
  echo ""
  echo "You may need to apply the patch manually."
  exit 1
fi

echo ""
echo "Patch applied! Review the changes:"
echo "  diff -u $APP_IMPL_FILE.backup $APP_IMPL_FILE"
echo ""
read -p "Continue with build? (Y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
  echo "Patch applied but build cancelled. You can build manually later."
  exit 0
fi

echo ""
echo "Building Neutralino..."
echo ""

# Build
if [ -f "CMakeLists.txt" ]; then
  mkdir -p build
  cd build
  cmake ..
  cmake --build . -j$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
  cd ..
elif [ -f "build.sh" ]; then
  chmod +x build.sh
  ./build.sh
else
  echo "❌ Could not find build system"
  exit 1
fi

echo ""
echo "✓ Build complete"
echo ""

# Find and install binary
BINARY_NAME="neutralino-mac_arm64"
if [[ "$(uname -m)" == "x86_64" ]]; then
  BINARY_NAME="neutralino-mac_x64"
fi

BUILT_BINARY=$(find . -name "$BINARY_NAME" -type f | head -1)

if [ -z "$BUILT_BINARY" ] || [ ! -f "$BUILT_BINARY" ]; then
  echo "❌ Could not find built binary"
  exit 1
fi

echo "Installing patched binary..."
mkdir -p "$SCRIPT_DIR/bin"
cp "$BUILT_BINARY" "$SCRIPT_DIR/bin/$BINARY_NAME"
chmod +x "$SCRIPT_DIR/bin/$BINARY_NAME"
echo "✓ Installed to: $SCRIPT_DIR/bin/$BINARY_NAME"
echo ""
echo "✅ Done! Test with: npm run neutralino:dev"
