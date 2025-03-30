'use strict';

import * as vscode from 'vscode';
import { Breadcrumb } from '../../models/breadcrumb';
import { breadcrumbsController } from '../../controllers/breadcrumbs';
import { BreadcrumbsWebview } from './breadcrumbsWebview';

export class BreadcrumbsSidebarWebview implements vscode.WebviewViewProvider {
  public static readonly viewType = 'breadcrumbs-sidebar-view';
  private _view?: vscode.WebviewView;
  private _webviewPanels: BreadcrumbsWebview[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly breadcrumbs: Map<string, Breadcrumb>
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    
    webviewView.webview.html = this.getWebviewContent();
    
    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'createBreadcrumb':
          this.createBreadcrumb(message.label);
          this.refreshWebview();
          return;
          
        case 'addBreadcrumbPoint':
          this.addBreadcrumbPoint(message.breadcrumbId, message.tag);
          return;
          
        case 'openBreadcrumbsPanel':
          this.openBreadcrumbsPanel();
          return;
          
        case 'deleteBreadcrumb':
          this.deleteBreadcrumb(message.id);
          this.refreshWebview();
          return;
      }
    });
  }

  // Refresh the webview content
  public refreshWebview() {
    if (this._view) {
      this._view.webview.html = this.getWebviewContent();
    }
    
    // Also refresh any open panels
    this._webviewPanels.forEach(panel => panel.updateContent());
  }

  // Create a new breadcrumb
  private createBreadcrumb(label: string) {
    breadcrumbsController.createBreadcrumb(label);
    this.refreshWebview();
  }

  // Delete a breadcrumb
  private deleteBreadcrumb(id: string) {
    breadcrumbsController.deleteBreadcrumb(id);
    this.refreshWebview();
  }

  // Add a point to a breadcrumb
  private async addBreadcrumbPoint(breadcrumbId: string, tag: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showErrorMessage('Please select some code to mark as a breadcrumb point');
      return;
    }

    // Add the point to the breadcrumb
    breadcrumbsController.addPointToBreadcrumb(
      breadcrumbId,
      tag, 
      selection,
      editor.document.uri
    );

    this.refreshWebview();
  }

  // Open the main breadcrumbs panel
  private openBreadcrumbsPanel() {
    const panel = new BreadcrumbsWebview(
      this.extensionUri,
      this.breadcrumbs,
      (label) => {
        this.createBreadcrumb(label);
        this.refreshWebview();
      },
      (id) => {
        this.deleteBreadcrumb(id);
        this.refreshWebview();
      },
      async (uri, range) => {
        try {
          console.log('Opening document:', uri.toString());
          const doc = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(doc);
          
          // Create a proper selection and reveal it
          const start = new vscode.Position(range.start.line, range.start.character);
          const end = new vscode.Position(range.end.line, range.end.character);
          editor.selection = new vscode.Selection(start, end);
          editor.revealRange(
            new vscode.Range(start, end),
            vscode.TextEditorRevealType.InCenter
          );
        } catch (err: any) {
          console.error('Error navigating to breadcrumb point:', err);
          vscode.window.showErrorMessage(`Error opening file: ${err.message || 'Unknown error'}`);
        }
      }
    );
    
    this._webviewPanels.push(panel);
    
    // Remove panel from array when disposed
    panel['_panel'].onDidDispose(() => {
      const index = this._webviewPanels.indexOf(panel);
      if (index !== -1) {
        this._webviewPanels.splice(index, 1);
      }
    });
  }

  // Generate the HTML for the webview
  private getWebviewContent() {
    const breadcrumbsArray = Array.from(this.breadcrumbs.values());
    
    // Generate HTML for breadcrumbs for the sidebar
    let breadcrumbsHtml = '';
    if (breadcrumbsArray.length === 0) {
      breadcrumbsHtml = '<p>No breadcrumbs created yet.</p>';
    } else {
      breadcrumbsHtml = breadcrumbsArray.map(breadcrumb => {
        return `
          <div class="breadcrumb-item" onclick="openBreadcrumbsPanel()">
            <div class="breadcrumb-header">
              <span class="breadcrumb-title">${breadcrumb.label}</span>
              <span class="badge">${breadcrumb.points.length} points</span>
            </div>
          </div>
        `;
      }).join('');
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Breadcrumbs</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 10px;
            color: var(--vscode-foreground);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .breadcrumb-item {
            margin-bottom: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 8px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .breadcrumb-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .breadcrumb-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .breadcrumb-title {
            font-weight: bold;
        }
        .badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.8em;
        }
        .breadcrumb-actions {
            display: flex;
            justify-content: space-between;
            gap: 5px;
        }
        .action-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            flex: 1;
            font-size: 11px;
        }
        .action-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .action-button.delete {
            background-color: var(--vscode-errorForeground);
        }
        input {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px;
            border-radius: 3px;
            margin-right: 5px;
            flex: 1;
        }
        .create-form {
            display: flex;
            margin-bottom: 15px;
        }
        .main-buttons {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Breadcrumbs</h2>
    </div>
    
    <div class="create-form">
        <input type="text" id="newBreadcrumbLabel" placeholder="Enter breadcrumb label">
        <button class="action-button" onclick="createBreadcrumb()">Create</button>
    </div>
    
    <div class="breadcrumbs-list">
        ${breadcrumbsHtml}
    </div>
    
    <div class="main-buttons">
        <button class="action-button" onclick="openBreadcrumbsPanel()">Open Full Panel</button>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function createBreadcrumb() {
            const label = document.getElementById('newBreadcrumbLabel').value;
            if (label) {
                vscode.postMessage({
                    command: 'createBreadcrumb',
                    label: label
                });
                document.getElementById('newBreadcrumbLabel').value = '';
            }
        }
        
        // Functions for 'add point' and 'delete' buttons removed as requested
        
        function openBreadcrumbsPanel() {
            vscode.postMessage({
                command: 'openBreadcrumbsPanel'
            });
        }
    </script>
</body>
</html>`;
  }
}