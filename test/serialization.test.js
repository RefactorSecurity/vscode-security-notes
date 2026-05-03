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

const { Serializer } = require('../out/persistence/serialization/serializer');
const { Deserializer } = require('../out/persistence/serialization/deserializer');
const { Resource } = require('../out/reactions/resource');

Resource.extensionPath = path.join(workspaceRoot, 'extension');

const reactionIconPath = path.join(
  Resource.extensionPath,
  'resources/reactions/thumbs_up.png',
);

const createThread = () => ({
  contextValue: 'note-1',
  uri: Uri.file(path.join(workspaceRoot, 'src/example.ts')),
  range: new Range(4, 0, 6, 0),
  comments: [
    {
      author: { name: 'Alice' },
      body: '[TODO] Review token validation',
      reactions: [
        {
          count: 2,
          iconPath: Uri.file(reactionIconPath),
          label: 'thumbs up',
        },
      ],
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      author: { name: 'Bob' },
      body: 'Check refresh-token reuse.',
      reactions: [],
      timestamp: new Date('2026-01-01T00:05:00.000Z'),
    },
  ],
});

test('Serializer stores note thread paths relative to the workspace', () => {
  const serialized = Serializer.serializeThread(createThread());

  assert.equal(serialized.id, 'note-1');
  assert.equal(serialized.uri, 'src/example.ts');
  assert.deepEqual(serialized.range, { startLine: 4, endLine: 6 });
  assert.equal(serialized.comments.length, 2);
  assert.equal(serialized.comments[0].author, 'Alice');
  assert.equal(serialized.comments[0].body, '[TODO] Review token validation');
  assert.equal(serialized.comments[0].reactions[0].iconPath, 'resources/reactions/thumbs_up.png');
});

test('Deserializer restores threads, comments, reactions, and reply actions', () => {
  const serialized = Serializer.serializeThread(createThread());
  const deserialized = Deserializer.deserializeThread(serialized);

  assert.equal(deserialized.contextValue, 'note-1');
  assert.equal(deserialized.uri.fsPath, path.join(workspaceRoot, 'src/example.ts'));
  assert.equal(deserialized.range.start.line, 4);
  assert.equal(deserialized.range.end.line, 6);
  assert.equal(deserialized.comments.length, 2);
  assert.equal(deserialized.comments[0].body, '[TODO] Review token validation');
  assert.equal(deserialized.comments[0].author.name, 'Alice');
  assert.equal(deserialized.comments[0].parent, deserialized);
  assert.equal(deserialized.comments[0].contextValue, undefined);
  assert.equal(deserialized.comments[1].contextValue, 'canDelete');
  assert.equal(deserialized.comments[0].timestamp.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(deserialized.comments[0].reactions[0].iconPath, reactionIconPath);
  assert.equal(deserialized.comments[0].reactions[0].authorHasReacted, false);
});

test('Deserializer keeps compatibility with comments that do not include reactions', () => {
  const deserialized = Deserializer.deserializeThread({
    id: 'note-2',
    uri: 'src/legacy.ts',
    range: { startLine: 1, endLine: 1 },
    comments: [
      {
        author: 'Legacy User',
        body: 'Saved before reactions were present.',
        timestamp: '2025-01-01T00:00:00.000Z',
      },
    ],
  });

  assert.equal(deserialized.contextValue, 'note-2');
  assert.equal(deserialized.comments[0].author.name, 'Legacy User');
  assert.deepEqual(deserialized.comments[0].reactions, []);
});
