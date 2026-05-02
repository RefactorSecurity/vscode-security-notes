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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-notes-breadcrumbs-'));
const persistenceFile = path.join(tempDir, 'breadcrumbs.json');

installVsCodeMock();
setConfiguration('breadcrumbs.localDatabase', persistenceFile);

const { BreadcrumbStore } = require('../out/breadcrumbs/store');
const {
  loadBreadcrumbsFromFile,
  saveBreadcrumbsToFile,
} = require('../out/persistence/local-db/breadcrumbs');

test.after(() => {
  fs.rmSync(tempDir, { force: true, recursive: true });
});

test.beforeEach(() => {
  fs.rmSync(persistenceFile, { force: true });
});

test('loadBreadcrumbsFromFile returns empty state when no file exists', () => {
  assert.deepEqual(loadBreadcrumbsFromFile(), {
    activeTrailId: undefined,
    trails: [],
  });
});

test('saveBreadcrumbsToFile does not create an empty persistence file', () => {
  saveBreadcrumbsToFile(new BreadcrumbStore());

  assert.equal(fs.existsSync(persistenceFile), false);
});

test('breadcrumb persistence saves relative paths and restores trail state', () => {
  const store = new BreadcrumbStore();
  const trail = store.createTrail('Authorization path', {
    description: 'Review admin permission checks',
  });
  const crumb = store.addCrumb(
    trail.id,
    Uri.file(path.join(workspaceRoot, 'src/authz.ts')),
    new Range(10, 4, 12, 18),
    'authorizeAdmin(request.user);',
    { note: 'Admin gate' },
  );

  saveBreadcrumbsToFile(store);

  const persisted = JSON.parse(fs.readFileSync(persistenceFile, 'utf8'));
  assert.equal(persisted.activeTrailId, trail.id);
  assert.equal(persisted.trails[0].id, trail.id);
  assert.equal(persisted.trails[0].crumbs[0].id, crumb.id);
  assert.equal(persisted.trails[0].crumbs[0].uri, 'src/authz.ts');
  assert.deepEqual(persisted.trails[0].crumbs[0].range, {
    startLine: 10,
    startCharacter: 4,
    endLine: 12,
    endCharacter: 18,
  });

  const loaded = loadBreadcrumbsFromFile();
  assert.equal(loaded.activeTrailId, trail.id);
  assert.equal(loaded.trails[0].name, 'Authorization path');
  assert.equal(loaded.trails[0].description, 'Review admin permission checks');
  assert.equal(loaded.trails[0].crumbs[0].uri.fsPath, path.join(workspaceRoot, 'src/authz.ts'));
  assert.equal(loaded.trails[0].crumbs[0].range.start.character, 4);
  assert.equal(loaded.trails[0].crumbs[0].note, 'Admin gate');
});

test('loadBreadcrumbsFromFile returns empty state for invalid JSON', () => {
  fs.writeFileSync(persistenceFile, '{', 'utf8');

  assert.deepEqual(loadBreadcrumbsFromFile(), {
    activeTrailId: undefined,
    trails: [],
  });
});
