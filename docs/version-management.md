# Version Management

## Overview

CCS uses a centralized version management system to ensure consistency across all components.

## Version Locations

The version number must be kept in sync across these files:

1. **`VERSION`** - Primary version file (read by ccs/ccs.ps1 at runtime)
2. **`installers/install.sh`** - Hardcoded for standalone installations (`curl | bash`)
3. **`installers/install.ps1`** - Hardcoded for standalone installations (`irm | iex`)

## Why Hardcoded Versions in Installers?

When users run:
- `curl -fsSL ccs.kaitran.ca/install | bash`
- `irm ccs.kaitran.ca/install.ps1 | iex`

The installer script is downloaded and executed directly **without** the VERSION file. Therefore, installers must have a hardcoded version as fallback.

For git-based installations, the VERSION file is read if available, overriding the hardcoded version.

## Updating Version

### Automated Method (Recommended)

Use the provided script to bump the version automatically:

```bash
# Bump patch version (2.1.1 -> 2.1.2)
./scripts/bump-version.sh patch

# Bump minor version (2.1.1 -> 2.2.0)
./scripts/bump-version.sh minor

# Bump major version (2.1.1 -> 3.0.0)
./scripts/bump-version.sh major
```

This updates:
- VERSION file
- installers/install.sh (hardcoded version)
- installers/install.ps1 (hardcoded version)

### Manual Method

If updating manually, update version in ALL three locations:

1. **VERSION file**:
   ```bash
   echo "2.1.2" > VERSION
   ```

2. **installers/install.sh** (line ~34):
   ```bash
   CCS_VERSION="2.1.2"
   ```

3. **installers/install.ps1** (line ~33):
   ```powershell
   $CcsVersion = "2.1.2"
   ```

## Release Checklist

When releasing a new version:

- [ ] Update version using `./scripts/bump-version.sh X.Y.Z`
- [ ] Review changes: `git diff`
- [ ] Update CHANGELOG.md with release notes
- [ ] Commit changes: `git commit -am "chore: bump version to X.Y.Z"`
- [ ] Push: `git push`
- [ ] Verify CloudFlare worker serves updated installer

## Version Display

After installation, users can check version:

```bash
# Shows CCS version (from VERSION file if available)
ccs --version

# Shows Claude CLI version
ccs version
```

## Semantic Versioning

CCS follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features (backward compatible)
- **PATCH** (0.0.X): Bug fixes

Current version: **2.1.1**
- 2.1.0: Added task delegation feature
- 2.1.1: Fixed argument parsing bug (flags treated as profiles)
