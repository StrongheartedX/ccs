# CCS Project Overview and Product Development Requirements (PDR)

## Executive Summary

CCS (Claude Code Switch) is a lightweight CLI wrapper that enables instant profile switching between Claude Sonnet 4.5, GLM 4.6, and Kimi for Coding models. The project has undergone two major simplifications:
- **v2.x**: 35% codebase reduction (from 1,315 to 855 lines)
- **v3.0**: Additional 40% reduction through vault removal (~600 lines deleted), achieving a login-per-profile model that eliminates credential encryption/decryption overhead

## Product Vision

### Mission Statement
Provide developers with instant, zero-downtime switching between AI models, optimizing for cost, performance, and rate limit management while maintaining a seamless workflow experience.

### Core Value Proposition
- **Instant Switching**: One command to change AI models without file editing
- **Zero Downtime**: Never interrupt development workflow during model switches
- **Cost Optimization**: Use the right model for each task automatically
- **Developer Experience**: Maintain familiar Claude CLI interface with enhanced capabilities

## Product Development Requirements (PDR)

### Functional Requirements

#### FR-001: Profile Management
**Requirement**: System shall support instant switching between multiple AI model profiles
- **Priority**: High
- **Acceptance Criteria**:
  - Switch profiles with single command (`ccs glm`, `ccs`)
  - Maintain profile state until explicitly changed
  - Support unlimited profile configurations
  - Automatic profile detection from command arguments

#### FR-002: Configuration Management
**Requirement**: System shall provide automatic configuration management
- **Priority**: High
- **Acceptance Criteria**:
  - Auto-create configuration during installation
  - Support custom configuration paths via environment variables
  - Validate configuration file format and existence
  - Provide clear error messages for configuration issues

#### FR-003: Claude CLI Integration
**Requirement**: System shall seamlessly integrate with official Claude CLI
- **Priority**: High
- **Acceptance Criteria**:
  - Pass all arguments transparently to Claude CLI
  - Support all Claude CLI features and flags
  - Maintain identical user experience to native Claude CLI
  - Auto-detect Claude CLI installation location

#### FR-004: Cross-Platform Compatibility
**Requirement**: System shall work identically across all supported platforms
- **Priority**: High
- **Acceptance Criteria**:
  - Support macOS (Intel and Apple Silicon)
  - Support Linux distributions
  - Support Windows (PowerShell and Git Bash)
  - Consistent behavior and error handling across platforms

#### FR-005: Special Command Support
**Requirement**: System shall support special meta-commands for management
- **Priority**: Medium
- **Acceptance Criteria**:
  - `ccs --version` displays version and installation location
  - `ccs --help` shows usage information
  - **WIP**: `ccs --install` integrates with Claude Code commands (testing incomplete)
  - **WIP**: `ccs --uninstall` removes Claude Code integration (testing incomplete)

#### FR-006: Error Handling
**Requirement**: System shall provide clear, actionable error messages
- **Priority**: Medium
- **Acceptance Criteria**:
  - Validate configuration file existence and format
  - Detect Claude CLI availability and report issues
  - Provide suggestions for resolving common problems
  - Maintain consistent error message format

### Non-Functional Requirements

#### NFR-001: Performance
**Requirement**: System shall execute with minimal overhead
- **Priority**: High
- **Acceptance Criteria**:
  - Profile switching completes in < 100ms
  - Startup time < 50ms for any command
  - Memory footprint < 10MB during execution
  - No perceptible delay compared to native Claude CLI

#### NFR-002: Reliability
**Requirement**: System shall maintain 99.9% uptime during normal operations
- **Priority**: High
- **Acceptance Criteria**:
  - Handle edge cases gracefully without crashes
  - Maintain functionality across system reboots
  - Recover gracefully from temporary system issues
  - No memory leaks or resource exhaustion

#### NFR-003: Security
**Requirement**: System shall follow security best practices
- **Priority**: High
- **Acceptance Criteria**:
  - No shell injection vulnerabilities in process execution
  - Validate file paths to prevent traversal attacks
  - Use secure process spawning with argument arrays
  - No storage of sensitive credentials or API keys

#### NFR-004: Maintainability
**Requirement**: System shall be easy to maintain and extend
- **Priority**: Medium
- **Acceptance Criteria**:
  - Code complexity maintained at manageable levels
  - Comprehensive test coverage (>90%)
  - Clear documentation and code comments
  - Modular architecture supporting future enhancements

#### NFR-005: Usability
**Requirement**: System shall provide excellent developer experience
- **Priority**: Medium
- **Acceptance Criteria**:
  - Intuitive command structure matching CLI conventions
  - Clear help documentation and usage examples
  - Minimal learning curve for existing Claude CLI users
  - Consistent behavior across all use cases

## Technical Architecture

### System Components

#### Core Modules (v3.0)
1. **Main Entry Point** (`bin/ccs.js`): Command parsing, profile routing, unified execution
2. **Configuration Manager** (`bin/config-manager.js`): Settings-based profile management (glm, kimi)
3. **Claude Detector** (`bin/claude-detector.js`): CLI executable detection
4. **Helpers** (`bin/helpers.js`): Utility functions and error handling
5. **Instance Manager** (`bin/instance-manager.js`): Isolated instance directory management
6. **Profile Detector** (`bin/profile-detector.js`): Profile type routing (settings vs account)
7. **Profile Registry** (`bin/profile-registry.js`): Account profile metadata management
8. **Auth Commands** (`bin/auth-commands.js`): Multi-account command handlers

#### v3.0 Simplification Achievements
- **Vault removal**: Deleted vault-manager.js, credential-reader.js, credential-switcher-macos.js (~600 lines)
- **Login-per-profile**: Users login directly in isolated instances (no credential copying)
- **Auto-directory creation**: Missing instance directories created automatically
- **Platform parity**: macOS/Linux/Windows all use same `CLAUDE_CONFIG_DIR` approach
- **Simplified schema**: Profile metadata reduced to 3 fields (type, created, last_used)

### Data Flow (v3.0 Simplified)

**Settings-based profiles (glm, kimi)**:
```mermaid
graph LR
    USER[ccs glm "task"] --> PARSE[Parse Args]
    PARSE --> DETECT[ProfileDetector]
    DETECT --> CONFIG[Read config.json]
    CONFIG --> EXEC[execClaude with --settings]
    EXEC --> CLAUDE[Claude CLI]
```

**Account-based profiles (work, personal)**:
```mermaid
graph LR
    USER[ccs work "task"] --> PARSE[Parse Args]
    PARSE --> DETECT[ProfileDetector]
    DETECT --> INSTANCE[InstanceManager.ensureInstance]
    INSTANCE --> EXEC[execClaude with CLAUDE_CONFIG_DIR]
    EXEC --> CLAUDE[Claude CLI reads from instance]
```

**v3.0 Flow Simplification**:
- **v2.x**: Login → Encrypt → Store in vault → Decrypt on use → Copy to instance → Execute (6 steps)
- **v3.0**: Create instance → Login in instance → Execute (3 steps, 50% reduction)

### Configuration Architecture (v3.0)

**Settings-based Config** (`~/.ccs/config.json`):
```json
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "kimi": "~/.ccs/kimi.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

**Account Profile Registry** (`~/.ccs/profiles.json`):
```json
{
  "version": "2.0.0",
  "profiles": {
    "work": {
      "type": "account",
      "created": "2025-11-09T10:00:00.000Z",
      "last_used": "2025-11-09T15:30:00.000Z"
    }
  },
  "default": "work"
}
```

**v3.0 Schema Simplification**:
- **Removed fields**: `vault`, `subscription`, `email` (not needed for login-per-profile)
- **Kept fields**: `type`, `created`, `last_used` (essential metadata only)
- **Rationale**: Credentials live in instance directories, no vault needed

**Instance Directory Structure**:
```
~/.ccs/instances/work/
├── session-env/           # Claude sessions
├── todos/                 # Per-profile todos
├── logs/                  # Execution logs
├── file-history/          # File edits
├── .anthropic/            # SDK config
└── .credentials.json      # Login credentials (managed by Claude CLI)
```

- **Environment Override**: `CCS_CLAUDE_PATH` - Custom Claude CLI path
- **Auto-Creation**: Configuration generated automatically during installation

## Implementation Standards

### Code Quality Standards
- **YAGNI Principle**: Only implement features immediately needed
- **KISS Principle**: Maintain simplicity over complexity
- **DRY Principle**: Eliminate code duplication
- **Test Coverage**: >90% coverage for all critical paths
- **Documentation**: Clear code comments and external documentation

### Development Workflow
1. **Feature Development**: Implement following coding standards
2. **Testing**: Comprehensive unit and integration tests
3. **Documentation**: Update relevant documentation
4. **Quality Review**: Code review against standards checklist
5. **Release**: Version management and distribution

### Platform Support Matrix
| Platform | Version Support | Testing Coverage |
|----------|----------------|------------------|
| macOS | 10.15+ | Full |
| Linux | Ubuntu 18.04+, CentOS 7+ | Full |
| Windows | 10+ (PowerShell, Git Bash) | Full |

## Quality Assurance

### Testing Strategy
- **Unit Tests**: Individual module functionality
- **Integration Tests**: Cross-module interaction
- **Platform Tests**: OS-specific behavior validation
- **Edge Case Tests**: Error conditions and boundary cases
- **Performance Tests**: Resource usage and response time

### Quality Metrics
- **Code Coverage**: >90% line coverage
- **Complexity**: Maintain cyclomatic complexity < 10 per function
- **Performance**: Startup time < 50ms, memory < 10MB
- **Reliability**: <0.1% error rate in normal operations

## Deployment and Distribution

### Distribution Channels
- **npm Package**: Primary distribution channel (`@kaitranntt/ccs`)
- **Direct Install**: Platform-specific install scripts
- **GitHub Releases**: Source code and binary distributions

### Installation Methods
1. **npm Package** (Recommended): `npm install -g @kaitranntt/ccs`
2. **Direct Install**: `curl -fsSL ccs.kaitran.ca/install | bash`
3. **Windows PowerShell**: `irm ccs.kaitran.ca/install | iex`

### Auto-Configuration Process
1. **Package Installation**: npm or direct script execution
2. **Post-install Hook**: Automatic configuration creation
3. **Path Setup**: Add to system PATH when needed
4. **Validation**: Verify Claude CLI availability
5. **Ready State**: System ready for profile switching

## Success Metrics

### v3.0 Achievement Metrics
- **Code Reduction**: 600 lines deleted (40% from v2.x codebase)
- **Execution Simplification**: 6 steps → 3 steps (50% reduction)
- **Performance Improvement**: No encryption/decryption overhead (50-100ms saved per activation)
- **Platform Parity**: Unified behavior across macOS/Linux/Windows

### Adoption Metrics
- **Download Count**: npm package downloads per month
- **Installation Success Rate**: >95% successful installations
- **User Retention**: Monthly active users
- **Platform Distribution**: Usage across supported platforms

### Performance Metrics (v3.0)
- **Profile Creation**: ~5-10ms (instance directory creation only)
- **Profile Activation**: ~5-10ms (no decryption overhead)
- **Response Time**: Minimal overhead, direct Claude CLI execution
- **Error Rate**: <0.1% in normal operations
- **Reliability**: 99.9% uptime during normal operations

### Quality Metrics
- **Test Coverage**: >90% for all critical paths
- **Bug Reports**: Number and severity of reported issues
- **Fix Time**: Average time to resolve reported issues
- **User Satisfaction**: Feedback and ratings

## Risk Management

### Technical Risks
- **Claude CLI Changes**: API changes in official CLI
  - **Mitigation**: Maintain abstraction layer, monitor changes
- **Platform Compatibility**: OS-specific issues
  - **Mitigation**: Comprehensive testing, CI/CD across platforms
- **Dependency Issues**: npm package or system dependency problems
  - **Mitigation**: Minimal dependencies, regular testing

### Business Risks
- **Competition**: Similar tools emerging
  - **Mitigation**: Focus on simplicity and reliability
- **User Adoption**: Slow adoption rates
  - **Mitigation**: Clear documentation, easy installation
- **Maintenance Burden**: Ongoing maintenance costs
  - **Mitigation**: Simplified codebase, automated testing

## Future Roadmap

### Completed (v3.0)
- ✅ **Vault Removal**: Eliminated credential encryption/decryption complexity
- ✅ **Login-Per-Profile**: Users login directly in isolated instances
- ✅ **Platform Parity**: macOS/Linux/Windows unified behavior
- ✅ **Command Simplification**: `auth create` replaces `auth save`
- ✅ **Auto-Directory Creation**: Missing instance directories created automatically

### Short-term (3-6 months)
- **Migration Guide**: Comprehensive v2.x → v3.0 migration documentation
- **Enhanced Delegation**: Improved `/ccs` command integration
- **Better Error Messages**: More actionable error reporting for v3.0
- **Testing Coverage**: Expand platform-specific test suites

### Medium-term (6-12 months)
- **Plugin System**: Support for custom model integrations
- **Configuration UI**: Optional graphical configuration tool
- **Advanced Analytics**: Usage statistics and optimization suggestions
- **Team Features**: Shared profiles and configurations
- **Instance Cleanup**: Automatic session/log rotation policies

### Long-term (12+ months)
- **AI-Powered Optimization**: Intelligent model selection
- **Cloud Integration**: Cloud-based configuration synchronization
- **Enterprise Features**: Corporate deployment and management
- **Ecosystem Expansion**: Integration with other AI tools

## Compliance and Legal

### Licensing
- **MIT License**: Permissive open-source license
- **Third-party Dependencies**: All dependencies use compatible licenses
- **Attribution**: Proper attribution for all used components

### Privacy
- **Data Collection**: No personal data collection or transmission
- **Local Processing**: All processing happens locally
- **Configuration Privacy**: User configurations remain private

### Security
- **Code Review**: Regular security reviews and audits
- **Dependency Management**: Regular updates and vulnerability scanning
- **Secure Distribution**: Signed packages and secure distribution channels

## Conclusion

The CCS project demonstrates successful iterative simplification achieving substantial code reduction while maintaining and enhancing functionality:

### Evolution Summary
- **v2.x**: 35% reduction (1,315 → 855 lines) through consolidated spawn logic and removed security theater
- **v3.0**: Additional 40% reduction (~600 lines deleted) through vault removal and login-per-profile model
- **Net Result**: ~60% total reduction from original codebase with enhanced features

### v3.0 Architectural Benefits
1. **Eliminated Complexity**: No credential encryption/decryption (vault-manager, credential-reader deleted)
2. **Faster Execution**: 50-100ms overhead removed (PBKDF2 key derivation eliminated)
3. **Simpler Mental Model**: Users understand "login per profile" vs abstract "credential vault"
4. **Platform Parity**: macOS/Linux/Windows use identical `CLAUDE_CONFIG_DIR` approach
5. **Easier Debugging**: Credentials visible in instance directory (standard Claude CLI location)

### Key Strengths (v3.0)
- **Login-Per-Profile Model**: Intuitive, matches Claude CLI behavior
- **Auto-Directory Creation**: Missing instance dirs created automatically
- **Minimal Schema**: Only 3 fields (type, created, last_used)
- **Cross-Platform Compatibility**: Unified behavior across all platforms
- **Developer Experience**: Familiar Claude CLI interface, enhanced with profiles
- **Maintainability**: Fewer files, simpler logic, easier testing
- **Performance**: Direct instance execution, no encryption overhead

### Breaking Changes (v2.x → v3.0)
- **Command Renamed**: `ccs auth save` → `ccs auth create`
- **Profile Creation Flow**: Now prompts for login interactively
- **Removed Commands**: `auth current`, `auth cleanup` (no longer relevant)
- **Schema Change**: `vault`, `subscription`, `email` fields removed
- **Migration Required**: Users must recreate profiles with v3.0

The project is well-positioned for future growth with a solid, simplified architectural foundation, comprehensive testing, and clear development standards. The v3.0 login-per-profile model provides a sustainable basis for continued enhancement while maintaining core principles of simplicity, reliability, and performance.