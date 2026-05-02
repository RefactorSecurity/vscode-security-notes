const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { installVsCodeMock, workspaceRoot } = require('./support/vscode');

installVsCodeMock();

const {
  identifyPotentialDuplicates,
  parseToolFindings,
} = require('../out/webviews/import-tool-results/importToolResultsWebview');

test('identifyPotentialDuplicates matches existing imported finding authors', () => {
  const noteMap = new Map([
    [
      'note-1',
      {
        comments: [
          {
            author: { name: 'semgrep' },
            body: 'Existing finding',
          },
        ],
      },
    ],
  ]);

  assert.equal(identifyPotentialDuplicates('semgrep', noteMap), true);
  assert.equal(identifyPotentialDuplicates('Semgrep', noteMap), true);
  assert.equal(identifyPotentialDuplicates('bandit', noteMap), false);
});

test('identifyPotentialDuplicates ignores empty threads', () => {
  const noteMap = new Map([
    [
      'note-1',
      {
        comments: [],
      },
    ],
  ]);

  assert.equal(identifyPotentialDuplicates('semgrep', noteMap), false);
});

test('parseToolFindings dispatches supported tools', () => {
  const findings = parseToolFindings('semgrep', JSON.stringify({
    results: [
      {
        path: 'src/server.ts',
        start: { line: 10 },
        end: { line: 10 },
        extra: { message: 'Detected unsafe redirect' },
      },
    ],
  }));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].uri.fsPath, path.join(workspaceRoot, 'src/server.ts'));
  assert.equal(findings[0].range.start.line, 9);
  assert.equal(findings[0].text, 'Detected unsafe redirect');
});

test('parseToolFindings rejects unsupported tools', () => {
  assert.throws(
    () => parseToolFindings('unknown', '{}'),
    /Unsupported tool: unknown\./,
  );
});
