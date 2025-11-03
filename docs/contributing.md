# CCS Contributing Guide

## Development Guidelines

### Philosophy

CCS follows these core principles:

- **YAGNI**: No features "just in case"
- **KISS**: Simple bash, no complexity
- **DRY**: One source of truth (config)

This tool does ONE thing well: map profile names to settings files.

### Code Standards

#### Compatibility Requirements

- **Unix**: bash 3.2+ compatibility
- **Windows**: PowerShell 5.1+ compatibility
- **Dependencies**: Only jq (Unix) or built-in PowerShell (Windows)

#### Code Style

**Bash (Unix)**:
- Use `#!/usr/bin/env bash` shebang
- Quote variables: `"$VAR"` not `$VAR`
- Use `[[ ]]` for tests, not `[ ]`
- Follow existing indentation and naming patterns

**PowerShell (Windows)**:
- Use `CmdletBinding` and proper parameter handling
- Follow PowerShell verb-noun convention
- Use proper error handling with `try/catch`
- Maintain compatibility with PowerShell 5.1+

### Testing

#### Platform Testing

Test on all platforms before submitting PR:
- macOS (bash)
- Linux (bash)
- Windows (PowerShell, CMD, Git Bash)

#### Test Scenarios

1. **Basic functionality**:
   ```bash
   ccs            # Should use default profile
   ccs glm        # Should use GLM profile
   ccs --version  # Should show version
   ```

2. **With arguments**:
   ```bash
   ccs glm --help
   ccs /plan "test"
   ```

3. **Error handling**:
   ```bash
   ccs invalid-profile    # Should show error
   ccs --invalid-flag     # Should pass through to Claude
   ```

### Submission Process

#### Before Submitting

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test on all platforms
5. Ensure existing tests pass

#### Pull Request Requirements

- Clear description of changes
- Testing instructions if applicable
- Link to relevant issues
- Follow existing commit message style

#### Commit Message Style

```
type(scope): description

[optional body]

[optional footer]
```

Examples:
```
fix(installer): handle git worktree detection
feat(config): support custom config location
docs(readme): update installation instructions
```

### Development Setup

#### Local Development

```bash
# Clone your fork
git clone https://github.com/yourusername/ccs.git
cd ccs

# Create feature branch
git checkout -b your-feature-name

# Make changes
# Test locally with ./ccs

# Run tests
./test.sh  # if available
```

#### Testing Installer

```bash
# Test Unix installer
./installers/install.sh

# Test Windows installer (in PowerShell)
.\installers\install.ps1
```

### Areas for Contribution

#### Wanted Features

1. **Additional profile support**:
   - Custom profile validation
   - Profile switching shortcuts

2. **Enhanced error handling**:
   - Better error messages
   - Recovery suggestions

3. **Documentation**:
   - More examples
   - Integration guides

#### Bug Fixes

- Installer issues on different platforms
- Edge cases in config parsing
- Windows-specific compatibility

### Review Process

1. **Automated checks**:
   - Syntax validation
   - Basic functionality tests

2. **Manual review**:
   - Code quality and style
   - Platform compatibility
   - Philosophy alignment

3. **Testing**:
   - Cross-platform verification
   - Integration testing

### Community

#### Getting Help

- GitHub Issues: Report bugs or request features
- Discussions: Ask questions or share ideas

#### Code of Conduct

Be respectful, constructive, and focused on the project's philosophy of simplicity and reliability.

---

**Thank you for contributing to CCS!**

Remember: Keep it simple, test thoroughly, and stay true to the YAGNI/KISS/DRY philosophy.