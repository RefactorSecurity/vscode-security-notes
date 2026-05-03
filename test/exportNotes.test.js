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

const {
  hasKnownStatusPrefix,
  noteMatchesExportStatus,
  selectNotesForExport,
} = require('../out/webviews/export-notes/exportNotesWebview');

const createNote = (id, body) => ({
  contextValue: id,
  uri: Uri.file(path.join(workspaceRoot, 'src/example.ts')),
  range: new Range(0, 0, 0, 0),
  comments: [
    {
      author: { name: 'Reviewer' },
      body,
    },
  ],
});

test('hasKnownStatusPrefix recognizes supported status prefixes', () => {
  assert.equal(hasKnownStatusPrefix('[TODO] Investigate later'), true);
  assert.equal(hasKnownStatusPrefix('[Vulnerable] SQL injection'), true);
  assert.equal(hasKnownStatusPrefix('[Not Vulnerable] Sanitized input'), true);
  assert.equal(hasKnownStatusPrefix('No status yet'), false);
});

test('noteMatchesExportStatus treats noStatus as notes without known status only', () => {
  assert.equal(
    noteMatchesExportStatus(createNote('todo', '[TODO] Investigate later'), {
      noStatus: true,
    }),
    false,
  );
  assert.equal(
    noteMatchesExportStatus(createNote('plain', 'Investigate later'), {
      noStatus: true,
    }),
    true,
  );
});

test('selectNotesForExport filters by selected statuses', () => {
  const notes = new Map([
    ['vuln', createNote('vuln', '[Vulnerable] SQL injection')],
    ['not-vuln', createNote('not-vuln', '[Not Vulnerable] Escaped output')],
    ['todo', createNote('todo', '[TODO] Confirm sanitizer behavior')],
    ['plain', createNote('plain', 'Review this manually')],
  ]);

  assert.deepEqual(
    selectNotesForExport(notes, { vulnerable: true, noStatus: true })
      .map((note) => note.contextValue),
    ['vuln', 'plain'],
  );
  assert.deepEqual(
    selectNotesForExport(notes, { notVulnerable: true, todo: true })
      .map((note) => note.contextValue),
    ['not-vuln', 'todo'],
  );
});

test('noteMatchesExportStatus ignores empty comment threads', () => {
  assert.equal(
    noteMatchesExportStatus({ comments: [] }, { noStatus: true }),
    false,
  );
});
