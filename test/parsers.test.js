const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  installVsCodeMock,
  Range,
  Uri,
  workspaceRoot,
} = require('./support/vscode');

installVsCodeMock();

const { BanditParser } = require('../out/parsers/bandit');
const { BrakemanParser } = require('../out/parsers/brakeman');
const { CheckovParser } = require('../out/parsers/checkov');
const { GosecParser } = require('../out/parsers/gosec');
const { SemgrepParser } = require('../out/parsers/semgrep');
const { generateTrailMarkdown } = require('../out/breadcrumbs/export');

test('BanditParser maps JSON results to workspace-relative findings', () => {
  const findings = BanditParser.parse(JSON.stringify({
    results: [
      {
        filename: 'app/example.py',
        line_range: [3, 5],
        issue_text: 'Possible hardcoded password',
      },
    ],
  }));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].uri.fsPath, path.join(workspaceRoot, 'app/example.py'));
  assert.equal(findings[0].range.start.line, 2);
  assert.equal(findings[0].range.end.line, 4);
  assert.equal(findings[0].text, 'Possible hardcoded password');
});

test('BrakemanParser includes warning type in finding text', () => {
  const findings = BrakemanParser.parse(JSON.stringify({
    warnings: [
      {
        file: 'app/controllers/users_controller.rb',
        line: 12,
        warning_type: 'SQL Injection',
        message: 'Possible SQL injection',
      },
    ],
  }));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].range.start.line, 11);
  assert.equal(findings[0].text, 'SQL Injection: Possible SQL injection');
});

test('CheckovParser maps failed checks from each check type', () => {
  const findings = CheckovParser.parse(JSON.stringify([
    {
      results: {
        failed_checks: [
          {
            file_path: 'infra/main.tf',
            file_line_range: [7, 9],
            check_name: 'Ensure bucket encryption is enabled',
          },
        ],
      },
    },
  ]));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].uri.fsPath, path.join(workspaceRoot, 'infra/main.tf'));
  assert.equal(findings[0].range.start.line, 6);
  assert.equal(findings[0].range.end.line, 8);
});

test('GosecParser preserves absolute file paths from results', () => {
  const absolutePath = path.join(workspaceRoot, 'cmd/server/main.go');
  const findings = GosecParser.parse(JSON.stringify({
    Issues: [
      {
        file: absolutePath,
        line: '22',
        details: 'Potential file inclusion via variable',
      },
    ],
  }));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].uri.fsPath, absolutePath);
  assert.equal(findings[0].range.start.line, 21);
  assert.equal(findings[0].text, 'Potential file inclusion via variable');
});

test('SemgrepParser maps result ranges and messages', () => {
  const findings = SemgrepParser.parse(JSON.stringify({
    results: [
      {
        path: 'src/server.ts',
        start: { line: 4 },
        end: { line: 6 },
        extra: { message: 'Detected unsafe redirect' },
      },
    ],
  }));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].uri.fsPath, path.join(workspaceRoot, 'src/server.ts'));
  assert.equal(findings[0].range.start.line, 3);
  assert.equal(findings[0].range.end.line, 5);
  assert.equal(findings[0].text, 'Detected unsafe redirect');
});

test('parsers throw for malformed JSON', () => {
  assert.throws(() => BanditParser.parse('{'), SyntaxError);
  assert.throws(() => BrakemanParser.parse('{'), SyntaxError);
  assert.throws(() => CheckovParser.parse('{'), SyntaxError);
  assert.throws(() => GosecParser.parse('{'), SyntaxError);
  assert.throws(() => SemgrepParser.parse('{'), SyntaxError);
});

test('parsers return no findings for unsupported valid shapes', () => {
  assert.deepEqual(BanditParser.parse('{}'), []);
  assert.deepEqual(BrakemanParser.parse('{}'), []);
  assert.deepEqual(CheckovParser.parse('{}'), []);
  assert.deepEqual(GosecParser.parse('{}'), []);
  assert.deepEqual(SemgrepParser.parse('{}'), []);
});

test('breadcrumb markdown uses a fence longer than snippet backtick runs', () => {
  const markdown = generateTrailMarkdown({
    id: 'trail-1',
    name: 'Auth flow',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    crumbs: [
      {
        id: 'crumb-1',
        trailId: 'trail-1',
        uri: Uri.file(path.join(workspaceRoot, 'src/example.ts')),
        range: new Range(0, 0, 0, 10),
        snippet: 'const markdown = ```nested```;',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  });

  assert.match(markdown, /\n````\nconst markdown = ```nested```;\n````\n/);
});
