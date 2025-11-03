# CCS Usage Guide

## Why CCS?

**Built for developers with both Claude subscription and GLM Coding Plan.**

### Two Real Use Cases

#### 1. Task-Appropriate Model Selection

**Claude Sonnet 4.5** excels at:
- Complex architectural decisions
- System design and planning
- Debugging tricky issues
- Code reviews requiring deep reasoning

**GLM 4.6** works great for:
- Simple bug fixes
- Straightforward implementations
- Routine refactoring
- Documentation writing

**With CCS**: Switch models based on task complexity, maximize quality while managing costs.

```bash
ccs           # Planning new feature architecture
# Got the plan? Implement with GLM:
ccs glm       # Write the straightforward code
```

#### 2. Rate Limit Management

If you have both Claude subscription and GLM Coding Plan, you know the pain:
- Claude hits rate limit mid-project
- You manually copy GLM config to `~/.claude/settings.json`
- 5 minutes later, need to switch back
- Repeat 10x per day

**CCS solves this**:
- One command to switch: `ccs` (default) or `ccs glm` (fallback)
- Keep both configs saved as profiles
- Switch in <1 second
- No file editing, no copy-paste, no mistakes

### Features

- Instant profile switching (Claude ↔ GLM)
- Pass-through all Claude CLI args
- Smart setup: detects your current provider
- Auto-creates configs during install
- No proxies, no magic—just bash + jq

## Basic Usage

### Switching Profiles

```bash
# Works on macOS, Linux, and Windows
ccs           # Use Claude subscription (default)
ccs glm       # Use GLM fallback
```

**Windows Note**: Commands work identically in PowerShell, CMD, and Git Bash.

### With Arguments

All args after profile name pass directly to Claude CLI:

```bash
ccs glm --verbose
ccs /plan "add feature"
ccs glm /code "implement feature"
```

### Utility Commands

```bash
ccs --version    # Show CCS version
ccs --help       # Show Claude CLI help
```

## Task Delegation

**CCS includes intelligent task delegation** via the `/ccs` meta-command:

```bash
# Delegate planning to GLM (saves Sonnet tokens)
/ccs glm /plan "add user authentication"

# Delegate coding to GLM
/ccs glm /code "implement auth endpoints"

# Quick questions with Haiku
/ccs haiku /ask "explain this error"
```

**Benefits**:
- ✅ Save tokens by delegating simple tasks to cheaper models
- ✅ Use right model for each task automatically
- ✅ Reusable commands across all projects (user-scope)
- ✅ Seamless integration with existing workflows

## Real Workflows

### Task-Based Model Selection

**Scenario**: Building a new payment integration feature

```bash
# Step 1: Architecture & Planning (needs Claude's intelligence)
ccs
/plan "Design payment integration with Stripe, handle webhooks, errors, retries"
# → Claude Sonnet 4.5 thinks deeply about edge cases, security, architecture

# Step 2: Implementation (straightforward coding, use GLM)
ccs glm
/code "implement the payment webhook handler from the plan"
# → GLM 4.6 writes the code efficiently, saves Claude usage

# Step 3: Code Review (needs deep analysis)
ccs
/review "check the payment handler for security issues"
# → Claude Sonnet 4.5 catches subtle vulnerabilities

# Step 4: Bug Fixes (simple)
ccs glm
/fix "update error message formatting"
# → GLM 4.6 handles routine fixes
```

**Result**: Best model for each task, lower costs, better quality.

### Rate Limit Management

```bash
# Working on complex refactoring with Claude
ccs
/plan "refactor authentication system"

# Claude hits rate limit mid-task
# → Error: Rate limit exceeded

# Switch to GLM instantly
ccs glm
# Continue working without interruption

# Rate limit resets? Switch back
ccs
```

## How It Works

1. Reads profile name (defaults to "default" if omitted)
2. Looks up settings file path in `~/.ccs/config.json`
3. Executes `claude --settings <path> [remaining-args]`

No magic. No file modification. Pure delegation. Works identically across all platforms.