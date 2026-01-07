#!/usr/bin/env bun
/**
 * AI Code Reviewer for CCS CLI
 *
 * Fetches PR diff, calls Claude via CLIProxyAPI, posts review to GitHub.
 * Runs on self-hosted runner with localhost access to CLIProxyAPI:8317.
 *
 * Usage: bun run scripts/code-reviewer.ts <PR_NUMBER>
 * Env: CLIPROXY_API_KEY, GITHUB_REPOSITORY (optional)
 */

import { $ } from 'bun';

// Types
interface PRContext {
  number: number;
  title: string;
  body: string;
  baseRef: string;
  headRef: string;
  files: Array<{ path: string; additions: number; deletions: number }>;
  diff: string;
}

interface ReviewComment {
  path: string;
  line: number;
  body: string;
  severity: 'critical' | 'warning' | 'suggestion' | 'nitpick';
}

interface ReviewResult {
  summary: string;
  approvalStatus: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  comments: ReviewComment[];
  securityIssues: string[];
  suggestions: string[];
}

// System prompt for code review
const CODE_REVIEWER_SYSTEM_PROMPT = `You are an expert code reviewer for the CCS CLI project, a TypeScript/Node.js tool for managing Claude Code accounts.

## Your Role
Review pull requests thoroughly for:
1. **Bugs & Logic Errors** - Race conditions, off-by-one, null handling
2. **Security Issues** - Injection, secrets exposure, auth bypass
3. **Code Quality** - YAGNI, KISS, DRY violations; readability
4. **TypeScript Best Practices** - Proper typing, no \`any\`, null safety
5. **CCS Conventions** - ASCII only (no emojis), conventional commits

## Output Format
Respond with ONLY valid JSON matching this schema:

\`\`\`json
{
  "summary": "2-3 sentence overall assessment",
  "approvalStatus": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "comments": [
    {
      "path": "relative/path/to/file.ts",
      "line": 42,
      "body": "Specific feedback for this line",
      "severity": "critical" | "warning" | "suggestion" | "nitpick"
    }
  ],
  "securityIssues": ["List of security concerns if any"],
  "suggestions": ["General improvement suggestions"]
}
\`\`\`

## Guidelines
- Be constructive, not harsh
- Prioritize critical issues over nitpicks
- Reference specific lines and provide fix suggestions
- If no issues: approvalStatus = "APPROVE", comments = []
- Max 10 inline comments (focus on most important)`;

// Config
const MAX_DIFF_LINES = 10000;
const MAX_INLINE_COMMENTS = 10;
const CLIPROXY_URL = process.env.CLIPROXY_URL || 'http://localhost:8317';
const MODEL = process.env.REVIEW_MODEL || 'gemini-claude-opus-4-5-thinking';

// Fetch PR context
async function getPRContext(prNumber: number, repo: string): Promise<PRContext> {
  $.throws(true);

  // Get PR metadata
  const prJson =
    await $`gh pr view ${prNumber} --repo ${repo} --json number,title,body,baseRefName,headRefName,files`.text();
  const pr = JSON.parse(prJson);

  // Get diff
  let diff = await $`gh pr diff ${prNumber} --repo ${repo}`.text();

  // Truncate if too large
  const lines = diff.split('\n');
  if (lines.length > MAX_DIFF_LINES) {
    diff = lines.slice(0, MAX_DIFF_LINES).join('\n') + '\n\n[DIFF TRUNCATED - exceeded 10k lines]';
  }

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body || '',
    baseRef: pr.baseRefName,
    headRef: pr.headRefName,
    files: pr.files || [],
    diff,
  };
}

// Call Claude via CLIProxyAPI
async function callClaude(context: PRContext): Promise<ReviewResult> {
  const apiKey = process.env.CLIPROXY_API_KEY;
  if (!apiKey) throw new Error('CLIPROXY_API_KEY not set');

  const userMessage = `## Pull Request: ${context.title}

### Description
${context.body || '(No description provided)'}

### Changed Files
${context.files.map((f) => `- ${f.path} (+${f.additions}/-${f.deletions})`).join('\n')}

### Diff
\`\`\`diff
${context.diff}
\`\`\`

Please review this pull request and provide your assessment in the specified JSON format.`;

  const response = await fetch(`${CLIPROXY_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: CODE_REVIEWER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`CLIProxyAPI error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const content = data.content[0]?.text;

  if (!content) {
    throw new Error('Empty response from Claude');
  }

  // Parse JSON from response (may be wrapped in markdown code block)
  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

  try {
    return JSON.parse(jsonStr) as ReviewResult;
  } catch {
    // Fallback: create basic review from raw text
    console.warn('[!] Failed to parse JSON, using fallback');
    return {
      summary: content.slice(0, 500),
      approvalStatus: 'COMMENT',
      comments: [],
      securityIssues: [],
      suggestions: [],
    };
  }
}

// Format inline comment with severity badge
function formatComment(comment: ReviewComment): string {
  const badge: Record<string, string> = {
    critical: '[!] **Critical**',
    warning: '[~] **Warning**',
    suggestion: '[i] **Suggestion**',
    nitpick: '[ ] Nitpick',
  };
  return `${badge[comment.severity] || '[i]'}\n\n${comment.body}`;
}

// Post review to GitHub
async function postReview(prNumber: number, repo: string, review: ReviewResult): Promise<void> {
  // Build review body
  let body = `## AI Code Review\n\n${review.summary}\n`;

  if (review.securityIssues.length > 0) {
    body += `\n### Security Issues\n${review.securityIssues.map((i) => `- ${i}`).join('\n')}\n`;
  }

  if (review.suggestions.length > 0) {
    body += `\n### Suggestions\n${review.suggestions.map((s) => `- ${s}`).join('\n')}\n`;
  }

  if (review.comments.length > 0) {
    body += `\n### Inline Comments\n${review.comments.length} comment(s) posted on specific lines.\n`;
  }

  body += '\n---\n*Automated review by CCS AGY Code Reviewer*';

  // Map approval status to gh flag
  const eventFlag: Record<string, string> = {
    APPROVE: '--approve',
    REQUEST_CHANGES: '--request-changes',
    COMMENT: '--comment',
  };

  // Post main review (try APPROVE/REQUEST_CHANGES, fallback to COMMENT if self-PR)
  const flag = eventFlag[review.approvalStatus] || '--comment';
  const reviewResult = await $`gh pr review ${prNumber} --repo ${repo} ${flag} --body ${body}`.nothrow();

  if (reviewResult.exitCode !== 0) {
    const stderr = reviewResult.stderr.toString();
    // GitHub doesn't allow self-approval or self-request-changes - fallback to comment
    if (stderr.includes('your own pull request')) {
      console.log('[i] Self-PR detected, falling back to COMMENT');
      await $`gh pr review ${prNumber} --repo ${repo} --comment --body ${body}`;
    } else {
      throw new Error(`Failed to post review: ${stderr}`);
    }
  }

  // Post inline comments via REST API
  for (const comment of review.comments.slice(0, MAX_INLINE_COMMENTS)) {
    try {
      const commentBody = formatComment(comment);
      // Get the PR head SHA for the comment
      const prInfo = await $`gh pr view ${prNumber} --repo ${repo} --json headRefOid --jq .headRefOid`.text();
      const commitId = prInfo.trim();

      await $`gh api repos/${repo}/pulls/${prNumber}/comments --method POST \
        -f body=${commentBody} \
        -f path=${comment.path} \
        -F line=${comment.line} \
        -f side=RIGHT \
        -f commit_id=${commitId}`;
    } catch (err) {
      console.error(`[!] Failed to post inline comment on ${comment.path}:${comment.line}`, err);
    }
  }
}

// Check if already reviewed this PR (avoid spam)
async function hasRecentReview(prNumber: number, repo: string): Promise<boolean> {
  try {
    const reviews =
      await $`gh api repos/${repo}/pulls/${prNumber}/reviews --jq '[.[] | select(.body | contains("AI Code Review"))] | length'`.text();
    return parseInt(reviews.trim(), 10) > 0;
  } catch {
    return false;
  }
}

// Main
async function main() {
  const prNumber = parseInt(process.argv[2], 10);
  const repo = process.env.GITHUB_REPOSITORY || 'kaitranntt/ccs';
  const forceReview = process.argv.includes('--force');

  if (!prNumber || isNaN(prNumber)) {
    console.error('Usage: bun run scripts/code-reviewer.ts <PR_NUMBER> [--force]');
    process.exit(1);
  }

  console.log(`[i] Reviewing PR #${prNumber} in ${repo}`);

  try {
    // Check for existing review (avoid spam)
    if (!forceReview && (await hasRecentReview(prNumber, repo))) {
      console.log('[i] Already reviewed this PR. Use --force to review again.');
      process.exit(0);
    }

    // 1. Get PR context
    console.log('[i] Fetching PR context...');
    const context = await getPRContext(prNumber, repo);
    console.log(`[i] PR: "${context.title}" (${context.files.length} files changed)`);

    const diffLines = context.diff.split('\n').length;
    if (diffLines > MAX_DIFF_LINES) {
      console.log(`[!] Diff too large (${diffLines} lines), truncated to ${MAX_DIFF_LINES}`);
    }

    // 2. Call Claude
    console.log(`[i] Calling Claude (${MODEL}) for review...`);
    const review = await callClaude(context);
    console.log(`[i] Review complete: ${review.approvalStatus}`);
    console.log(`[i] Comments: ${review.comments.length}, Security issues: ${review.securityIssues.length}`);

    // 3. Post review
    console.log('[i] Posting review to PR...');
    await postReview(prNumber, repo, review);
    console.log('[OK] Review posted successfully');
  } catch (error) {
    console.error('[X] Review failed:', error);
    process.exit(1);
  }
}

main();
