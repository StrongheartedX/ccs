#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARE_DIR="$HOME/.local/share/ccs"

# Determine if running from git clone or curl
if [[ -d "$SCRIPT_DIR/.git" ]]; then
  INSTALL_METHOD="git"
else
  INSTALL_METHOD="standalone"
fi

echo "Installing ccs to $INSTALL_DIR..."
echo ""

# Create install dir if needed
mkdir -p "$INSTALL_DIR"
mkdir -p "$SHARE_DIR"

# Make executable first
chmod +x "$SCRIPT_DIR/ccs"

# Symlink ccs script
ln -sf "$SCRIPT_DIR/ccs" "$INSTALL_DIR/ccs"

# Verify installation
if [[ ! -L "$INSTALL_DIR/ccs" ]]; then
  echo "❌ Error: Failed to create symlink at $INSTALL_DIR/ccs"
  echo "Check directory permissions and try again."
  exit 1
fi

# Install uninstall script
if [[ -f "$SCRIPT_DIR/uninstall.sh" ]]; then
  cp "$SCRIPT_DIR/uninstall.sh" "$SHARE_DIR/uninstall.sh"
  chmod +x "$SHARE_DIR/uninstall.sh"
  ln -sf "$SHARE_DIR/uninstall.sh" "$INSTALL_DIR/ccs-uninstall"
elif [[ "$INSTALL_METHOD" == "standalone" ]]; then
  # Fetch uninstall script for curl installs
  echo "Fetching uninstall script..."
  if command -v curl &> /dev/null; then
    curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/uninstall.sh -o "$SHARE_DIR/uninstall.sh"
    chmod +x "$SHARE_DIR/uninstall.sh"
    ln -sf "$SHARE_DIR/uninstall.sh" "$INSTALL_DIR/ccs-uninstall"
  else
    echo "⚠️  Warning: curl not found, skipping uninstall script"
  fi
fi

# Check if in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo "⚠️  Warning: $INSTALL_DIR is not in PATH"
  echo ""
  echo "Add to your shell profile (~/.bashrc or ~/.zshrc):"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi

echo "✅ Installation complete!"
echo ""

# Smart setup: detect current provider and help create profiles
CLAUDE_DIR="$HOME/.claude"
CURRENT_SETTINGS="$CLAUDE_DIR/settings.json"
GLM_SETTINGS="$CLAUDE_DIR/glm.settings.json"
SONNET_SETTINGS="$CLAUDE_DIR/sonnet.settings.json"

# Detect current provider
CURRENT_PROVIDER="unknown"
if [[ -f "$CURRENT_SETTINGS" ]]; then
  if grep -q "api.z.ai" "$CURRENT_SETTINGS" 2>/dev/null || grep -q "glm-4" "$CURRENT_SETTINGS" 2>/dev/null; then
    CURRENT_PROVIDER="glm"
  elif grep -q "ANTHROPIC_BASE_URL" "$CURRENT_SETTINGS" 2>/dev/null && ! grep -q "api.z.ai" "$CURRENT_SETTINGS" 2>/dev/null; then
    CURRENT_PROVIDER="custom"
  else
    CURRENT_PROVIDER="claude"
  fi
fi

# Check for existing profile files
HAS_GLM=false
HAS_SONNET=false
[[ -f "$GLM_SETTINGS" ]] && HAS_GLM=true
[[ -f "$SONNET_SETTINGS" ]] && HAS_SONNET=true

# Smart setup guidance
if [[ "$CURRENT_PROVIDER" != "unknown" ]]; then
  echo "🔍 Detected current provider: $CURRENT_PROVIDER"
  echo ""
fi

# Offer to create missing profiles
if [[ "$HAS_GLM" == false ]] || [[ "$HAS_SONNET" == false ]]; then
  echo "📝 Setup wizard: Creating profile files..."
  echo ""

  # Create GLM profile if missing
  if [[ "$HAS_GLM" == false ]]; then
    if [[ "$CURRENT_PROVIDER" == "glm" ]]; then
      echo "✓ Copying current GLM config to profile..."
      cp "$CURRENT_SETTINGS" "$GLM_SETTINGS"
      echo "  Created: $GLM_SETTINGS"
    else
      echo "Creating GLM profile template at $GLM_SETTINGS"
      # Preserve user's existing env vars if they exist
      if [[ -f "$CURRENT_SETTINGS" ]] && command -v jq &> /dev/null; then
        # Merge user's env with GLM essentials (atomic operation)
        if jq '.env |= (. // {}) + {
          "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
          "ANTHROPIC_AUTH_TOKEN": "YOUR_GLM_API_KEY_HERE",
          "ANTHROPIC_MODEL": "glm-4.6"
        }' "$CURRENT_SETTINGS" > "$GLM_SETTINGS.tmp" 2>/dev/null; then
          mv "$GLM_SETTINGS.tmp" "$GLM_SETTINGS"
        else
          rm -f "$GLM_SETTINGS.tmp"
          echo "  ℹ️  jq failed, using basic template"
          # Fallback to minimal template
          cat > "$GLM_SETTINGS" << 'EOF'
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_GLM_API_KEY_HERE",
    "ANTHROPIC_MODEL": "glm-4.6"
  }
}
EOF
        fi
      else
        # Minimal GLM template
        cat > "$GLM_SETTINGS" << 'EOF'
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_GLM_API_KEY_HERE",
    "ANTHROPIC_MODEL": "glm-4.6"
  }
}
EOF
      fi
      echo "  Created: $GLM_SETTINGS"
      echo "  ⚠️  Edit this file and replace YOUR_GLM_API_KEY_HERE with your actual GLM API key"
    fi
    echo ""
  fi

  # Create Sonnet profile if missing
  if [[ "$HAS_SONNET" == false ]]; then
    if [[ "$CURRENT_PROVIDER" == "claude" ]]; then
      echo "✓ Copying current Claude config to profile..."
      cp "$CURRENT_SETTINGS" "$SONNET_SETTINGS"
      echo "  Created: $SONNET_SETTINGS"
    else
      echo "Creating Claude Sonnet profile template at $SONNET_SETTINGS"
      # Preserve user's existing settings, remove GLM-specific fields
      if [[ -f "$CURRENT_SETTINGS" ]] && command -v jq &> /dev/null; then
        # Remove GLM-specific env vars, keep user's other settings (atomic)
        if jq 'del(.env.ANTHROPIC_BASE_URL, .env.ANTHROPIC_AUTH_TOKEN, .env.ANTHROPIC_MODEL) |
            if (.env | length) == 0 then .env = {} else . end' "$CURRENT_SETTINGS" > "$SONNET_SETTINGS.tmp" 2>/dev/null; then
          mv "$SONNET_SETTINGS.tmp" "$SONNET_SETTINGS"
        else
          rm -f "$SONNET_SETTINGS.tmp"
          echo "  ℹ️  jq failed, using basic template"
          # Fallback to minimal template
          cat > "$SONNET_SETTINGS" << 'EOF'
{
  "env": {}
}
EOF
        fi
      else
        # Minimal Claude template (uses default authentication)
        cat > "$SONNET_SETTINGS" << 'EOF'
{
  "env": {}
}
EOF
      fi
      echo "  Created: $SONNET_SETTINGS"
      echo "  ℹ️  This uses your Claude subscription (no API key needed)"
    fi
    echo ""
  fi
fi

# Auto-create ~/.ccs.json if missing (atomic operation)
if [[ ! -f "$HOME/.ccs.json" ]]; then
  echo "Creating ~/.ccs.json config..."
  cat > "$HOME/.ccs.json.tmp" << 'EOF'
{
  "profiles": {
    "glm": "~/.claude/glm.settings.json",
    "sonnet": "~/.claude/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
EOF
  # Atomic move only if file still doesn't exist (prevents race condition)
  if mv -n "$HOME/.ccs.json.tmp" "$HOME/.ccs.json" 2>/dev/null; then
    echo "  ✓ Created: ~/.ccs.json"
  else
    rm -f "$HOME/.ccs.json.tmp"
    echo "  ℹ️  Config already exists"
  fi
  echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "Quick start:"
echo ""
echo "Example:"
echo "  ccs           # Uses default profile"
echo "  ccs glm       # Uses glm profile"
echo "  ccs sonnet --verbose"
echo ""
echo "To uninstall: ccs-uninstall"
