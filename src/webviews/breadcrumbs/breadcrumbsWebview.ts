'use strict';

import * as vscode from 'vscode';
import { Breadcrumb, BreadcrumbPoint } from '../../models/breadcrumb';

export class BreadcrumbsWebview {
  public static readonly viewType = 'breadcrumbs-view';
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly breadcrumbs: Map<string, Breadcrumb>,
    private createBreadcrumbCallback: (label: string) => void,
    private deleteBreadcrumbCallback: (id: string) => void,
    private navigateToPointCallback: (uri: vscode.Uri, range: vscode.Range) => void
  ) {
    // Create and show a new webview panel
    this._panel = vscode.window.createWebviewPanel(
      BreadcrumbsWebview.viewType,
      'Breadcrumbs',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri]
      }
    );

    // Set the webview's initial html content
    this.updateContent();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'createBreadcrumb':
            this.createBreadcrumbCallback(message.label);
            this.updateContent();
            return;
          case 'deleteBreadcrumb':
            this.deleteBreadcrumbCallback(message.id);
            this.updateContent();
            return;
          case 'navigateToPoint':
            console.log('Received navigateToPoint message:', message);
            try {
              // Careful URI parsing and validation
              const uri = vscode.Uri.parse(message.uri);
              
              // Create range with validation
              const start = new vscode.Position(
                typeof message.range.start.line === 'number' ? message.range.start.line : 0,
                typeof message.range.start.character === 'number' ? message.range.start.character : 0
              );
              
              const end = new vscode.Position(
                typeof message.range.end.line === 'number' ? message.range.end.line : 0,
                typeof message.range.end.character === 'number' ? message.range.end.character : 0
              );
              
              const range = new vscode.Range(start, end);
              
              // Use both our internal method and the callback for redundancy
              this.navigateToPoint(uri, range);
              this.navigateToPointCallback(uri, range);
            } catch (err: any) {
              console.error('Error processing navigateToPoint message:', err);
              vscode.window.showErrorMessage(`Error navigating to breadcrumb point: ${err.message || 'Unknown error'}`);
            }
            return;
          case 'getCodeSnippet':
            console.log('Received getCodeSnippet message:', message);
            try {
              // Parse URI and create range as above
              const uri = vscode.Uri.parse(message.uri);
              
              const start = new vscode.Position(
                typeof message.range.start.line === 'number' ? message.range.start.line : 0,
                typeof message.range.start.character === 'number' ? message.range.start.character : 0
              );
              
              const end = new vscode.Position(
                typeof message.range.end.line === 'number' ? message.range.end.line : 0,
                typeof message.range.end.character === 'number' ? message.range.end.character : 0
              );
              
              const range = new vscode.Range(start, end);
              
              // Fetch code snippet asynchronously
              this.fetchCodeSnippet(uri, range, message.pointId);
            } catch (err: any) {
              console.error('Error processing getCodeSnippet message:', err);
              // Send error message back to webview
              this._panel.webview.postMessage({
                command: 'updateCodeSnippet',
                pointId: message.pointId,
                snippet: `Error: ${err.message || 'Unknown error'}`
              });
            }
            return;
        }
      },
      null,
      this._disposables
    );
  }
  
  // Helper method to navigate to a point
  private async navigateToPoint(uri: vscode.Uri, range: vscode.Range): Promise<void> {
    console.log('Navigating to:', uri.toString(), range);
    
    try {
      // Use async/await pattern with proper error handling
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      
      // Set selection and reveal the range
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (err: any) {
      console.error('Error navigating to breadcrumb point:', err);
      vscode.window.showErrorMessage(`Error opening document: ${err.message || 'Unknown error'}`);
    }
  }
  
  // Retrieve the code snippet for a given URI and range
  private getCodeSnippet(uri: vscode.Uri, range: vscode.Range): string {
    try {
      // We can't use await directly here as this is not an async method
      // So we return a placeholder and will update it after fetching
      return 'Loading snippet...';
    } catch (err: any) {
      console.error('Error getting code snippet:', err);
      return 'Error loading snippet';
    }
  }
  
  // Fetch code snippet asynchronously and send it back to the webview
  private async fetchCodeSnippet(uri: vscode.Uri, range: vscode.Range, pointId: string): Promise<void> {
    try {
      // Open the document to get its text
      const document = await vscode.workspace.openTextDocument(uri);
      
      // Create a range that includes the full lines
      const newRange = new vscode.Range(
        new vscode.Position(range.start.line, 0),
        new vscode.Position(range.end.line + 1, 0)
      );
      
      // Get the text from the document for the specified range
      const codeSnippet = document.getText(newRange).trimEnd();
      
      // Send the code snippet back to the webview
      this._panel.webview.postMessage({
        command: 'updateCodeSnippet',
        pointId: pointId,
        snippet: codeSnippet
      });
    } catch (err: any) {
      console.error('Error fetching code snippet:', err);
      this._panel.webview.postMessage({
        command: 'updateCodeSnippet',
        pointId: pointId,
        snippet: `Error: ${err.message || 'Unknown error'}`
      });
    }
  }

  // Update the webview content
  public updateContent() {
    this._panel.webview.html = this.getWebviewContent();
  }

  // Dispose of resources
  public dispose() {
    // Clean up resources
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  // Generate webview HTML content
  private getWebviewContent(): string {
    const breadcrumbsArray = Array.from(this.breadcrumbs.values());
    
    // Generate HTML for breadcrumbs and their points
    let breadcrumbsHtml = '';
    if (breadcrumbsArray.length === 0) {
      breadcrumbsHtml = '<p>No breadcrumbs available. Create one below!</p>';
    } else {
      breadcrumbsHtml = breadcrumbsArray.map(breadcrumb => {
        const pointsHtml = breadcrumb.points.map((point, index) => {
          // Use path.basename-like operation that works with both / and \ separators
          const pathParts = point.uri.path.split(/[\\/]/);
          const fileName = pathParts[pathParts.length - 1] || '';
          const lineNumber = point.range.start.line + 1;
          
          // Use data attributes for URI and range to avoid string escaping issues
          return `
            <div class="breadcrumb-point" data-index="${index}" data-point-id="${point.id}">
              <div class="breadcrumb-point-header">
                <div>
                  <span class="tag">${point.tag}</span>
                  <span class="ordinal">#${point.ordinal + 1}</span>
                  <span class="filename">${fileName}:${lineNumber}</span>
                </div>
                <button class="navigate-btn" data-uri="${encodeURIComponent(point.uri.toString())}" 
                  data-start-line="${point.range.start.line}" 
                  data-start-char="${point.range.start.character}" 
                  data-end-line="${point.range.end.line}" 
                  data-end-char="${point.range.end.character}">
                  Go to Point
                </button>
              </div>
              <div class="code-snippet" data-point-id="${point.id}" data-uri="${encodeURIComponent(point.uri.toString())}" 
                data-start-line="${point.range.start.line}" 
                data-start-char="${point.range.start.character}" 
                data-end-line="${point.range.end.line}" 
                data-end-char="${point.range.end.character}">
                <pre>Loading code snippet...</pre>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="breadcrumb">
            <div class="breadcrumb-header">
              <h3>${breadcrumb.label}</h3>
              <button class="delete-breadcrumb-btn" data-id="${breadcrumb.id}">Delete</button>
            </div>
            <div class="breadcrumb-points">
              ${pointsHtml || '<p>No points in this breadcrumb yet.</p>'}
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
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .breadcrumb {
            margin-bottom: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 10px;
        }
        .breadcrumb-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
        }
        .breadcrumb-point {
            display: flex;
            flex-direction: column;
            margin: 5px 0;
            padding: 5px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-radius: 3px;
        }
        .breadcrumb-point-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        }
        .code-snippet {
            margin-top: 5px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 5px;
            max-height: 200px;
            overflow: auto;
            background-color: var(--vscode-editor-background);
            font-family: monospace;
            font-size: 12px;
            width: 100%;
        }
        .code-snippet pre {
            margin: 0;
            white-space: pre-wrap;
        }
        .tag {
            font-weight: bold;
            color: orange;
            margin-right: 10px;
        }
        .ordinal {
            margin-right: 10px;
            color: var(--vscode-descriptionForeground);
        }
        .filename {
            font-family: monospace;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        input {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 5px;
            border-radius: 3px;
            margin-right: 5px;
        }
        .create-form {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
        }
    </style>
</head>
<body>
    <h2>Breadcrumbs</h2>
    
    <div class="breadcrumbs-container">
        ${breadcrumbsHtml}
    </div>
    
    <div class="create-form">
        <input type="text" id="newBreadcrumbLabel" placeholder="Enter breadcrumb label">
        <button id="createBreadcrumbBtn">Create Breadcrumb</button>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Set up event delegation for button clicks
        document.addEventListener('click', (event) => {
            // Handle create breadcrumb button
            if (event.target.matches('#createBreadcrumbBtn')) {
                createBreadcrumb();
            }
            
            // Handle delete breadcrumb buttons
            if (event.target.matches('.delete-breadcrumb-btn')) {
                const id = event.target.dataset.id;
                if (id) {
                    deleteBreadcrumb(id);
                }
            }
            
            // Handle navigate buttons
            if (event.target.matches('.navigate-btn')) {
                const button = event.target;
                const uri = decodeURIComponent(button.dataset.uri);
                const range = {
                    start: {
                        line: parseInt(button.dataset.startLine, 10),
                        character: parseInt(button.dataset.startChar, 10)
                    },
                    end: {
                        line: parseInt(button.dataset.endLine, 10),
                        character: parseInt(button.dataset.endChar, 10)
                    }
                };
                
                navigateToPoint(uri, range);
            }
        });
        
        // Load all code snippets when the page loads
        document.addEventListener('DOMContentLoaded', () => {
            loadAllCodeSnippets();
        });
        
        function loadAllCodeSnippets() {
            const snippetElements = document.querySelectorAll('.code-snippet');
            snippetElements.forEach(element => {
                const uri = decodeURIComponent(element.dataset.uri);
                const range = {
                    start: {
                        line: parseInt(element.dataset.startLine, 10),
                        character: parseInt(element.dataset.startChar, 10)
                    },
                    end: {
                        line: parseInt(element.dataset.endLine, 10),
                        character: parseInt(element.dataset.endChar, 10)
                    }
                };
                
                loadCodeSnippet(element, uri, range);
            });
        }
        
        function loadCodeSnippet(element, uri, range) {
            vscode.postMessage({
                command: 'getCodeSnippet',
                uri: uri,
                range: range,
                pointId: element.dataset.pointId
            });
        }
        
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
        
        function deleteBreadcrumb(id) {
            vscode.postMessage({
                command: 'deleteBreadcrumb',
                id: id
            });
        }
        
        function navigateToPoint(uri, range) {
            console.log('Navigating to:', uri, range);
            vscode.postMessage({
                command: 'navigateToPoint',
                uri: uri,
                range: range
            });
        }
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.command === 'updateCodeSnippet') {
                const selector = '.code-snippet[data-point-id="' + message.pointId + '"]';
                const element = document.querySelector(selector);
                if (element) {
                    element.querySelector('pre').textContent = message.snippet;
                }
            }
        });
    </script>
</body>
</html>`;
  }
}