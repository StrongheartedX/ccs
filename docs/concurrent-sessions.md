# Concurrent Sessions (v3.0.0)

## Overview

CCS v3.0.0 enables running multiple Claude CLI instances simultaneously with different accounts. Each profile runs in an isolated environment with independent credentials, sessions, and state.

**Key Feature**: Login once per profile → use anywhere, anytime.

## How It Works

### Instance Isolation

CCS uses `CLAUDE_CONFIG_DIR` environment variable to create isolated Claude instances:

```bash
# Each profile = separate directory
~/.ccs/instances/work/        # Work account instance
~/.ccs/instances/personal/    # Personal account instance
```

When you run `ccs work "task"`, CCS:
1. Points `CLAUDE_CONFIG_DIR` to `~/.ccs/instances/work/`
2. Claude CLI loads credentials from that directory
3. All state (sessions, todos, logs) stays isolated

### Platform Support

✅ **All platforms supported**: Linux, macOS, Windows
- Same approach everywhere (unified implementation)
- No platform-specific workarounds needed
- Tested and working on all three platforms

## Quick Start

### 1. Create Profiles

```bash
# Create first profile (will prompt for login)
ccs auth create work
# Complete OAuth login with work account

# Create second profile
ccs auth create personal
# Complete OAuth login with personal account
```

### 2. Use Profiles

```bash
# Use work account
ccs work "review code"

# Use personal account
ccs personal "help with project"

# Check which account is active
ccs work /status    # Shows work account email
ccs personal /status # Shows personal account email
```

### 3. Concurrent Sessions

```bash
# Terminal 1
ccs work "implement feature X"

# Terminal 2 (simultaneously)
ccs personal "research topic Y"

# Both run at the same time with isolated state
```

## Profile Management

### List Profiles

```bash
ccs auth list

# Output:
# [*] work (default)
#     Type: account
#     Created: 2025-11-09T10:30:00.000Z
#
# [ ] personal
#     Type: account
#     Created: 2025-11-09T11:15:00.000Z
```

### Set Default

```bash
ccs auth default work

# Now `ccs` without profile name uses work
ccs "task"  # Uses work account
```

### Remove Profile

```bash
ccs auth remove personal --force
# Deletes instance and credentials
```

### Check Account

```bash
# See which account a profile is logged into
ccs work /status
# Output shows: email, subscription tier, etc.

ccs personal /status
# Different email/account info
```

## Instance Structure

Each profile gets its own isolated directory:

```
~/.ccs/instances/work/
├── .credentials.json      # OAuth credentials (managed by Claude)
├── session-env/           # Chat history & context
├── todos/                 # Task lists
├── logs/                  # Execution logs
├── file-history/          # Edit tracking
├── shell-snapshots/       # Shell state
├── debug/                 # Debug info
├── .anthropic/            # SDK config
├── commands/              # Custom commands
└── skills/                # Custom skills
```

**Key Points**:
- Credentials managed by Claude CLI (not CCS)
- Each profile requires separate OAuth login
- State never shared between profiles
- Completely isolated environments

## Use Cases

### 1. Work vs Personal

```bash
# Work account for client projects
ccs work "implement auth feature"

# Personal account for side projects
ccs personal "help with my portfolio site"
```

### 2. Different Subscriptions

```bash
# Pro account for heavy tasks
ccs pro "analyze large codebase"

# Free account for light tasks
ccs free "quick question about syntax"
```

### 3. Team Collaboration

```bash
# Company account
ccs company "review team's code"

# Client account (when working on client's Claude)
ccs client "implement their requirements"
```

## Architecture

### Profile Creation Flow

```
1. User: ccs auth create work
2. CCS creates ~/.ccs/instances/work/ directory
3. CCS spawns Claude with CLAUDE_CONFIG_DIR=~/.ccs/instances/work/
4. Claude detects no credentials
5. Claude prompts OAuth login
6. User completes login
7. Claude saves credentials to instance/.credentials.json
8. Done - profile ready to use
```

### Profile Usage Flow

```
1. User: ccs work "task"
2. CCS detects "work" is account profile
3. CCS ensures instance exists
4. CCS sets CLAUDE_CONFIG_DIR=~/.ccs/instances/work/
5. CCS executes: claude [args] with env var
6. Claude loads credentials from instance
7. Task executes with work account
```

### Settings Profiles (Backward Compatible)

```bash
# GLM and Kimi profiles still work (v2.x approach)
ccs glm "task"  # Uses --settings flag
ccs kimi "task" # Uses --settings flag

# These are NOT account profiles, they're API configurations
# Cannot run concurrently with each other
```

## Performance

### Fast Activation

- **First use**: ~20-35ms (create directories + copy configs)
- **Subsequent use**: ~5-10ms (just validation)
- **No encryption overhead** (50-120ms faster than v2.x)

### Lightweight

- **Memory**: ~3-5 KB per activation
- **Disk**: ~200-700 KB per profile
- **I/O**: 1 read + 1 write per activation

## Limitations

### 1. Same Profile = No Concurrent

Running the same profile in 2 terminals causes conflicts:

```bash
# Terminal 1
ccs work "task1"

# Terminal 2 (will conflict)
ccs work "task2"  # Same session files, log files

# Solution: Use different profiles
```

### 2. CLAUDE_CONFIG_DIR Compatibility

- Undocumented env var (no official Anthropic support)
- Works on recent Claude CLI versions
- May not work on very old versions
- **Solution**: Keep Claude CLI updated

### 3. Global Config Not Synced

Commands/skills copied on profile creation, not synced later:

```bash
# If you update ~/.claude/commands/ after creating profile:
# Option 1: Delete and recreate instance
rm -rf ~/.ccs/instances/work
ccs work "task"  # Recreates with latest configs

# Option 2: Manually copy
cp -r ~/.claude/commands/* ~/.ccs/instances/work/commands/
```

### 4. No Auto-Cleanup

Sessions/logs accumulate over time:

```bash
# Manual cleanup if needed
du -sh ~/.ccs/instances/*  # Check sizes
rm -rf ~/.ccs/instances/work/session-env/*  # Clear sessions
rm -rf ~/.ccs/instances/work/logs/*  # Clear logs
```

## Security

### Credentials

- Stored at `~/.ccs/instances/<profile>/.credentials.json`
- Managed by Claude CLI (OAuth tokens)
- Permissions: 0600 (owner read/write only)
- Never copied between instances

### Directories

- Instance dirs: 0700 (owner access only)
- Isolated per profile
- No cross-contamination

### No Encryption Needed

- Credentials live in isolated directories
- OS-level file permissions provide security
- Simpler = less attack surface

## Troubleshooting

### "Profile not found"

```bash
# Create the profile first
ccs auth create <profile-name>
```

### "Claude prompts for login"

Normal behavior on first use - complete OAuth flow:

```bash
ccs auth create work
# Follow OAuth prompts
```

### "CLAUDE_CONFIG_DIR not working"

```bash
# Check Claude CLI version
claude --version

# Update to latest
# (Installation varies by platform)
```

### Check Account Info

```bash
# See which account is logged in
ccs work /status
# Shows: email, subscription, organization

# If wrong account, recreate profile
ccs auth remove work --force
ccs auth create work  # Login with correct account
```

## Migration from v2.x

### Breaking Changes

1. No vault - credentials in instances
2. Must login per profile (no credential copying)
3. Command changed: `auth save` → `auth create`

### Migration Steps

```bash
# 1. Backup old data (optional)
mv ~/.ccs/profiles.json ~/.ccs/profiles.json.v2

# 2. Remove old profiles
ccs auth remove work --force
ccs auth remove personal --force

# 3. Recreate with v3.0.0
ccs auth create work      # Login with work account
ccs auth create personal  # Login with personal account

# 4. Verify
ccs auth list
ccs work /status
ccs personal /status

# 5. Test
ccs work "hello"
ccs personal "hello"
```

## Advanced

### Manual Instance Inspection

```bash
# View instance structure
tree ~/.ccs/instances/work/

# Check credentials (OAuth JSON)
cat ~/.ccs/instances/work/.credentials.json

# Check profile metadata
cat ~/.ccs/profiles.json
```

### Profile Metadata

```json
{
  "version": "2.0.0",
  "profiles": {
    "work": {
      "type": "account",
      "created": "2025-11-09T10:30:00.000Z",
      "last_used": "2025-11-09T15:45:00.000Z"
    },
    "personal": {
      "type": "account",
      "created": "2025-11-09T11:15:00.000Z",
      "last_used": "2025-11-09T14:30:00.000Z"
    }
  },
  "default": "work"
}
```

### Force Recreate Instance

```bash
# Delete instance (keeps profile metadata)
rm -rf ~/.ccs/instances/work

# Next use recreates fresh instance
ccs work "task"
# Will prompt for login again
```

## See Also

- [System Architecture](./system-architecture.md)
- [Codebase Summary](./codebase-summary.md)
- [Project Overview](./project-overview-pdr.md)
