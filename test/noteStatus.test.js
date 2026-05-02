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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-notes-status-'));
const persistenceFile = path.join(tempDir, 'notes.json');

installVsCodeMock();
setConfiguration('localDatabase', persistenceFile);

const { setNoteStatus } = require('../out/helpers');
const { NoteStatus } = require('../out/models/noteStatus');
const { Resource } = require('../out/reactions/resource');

Resource.icons = {
  reactions: {
    CONFUSED: Uri.file(path.join(workspaceRoot, 'resources/reactions/confused.png')),
    EYES: Uri.file(path.join(workspaceRoot, 'resources/reactions/eyes.png')),
    HEART: Uri.file(path.join(workspaceRoot, 'resources/reactions/heart.png')),
    HOORAY: Uri.file(path.join(workspaceRoot, 'resources/reactions/hooray.png')),
    LAUGH: Uri.file(path.join(workspaceRoot, 'resources/reactions/laugh.png')),
    ROCKET: Uri.file(path.join(workspaceRoot, 'resources/reactions/rocket.png')),
    THUMBS_DOWN: Uri.file(path.join(workspaceRoot, 'resources/reactions/thumbs_down.png')),
    THUMBS_UP: Uri.file(path.join(workspaceRoot, 'resources/reactions/thumbs_up.png')),
  },
};
Resource.extensionPath = workspaceRoot;

const createThread = (body = 'Review password reset token handling') => ({
  contextValue: 'note-1',
  uri: Uri.file(path.join(workspaceRoot, 'src/auth.ts')),
  range: new Range(0, 0, 0, 0),
  comments: [
    {
      author: { name: 'Alice' },
      body,
      savedBody: body,
      reactions: [],
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

test('setNoteStatus prefixes the main comment and preserves thread identity', () => {
  const thread = createThread();
  const noteMap = new Map([[thread.contextValue, thread]]);

  setNoteStatus(thread, NoteStatus.Vulnerable, noteMap, 'Reviewer');

  assert.equal(thread.contextValue, 'note-1');
  assert.equal(thread.comments[0].body, '[Vulnerable] Review password reset token handling');
  assert.equal(thread.comments[0].savedBody, 'Review password reset token handling');
  assert.equal(thread.comments.length, 2);
  assert.equal(thread.comments[1].body, 'Status changed to Vulnerable.');
  assert.equal(thread.comments[1].author.name, 'Reviewer');
  assert.equal(thread.comments[1].contextValue, 'canDelete');
});

test('setNoteStatus replaces an existing status prefix', () => {
  const thread = createThread('[TODO] Review password reset token handling');
  const noteMap = new Map([[thread.contextValue, thread]]);

  setNoteStatus(thread, NoteStatus.NotVulnerable, noteMap, 'Reviewer');

  assert.equal(
    thread.comments[0].body,
    '[Not Vulnerable] Review password reset token handling',
  );
  assert.equal(thread.comments[0].savedBody, 'Review password reset token handling');
});

test('setNoteStatus appends optional reply text to the status change comment', () => {
  const thread = createThread();
  const noteMap = new Map([[thread.contextValue, thread]]);

  setNoteStatus(
    thread,
    NoteStatus.TODO,
    noteMap,
    'Reviewer',
    undefined,
    'Need to verify framework defaults.',
  );

  assert.equal(
    thread.comments[1].body,
    'Status changed to TODO.\n\nNeed to verify framework defaults.',
  );
});
