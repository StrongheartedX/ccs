#!/usr/bin/env bash
# Bump CCS version
# Usage: ./scripts/bump-version.sh [major|minor|patch]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CCS_DIR="$(dirname "$SCRIPT_DIR")"
VERSION_FILE="$CCS_DIR/VERSION"

# Check VERSION file exists
if [[ ! -f "$VERSION_FILE" ]]; then
    echo "✗ Error: VERSION file not found at $VERSION_FILE"
    exit 1
fi

# Read current version
CURRENT_VERSION=$(cat "$VERSION_FILE")
echo "Current version: $CURRENT_VERSION"

# Parse version
if [[ ! "$CURRENT_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "✗ Error: Invalid version format in VERSION file"
    echo "Expected: MAJOR.MINOR.PATCH (e.g., 1.2.3)"
    exit 1
fi

MAJOR="${BASH_REMATCH[1]}"
MINOR="${BASH_REMATCH[2]}"
PATCH="${BASH_REMATCH[3]}"

# Determine bump type
BUMP_TYPE="${1:-patch}"

case "$BUMP_TYPE" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
    *)
        echo "✗ Error: Invalid bump type '$BUMP_TYPE'"
        echo "Usage: $0 [major|minor|patch]"
        exit 1
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

echo "New version: $NEW_VERSION"
echo ""
echo "This will:"
echo "  1. Update VERSION file"
echo "  2. Update installers/install.sh (hardcoded version)"
echo "  3. Update installers/install.ps1 (hardcoded version)"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Update VERSION file
echo "$NEW_VERSION" > "$VERSION_FILE"
echo "✓ Updated VERSION file to $NEW_VERSION"

# Update installers/install.sh
INSTALL_SH="$CCS_DIR/installers/install.sh"
if [[ -f "$INSTALL_SH" ]]; then
    sed -i.bak "s/^CCS_VERSION=\".*\"/CCS_VERSION=\"$NEW_VERSION\"/" "$INSTALL_SH"
    rm -f "$INSTALL_SH.bak"
    echo "✓ Updated installers/install.sh"
else
    echo "⚠  installers/install.sh not found, skipping"
fi

# Update installers/install.ps1
INSTALL_PS1="$CCS_DIR/installers/install.ps1"
if [[ -f "$INSTALL_PS1" ]]; then
    sed -i.bak "s/^\$CcsVersion = \".*\"/\$CcsVersion = \"$NEW_VERSION\"/" "$INSTALL_PS1"
    rm -f "$INSTALL_PS1.bak"
    echo "✓ Updated installers/install.ps1"
else
    echo "⚠  installers/install.ps1 not found, skipping"
fi

echo ""
echo "✓ Version bumped to $NEW_VERSION"
