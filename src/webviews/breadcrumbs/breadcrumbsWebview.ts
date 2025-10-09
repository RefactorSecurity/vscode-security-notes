'use strict';

import * as vscode from 'vscode';
import { BreadcrumbStore } from '../../breadcrumbs/store';
import { Crumb, Trail } from '../../models/breadcrumb';
import { formatRangeLabel, snippetPreview } from '../../breadcrumbs/format';
import { fullPathToRelative } from '../../utils';
import { revealCrumb } from '../../breadcrumbs/commands';

interface WebviewCrumb {
  id: string;
  index: number;
  filePath: string;
  rangeLabel: string;
  note?: string;
  snippetPreview: string;
  snippet: string;
  createdAt: string;
}

interface WebviewTrail {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  crumbs: WebviewCrumb[];
}

interface WebviewStatePayload {
  activeTrailId?: string;
  trails: {
    id: string;
    name: string;
    crumbCount: number;
  }[];
  activeTrail?: WebviewTrail;
}

type WebviewMessage =
  | { type: 'ready' }
  | { type: 'openCrumb'; trailId: string; crumbId: string }
  | { type: 'setActiveTrail'; trailId: string }
  | { type: 'createTrail' }
  | { type: 'addCrumb' };

export class BreadcrumbsWebview implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'breadcrumbs-view';

  private view: vscode.WebviewView | undefined;

  private isViewReady = false;

  private pendingTrailId: string | undefined;

  private readonly storeListener: vscode.Disposable;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly store: BreadcrumbStore,
  ) {
    this.storeListener = this.store.onDidChange(() => {
      this.tryPostState();
    });
  }

  public dispose() {
    this.storeListener.dispose();
  }

  public reveal(trailId?: string) {
    if (trailId) {
      this.pendingTrailId = trailId;
    }
    vscode.commands.executeCommand('workbench.view.extension.view-container');
    vscode.commands.executeCommand(`${BreadcrumbsWebview.viewType}.focus`);
    if (this.view) {
      this.view.show?.(true);
      this.tryPostState(trailId);
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      switch (message.type) {
        case 'ready': {
          this.isViewReady = true;
          this.tryPostState(this.pendingTrailId);
          this.pendingTrailId = undefined;
          break;
        }
        case 'openCrumb': {
          this.handleOpenCrumb(message.trailId, message.crumbId);
          break;
        }
        case 'setActiveTrail': {
          this.store.setActiveTrail(message.trailId);
          break;
        }
        case 'createTrail': {
          vscode.commands.executeCommand('security-notes.breadcrumbs.createTrail');
          break;
        }
        case 'addCrumb': {
          vscode.commands.executeCommand('security-notes.breadcrumbs.addCrumb');
          break;
        }
        default: {
          break;
        }
      }
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
      this.isViewReady = false;
    });
  }

  private tryPostState(trailId?: string) {
    if (!this.view || !this.isViewReady) {
      if (trailId) {
        this.pendingTrailId = trailId;
      }
      return;
    }

    const state = this.store.getState();
    const targetTrailId = trailId ?? state.activeTrailId;
    let activeTrail = targetTrailId
      ? state.trails.find((trail) => trail.id === targetTrailId)
      : state.trails.find((trail) => trail.id === state.activeTrailId);

    if (!activeTrail && state.trails.length) {
      activeTrail = state.trails[0];
    }

    const payload: WebviewStatePayload = {
      activeTrailId: state.activeTrailId ?? activeTrail?.id,
      trails: state.trails.map((trail) => ({
        id: trail.id,
        name: trail.name,
        crumbCount: trail.crumbs.length,
      })),
      activeTrail: activeTrail ? this.serializeTrail(activeTrail) : undefined,
    };

    this.view.webview.postMessage({ type: 'state', payload });
  }

  private serializeTrail(trail: Trail): WebviewTrail {
    return {
      id: trail.id,
      name: trail.name,
      description: trail.description,
      createdAt: trail.createdAt,
      updatedAt: trail.updatedAt,
      crumbs: trail.crumbs.map((crumb, index) => this.serializeCrumb(trail, crumb, index)),
    };
  }

  private serializeCrumb(trail: Trail, crumb: Crumb, index: number): WebviewCrumb {
    return {
      id: crumb.id,
      index,
      filePath: fullPathToRelative(crumb.uri.fsPath),
      rangeLabel: formatRangeLabel(crumb.range),
      note: crumb.note,
      snippetPreview: snippetPreview(crumb.snippet),
      snippet: crumb.snippet,
      createdAt: crumb.createdAt,
    };
  }

  private handleOpenCrumb(trailId: string, crumbId: string) {
    const trail = this.store.getTrail(trailId);
    if (!trail) {
      vscode.window.showErrorMessage('[Breadcrumbs] Unable to locate the requested trail.');
      return;
    }
    const crumb = trail.crumbs.find((candidate) => candidate.id === crumbId);
    if (!crumb) {
      vscode.window.showErrorMessage('[Breadcrumbs] Unable to locate the requested crumb.');
      return;
    }
    revealCrumb(crumb);
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        'src',
        'webviews',
        'assets',
        'breadcrumbs.js',
      ),
    );
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webviews', 'assets', 'reset.css'),
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webviews', 'assets', 'vscode.css'),
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webviews', 'assets', 'main.css'),
    );
    const styleBreadcrumbsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        'src',
        'webviews',
        'assets',
        'breadcrumbs.css',
      ),
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleResetUri}" rel="stylesheet">
    <link href="${styleVSCodeUri}" rel="stylesheet">
    <link href="${styleMainUri}" rel="stylesheet">
    <link href="${styleBreadcrumbsUri}" rel="stylesheet">
  </head>
  <body>
    <section class="breadcrumbs-header">
      <div>
        <h2 class="breadcrumbs-title">Breadcrumb trails</h2>
        <p class="breadcrumbs-subtitle">Visualise how you navigated complex features.</p>
      </div>
      <div class="breadcrumbs-actions">
        <button class="breadcrumbs-button" data-action="create">New trail</button>
        <button class="breadcrumbs-button" data-action="add">Add crumb</button>
      </div>
    </section>
    <section>
      <label class="breadcrumbs-select-label" for="trail-select">Active trail</label>
      <select id="trail-select" class="breadcrumbs-select"></select>
    </section>
    <section id="breadcrumbs-content" class="breadcrumbs-content">
      <p class="breadcrumbs-empty">Loading breadcrumbs...</p>
    </section>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

const getNonce = () => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};
