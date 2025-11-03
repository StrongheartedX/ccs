# CCS Installation Guide

## One-Liner Installation (Recommended)

### macOS / Linux

```bash
# Short URL (via CloudFlare)
curl -fsSL ccs.kaitran.ca/install | bash

# Or direct from GitHub
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/installers/install.sh | bash
```

### Windows PowerShell

```powershell
# Short URL (via CloudFlare)
irm ccs.kaitran.ca/install.ps1 | iex

# Or direct from GitHub
irm https://raw.githubusercontent.com/kaitranntt/ccs/main/installers/install.ps1 | iex
```

**Note**:
- Unix installer supports both direct execution (`./install.sh`) and piped installation (`curl | bash`)
- Windows installer requires PowerShell 5.1+ (pre-installed on Windows 10+)

## Git Clone Installation

### macOS / Linux

```bash
git clone https://github.com/kaitranntt/ccs.git
cd ccs
./installers/install.sh
```

### Windows PowerShell

```powershell
git clone https://github.com/kaitranntt/ccs.git
cd ccs
.\installers\install.ps1
```

**Note**: Works with git worktrees and submodules - the installer detects both `.git` directory and `.git` file.

## Manual Installation

### macOS / Linux

```bash
# Download script
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/ccs -o ~/.local/bin/ccs
chmod +x ~/.local/bin/ccs

# Ensure ~/.local/bin in PATH
export PATH="$HOME/.local/bin:$PATH"
```

### Windows PowerShell

```powershell
# Create directory
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ccs"

# Download script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/kaitranntt/ccs/main/ccs.ps1" -OutFile "$env:USERPROFILE\.ccs\ccs.ps1"

# Add to PATH (restart terminal after)
$Path = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$Path;$env:USERPROFILE\.ccs", "User")
```

## What Gets Installed

```bash
~/.ccs/
├── ccs                     # Main executable
├── config.json             # Profile configuration
├── glm.settings.json       # GLM profile
└── .claude/                # Claude Code integration
    ├── commands/ccs.md     # /ccs meta-command
    └── skills/             # Delegation skills
```

## Upgrade CCS

### macOS / Linux

```bash
# From git clone
cd ccs && git pull && ./install.sh

# From curl install
curl -fsSL ccs.kaitran.ca/install | bash
```

### Windows PowerShell

```powershell
# From git clone
cd ccs
git pull
.\install.ps1

# From irm install
irm ccs.kaitran.ca/install.ps1 | iex
```

## Requirements

### macOS / Linux
- `bash` 3.2+
- `jq` (JSON processor)
- [Claude CLI](https://docs.claude.com/en/docs/claude-code/installation)

### Windows
- PowerShell 5.1+ (pre-installed on Windows 10+)
- [Claude CLI](https://docs.claude.com/en/docs/claude-code/installation)

### Installing jq (macOS / Linux only)

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq

# Fedora
sudo dnf install jq

# Arch
sudo pacman -S jq
```

**Note**: Windows version uses PowerShell's built-in JSON support - no jq required.