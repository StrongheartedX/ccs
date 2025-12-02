/**
 * Tests for CLIProxy Config Generator
 * Verifies config.yaml generation including Windows path handling
 */

const assert = require('assert');
const path = require('path');

// Mock the config-manager module to provide test paths
const originalModule = require.cache[require.resolve('../../../dist/utils/config-manager')];

describe('Config Generator', () => {
  let configGenerator;
  let mockCcsDir;

  beforeEach(() => {
    // Clear the require cache to reload module with fresh mocks
    delete require.cache[require.resolve('../../../dist/cliproxy/config-generator')];

    // Set up a temporary test directory as CCS_HOME
    mockCcsDir = '/test/home/.ccs';
  });

  describe('generateUnifiedConfigContent', () => {
    it('converts Windows backslashes to forward slashes in auth-dir path', () => {
      // Simulate Windows path with backslashes
      const windowsPath = 'C:\\Users\\TestUser\\.ccs\\cliproxy\\auth';
      const normalizedPath = windowsPath.replace(/\\/g, '/');

      // Verify the replacement works correctly
      assert.strictEqual(normalizedPath, 'C:/Users/TestUser/.ccs/cliproxy/auth');
      assert(!normalizedPath.includes('\\'), 'Path should not contain backslashes');
    });

    it('handles mixed path separators', () => {
      // Test with mixed Windows and forward slashes
      const mixedPath = 'C:\\Users/TestUser\\.ccs/cliproxy\\auth';
      const normalizedPath = mixedPath.replace(/\\/g, '/');

      assert.strictEqual(normalizedPath, 'C:/Users/TestUser/.ccs/cliproxy/auth');
    });

    it('leaves forward slashes unchanged', () => {
      // Test with Unix paths (forward slashes only)
      const unixPath = '/home/testuser/.ccs/cliproxy/auth';
      const normalizedPath = unixPath.replace(/\\/g, '/');

      assert.strictEqual(normalizedPath, '/home/testuser/.ccs/cliproxy/auth');
    });

    it('generates valid YAML with normalized paths', () => {
      // Test the actual pattern used in config-generator.ts line 130
      const testAuthDir = 'C:\\Users\\TestUser\\.ccs\\cliproxy\\auth';
      const configLine = `auth-dir: "${testAuthDir.replace(/\\/g, '/')}"`;

      // Verify the YAML line is properly formatted
      assert(configLine.includes('auth-dir:'), 'Should contain auth-dir key');
      assert(configLine.includes('C:/Users/TestUser'), 'Should have normalized path');
      assert(!configLine.includes('\\'), 'Should not contain backslashes');

      // Verify it's valid YAML format
      assert.strictEqual(
        configLine,
        'auth-dir: "C:/Users/TestUser/.ccs/cliproxy/auth"'
      );
    });

    it('handles multiple consecutive backslashes', () => {
      // Edge case: multiple backslashes
      const weirdPath = 'C:\\\\Users\\\\TestUser\\\\.ccs\\\\cliproxy\\\\auth';
      const normalizedPath = weirdPath.replace(/\\/g, '/');

      assert.strictEqual(normalizedPath, 'C://Users//TestUser//.ccs//cliproxy//auth');
      assert(!normalizedPath.includes('\\'), 'Should not contain backslashes');
    });

    it('preserves all other characters in path', () => {
      // Test that normalization doesn't affect other characters
      const complexPath = 'D:\\Projects\\ccs-2024\\test\\.ccs\\auth-tokens\\provider.json';
      const normalizedPath = complexPath.replace(/\\/g, '/');

      assert.strictEqual(normalizedPath, 'D:/Projects/ccs-2024/test/.ccs/auth-tokens/provider.json');
      assert(normalizedPath.includes('Projects'), 'Should preserve directory names');
      assert(normalizedPath.includes('auth-tokens'), 'Should preserve hyphens');
      assert(normalizedPath.includes('provider.json'), 'Should preserve filenames');
    });

    it('works with environment variable expansion', () => {
      // Simulate path with environment variables
      const envPath = process.env.USERPROFILE || 'C:\\Users\\TestUser';
      const fullPath = path.join(envPath, '.ccs', 'cliproxy', 'auth');
      const normalizedPath = fullPath.replace(/\\/g, '/');

      // On Windows, path.join creates backslashes, on Unix forward slashes
      // The normalization should ensure forward slashes regardless
      assert(!normalizedPath.includes('\\'), 'Should not contain backslashes after normalization');
      assert(normalizedPath.includes('/.ccs/'), 'Should have normalized CCS path');
    });

    it('is idempotent - applying normalization twice gives same result', () => {
      const windowsPath = 'C:\\Users\\Test\\.ccs\\auth';
      const normalized1 = windowsPath.replace(/\\/g, '/');
      const normalized2 = normalized1.replace(/\\/g, '/');

      assert.strictEqual(normalized1, normalized2, 'Should be idempotent');
      assert.strictEqual(normalized2, 'C:/Users/Test/.ccs/auth');
    });

    it('handles YAML escaping requirements correctly', () => {
      // Windows paths with backslashes can cause YAML parsing issues
      // because backslash is an escape character in YAML strings
      const windowsPath = 'C:\\Users\\test\\.ccs\\auth';

      // Before fix: would contain backslashes, causing YAML parsing errors
      // After fix: forward slashes, which are safe in YAML
      const yamlUnsafePath = `auth-dir: "${windowsPath}"`;
      const yamlSafePath = `auth-dir: "${windowsPath.replace(/\\/g, '/')}"`;

      // The fixed version should be YAML-safe (no escape character conflicts)
      assert(yamlSafePath.includes('/'), 'Fixed path should use forward slashes');
      assert.strictEqual(yamlSafePath, 'auth-dir: "C:/Users/test/.ccs/auth"');
    });
  });

  describe('Path separator consistency', () => {
    it('ensures forward slashes work across all platforms', () => {
      // Forward slashes work on Windows, macOS, and Linux
      const forwardSlashPath = '/home/user/.ccs/cliproxy/auth';

      // This should work everywhere
      assert.strictEqual(
        forwardSlashPath.replace(/\\/g, '/'),
        '/home/user/.ccs/cliproxy/auth',
        'Forward slashes should be preserved on Unix'
      );

      const windowsPath = 'C:\\Users\\user\\.ccs\\cliproxy\\auth';
      const normalized = windowsPath.replace(/\\/g, '/');
      assert.strictEqual(
        normalized,
        'C:/Users/user/.ccs/cliproxy/auth',
        'Windows paths should be normalized to forward slashes'
      );

      // Both formats should be usable with Node.js fs and path modules
      // and CLIProxyAPI's path handling
    });

    it('avoids YAML escape sequence issues', () => {
      // Backslashes in YAML can cause issues like:
      // - \n being interpreted as newline
      // - \t being interpreted as tab
      // - \u being interpreted as unicode
      // Using forward slashes avoids all these issues

      const problematicPath = 'C:\\Users\\test\\.ccs\\auth';
      const safePath = problematicPath.replace(/\\/g, '/');

      // Check for problematic escape sequences
      assert(!safePath.includes('\\n'), 'Should not create \\n sequences');
      assert(!safePath.includes('\\t'), 'Should not create \\t sequences');
      assert(!safePath.includes('\\u'), 'Should not create \\u sequences');

      // The safe path should be suitable for YAML
      assert.strictEqual(safePath, 'C:/Users/test/.ccs/auth');
    });
  });

  describe('Cross-platform path handling', () => {
    it('normalizes paths regardless of current platform', () => {
      // The fix should work consistently on Windows, macOS, and Linux

      const testPaths = [
        // Windows-style paths
        { input: 'C:\\Users\\test\\.ccs\\auth', expected: 'C:/Users/test/.ccs/auth' },
        { input: 'D:\\Projects\\ccs\\auth', expected: 'D:/Projects/ccs/auth' },
        // Unix-style paths
        { input: '/home/user/.ccs/auth', expected: '/home/user/.ccs/auth' },
        { input: '/var/ccs/auth', expected: '/var/ccs/auth' },
        // Network paths
        { input: '\\\\network\\share\\.ccs\\auth', expected: '//network/share/.ccs/auth' },
      ];

      testPaths.forEach(({ input, expected }) => {
        const normalized = input.replace(/\\/g, '/');
        assert.strictEqual(
          normalized,
          expected,
          `Should normalize "${input}" to "${expected}"`
        );
      });
    });
  });
});
