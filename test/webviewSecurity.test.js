const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  installVsCodeMock,
  Uri,
  workspaceRoot,
} = require('./support/vscode');

installVsCodeMock();

const { BreadcrumbStore } = require('../out/breadcrumbs/store');
const { BreadcrumbsWebview } = require('../out/webviews/breadcrumbs/breadcrumbsWebview');
const { ExportNotesWebview } = require('../out/webviews/export-notes/exportNotesWebview');
const { ImportToolResultsWebview } = require('../out/webviews/import-tool-results/importToolResultsWebview');
const {
  getWebviewContentSecurityPolicy,
} = require('../out/webviews/security');

const extensionUri = Uri.file(workspaceRoot);

const createWebview = () => ({
  cspSource: 'vscode-resource:',
  asWebviewUri: (uri) => `webview-resource:${uri.fsPath}`,
});

const extractNonce = (html) => {
  const match = html.match(/<script nonce="([^"]+)"/);
  return match ? match[1] : undefined;
};

const assertWebviewSecurity = (html) => {
  const nonce = extractNonce(html);
  assert.match(nonce, /^[A-Za-z0-9]{32}$/);
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="[^"]+">/);
  assert.match(
    html,
    new RegExp(`script-src 'nonce-${nonce}'`),
  );
  assert.match(html, /default-src 'none'/);
  assert.match(html, /img-src vscode-resource: data:/);
  assert.match(html, /style-src vscode-resource:/);
  assert.doesNotMatch(html, /<script(?! nonce=)/);
};

test('getWebviewContentSecurityPolicy locks down webview resources', () => {
  assert.equal(
    getWebviewContentSecurityPolicy(createWebview(), 'abc123'),
    "default-src 'none'; img-src vscode-resource: data:; style-src vscode-resource:; script-src 'nonce-abc123'",
  );
});

test('import webview HTML includes CSP and nonced script', () => {
  const provider = new ImportToolResultsWebview(extensionUri, new Map(), undefined);
  const html = provider._getHtmlForWebview(createWebview());

  assertWebviewSecurity(html);
  assert.match(html, /webview-resource:.*importToolResults\.js/);
});

test('export webview HTML includes CSP and nonced script', () => {
  const provider = new ExportNotesWebview(extensionUri, new Map());
  const html = provider._getHtmlForWebview(createWebview());

  assertWebviewSecurity(html);
  assert.match(html, /webview-resource:.*exportNotes\.js/);
});

test('breadcrumbs webview HTML includes CSP and nonced script', () => {
  const provider = new BreadcrumbsWebview(extensionUri, new BreadcrumbStore());
  const html = provider.getHtmlForWebview(createWebview());

  assertWebviewSecurity(html);
  assert.match(html, /webview-resource:.*breadcrumbs\.js/);
  provider.dispose();
});
