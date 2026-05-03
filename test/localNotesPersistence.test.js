const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  installVsCodeMock,
  Range,
  Uri,
  setConfiguration,
  workspaceRoot,
} = require('./support/vscode');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-notes-local-db-'));
const persistenceFile = path.join(tempDir, 'notes.json');

installVsCodeMock();
setConfiguration('localDatabase', persistenceFile);

const {
  loadNotesFromFile,
  saveNotesToFile,
} = require('../out/persistence/local-db');
const { Resource } = require('../out/reactions/resource');

Resource.extensionPath = path.join(workspaceRoot, 'extension');

const reactionIconPath = path.join(
  Resource.extensionPath,
  'resources/reactions/thumbs_up.png',
);

const createThread = () => ({
  contextValue: 'note-1',
  uri: Uri.file(path.join(workspaceRoot, 'src/example.ts')),
  range: new Range(2, 0, 4, 0),
  comments: [
    {
      author: { name: 'Reviewer' },
      body: '[TODO] Review token validation',
      reactions: [
        {
          count: 1,
          iconPath: Uri.file(reactionIconPath),
          label: 'thumbs up',
        },
      ],
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
    },
  ],
});

test.after(() => {
  fs.rmSync(tempDir, { force: true, recursive: true });
});

test.beforeEach(() => {
  fs.rmSync(persistenceFile, { force: true });
});

test('loadNotesFromFile returns empty list when no file exists', () => {
  assert.deepEqual(loadNotesFromFile(), []);
});

test('saveNotesToFile does not create an empty persistence file', () => {
  saveNotesToFile(new Map());

  assert.equal(fs.existsSync(persistenceFile), false);
});

test('local note persistence saves relative paths and restores notes', () => {
  const noteMap = new Map([['note-1', createThread()]]);

  saveNotesToFile(noteMap);

  const persisted = JSON.parse(fs.readFileSync(persistenceFile, 'utf8'));
  assert.equal(persisted[0].id, 'note-1');
  assert.equal(persisted[0].uri, 'src/example.ts');
  assert.deepEqual(persisted[0].range, {
    startLine: 2,
    endLine: 4,
  });

  const loaded = loadNotesFromFile();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].contextValue, 'note-1');
  assert.equal(loaded[0].uri.fsPath, path.join(workspaceRoot, 'src/example.ts'));
  assert.equal(loaded[0].comments[0].body, '[TODO] Review token validation');
  assert.equal(loaded[0].comments[0].author.name, 'Reviewer');
});

test('loadNotesFromFile returns empty list for invalid JSON', () => {
  fs.writeFileSync(persistenceFile, '{', 'utf8');

  assert.deepEqual(loadNotesFromFile(), []);
});
