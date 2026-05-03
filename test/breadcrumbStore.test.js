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

const { BreadcrumbStore } = require('../out/breadcrumbs/store');

test('BreadcrumbStore creates a trail and sets it active by default', () => {
  const store = new BreadcrumbStore();
  const trail = store.createTrail('Login flow', {
    description: 'Authentication review',
  });

  assert.equal(store.getState().activeTrailId, trail.id);
  assert.equal(store.getActiveTrail().name, 'Login flow');
  assert.equal(store.getActiveTrail().description, 'Authentication review');
});

test('BreadcrumbStore deletes the active trail and selects a remaining trail', () => {
  const store = new BreadcrumbStore();
  const first = store.createTrail('First trail');
  const second = store.createTrail('Second trail');

  store.setActiveTrail(first.id);
  store.deleteTrail(first.id);

  assert.equal(store.getState().activeTrailId, second.id);
  assert.equal(store.getActiveTrail().name, 'Second trail');

  store.deleteTrail(second.id);

  assert.equal(store.getState().activeTrailId, undefined);
  assert.equal(store.getActiveTrail(), undefined);
});

test('BreadcrumbStore stores crumbs and returns cloned state', () => {
  const store = new BreadcrumbStore();
  const trail = store.createTrail('Payment flow');
  const crumb = store.addCrumb(
    trail.id,
    Uri.file(path.join(workspaceRoot, 'src/payments.ts')),
    new Range(3, 2, 5, 12),
    'chargeCustomer();',
    { note: 'Payment capture starts here' },
  );

  assert.equal(crumb.note, 'Payment capture starts here');

  const state = store.getState();
  state.trails[0].name = 'Mutated outside the store';
  state.trails[0].crumbs[0].snippet = 'mutated();';
  state.trails[0].crumbs[0].range.start.line = 100;

  const storedTrail = store.getTrail(trail.id);
  assert.equal(storedTrail.name, 'Payment flow');
  assert.equal(storedTrail.crumbs[0].snippet, 'chargeCustomer();');
  assert.equal(storedTrail.crumbs[0].range.start.line, 3);
});

test('BreadcrumbStore emits changes for mutations', () => {
  const store = new BreadcrumbStore();
  let changeCount = 0;
  const subscription = store.onDidChange(() => {
    changeCount += 1;
  });

  const trail = store.createTrail('Session flow');
  store.renameTrail(trail.id, 'Session lifecycle');
  store.deleteTrail(trail.id);
  subscription.dispose();
  store.createTrail('No listener');

  assert.equal(changeCount, 3);
});
