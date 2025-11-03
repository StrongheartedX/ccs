# CCS Troubleshooting Guide

## Windows-Specific Issues

### PowerShell Execution Policy

If you see "cannot be loaded because running scripts is disabled":

```powershell
# Check current policy
Get-ExecutionPolicy

# Allow current user to run scripts (recommended)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run with bypass (one-time)
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.ccs\ccs.ps1" glm
```

### PATH not updated (Windows)

If `ccs` command not found after installation:

1. Restart your terminal
2. Or manually add to PATH:
   - Open "Edit environment variables for your account"
   - Add `%USERPROFILE%\.ccs` to User PATH
   - Restart terminal

### Claude CLI not found (Windows)

```powershell
# Check Claude CLI
where.exe claude

# If missing, install from Claude docs
```

## Installation Issues

### BASH_SOURCE unbound variable error

This error occurs when running the installer in some shells or environments.

**Fixed in latest version**: The installer now handles both piped execution (`curl | bash`) and direct execution (`./install.sh`).

**Solution**: Upgrade to the latest version:
```bash
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/installers/install.sh | bash
```

### Git worktree not detected

If installing from a git worktree or submodule, older versions may fail to detect the git repository.

**Fixed in latest version**: The installer now detects both `.git` directory (standard clone) and `.git` file (worktree/submodule).

**Solution**: Upgrade to the latest version or use the curl installation method.

## Configuration Issues

### Profile not found

```
Error: Profile 'foo' not found in ~/.ccs/config.json
```

**Fix**: Add profile to `~/.ccs/config.json`:
```json
{
  "profiles": {
    "foo": "~/.ccs/foo.settings.json"
  }
}
```

### Settings file missing

```
Error: Settings file not found: ~/.ccs/foo.settings.json
```

**Fix**: Create settings file or fix path in config.

### jq not installed

```
Error: jq is required but not installed
```

**Fix**: Install jq (see installation guide).

**Note**: The installer creates basic templates even without jq, but enhanced features require jq.

## Environment Issues

### PATH not set

```
⚠️  Warning: ~/.local/bin is not in PATH
```

**Fix**: Add to `~/.bashrc` or `~/.zshrc`:
```bash
export PATH="$HOME/.local/bin:$PATH"
```
Then `source ~/.bashrc` or restart shell.

### Default profile missing

```
Error: Profile 'default' not found in ~/.ccs/config.json
```

**Fix**: Add "default" profile or always specify profile name:
```json
{
  "profiles": {
    "default": "~/.claude/settings.json"
  }
}
```

## Common Problems

### Claude CLI not found

```
Error: claude command not found
```

**Solution**: Install Claude CLI from [official documentation](https://docs.claude.com/en/docs/claude-code/installation).

### Permission denied (Unix)

```
Error: Permission denied: ~/.local/bin/ccs
```

**Solution**: Make the script executable:
```bash
chmod +x ~/.local/bin/ccs
```

### Config file not found

```
Error: Config file not found: ~/.ccs/config.json
```

**Solution**: Re-run installer or create config manually:
```bash
mkdir -p ~/.ccs
echo '{"profiles":{"default":"~/.claude/settings.json"}}' > ~/.ccs/config.json
```

## Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/kaitranntt/ccs/issues)
2. Create a new issue with:
   - Your operating system
   - CCS version (`ccs --version`)
   - Exact error message
   - Steps to reproduce

## Debug Mode

Enable verbose output to troubleshoot issues:

```bash
ccs --verbose glm
```

This will show:
- Which config file is being read
- Which profile is being selected
- Which settings file is being used
- The exact command being executed