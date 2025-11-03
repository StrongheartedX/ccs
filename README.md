# CCS - Claude Code Switch

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Language: Bash | PowerShell](https://img.shields.io/badge/Language-Bash%20%7C%20PowerShell-blue.svg)]()
[![Platform: macOS | Linux | Windows](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)]()

**Languages**: [English](README.md) | [Tiếng Việt](README.vi.md)

> Switch between Claude Sonnet 4.5 and GLM 4.6 instantly. Use the right model for each task.

**The Problem**: You have both Claude subscription and GLM Coding Plan. Two scenarios happen daily:
1. **Rate limits**: Claude hits limit mid-project, you manually edit `~/.claude/settings.json` to switch
2. **Task optimization**: Complex planning needs Claude Sonnet 4.5's intelligence, but simple coding works fine with GLM 4.6

Manual switching is tedious and error-prone.

**The Solution**:
```bash
ccs           # Use Claude subscription (default)
ccs glm       # Switch to GLM fallback
# Hit rate limit? Switch instantly:
ccs glm       # Continue working with GLM
```

One command. Zero downtime. No file editing. Right model, right task.

## Quick Start

### Install:

**macOS / Linux**:
```bash
curl -fsSL ccs.kaitran.ca/install | bash
```

**Windows PowerShell**:
```powershell
irm ccs.kaitran.ca/install | iex
```

**~/.ccs/config.json** (auto-created during install):
```json
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

### Use:
```bash
ccs              # Use Claude subscription (default)
ccs glm          # Use GLM fallback
ccs --version    # Show CCS version
```

## Philosophy

- **YAGNI**: No features "just in case"
- **KISS**: Simple bash, no complexity
- **DRY**: One source of truth (config)

## Uninstall

**macOS / Linux**:
```bash
curl -fsSL ccs.kaitran.ca/uninstall | bash
```

**Windows PowerShell**:
```powershell
irm ccs.kaitran.ca/uninstall | iex
```

**Learn more**: Complete documentation in [docs/](./docs/)
- [Installation Guide](./docs/installation.md)
- [Configuration](./docs/configuration.md)
- [Usage Examples](./docs/usage.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Contributing](./docs/contributing.md)

---

*Built with ❤️ by [Kai Tran](https://github.com/kaitranntt)*