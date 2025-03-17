'use strict';

import * as vscode from 'vscode';
import { Breadcrumb, BreadcrumbPoint } from '../../models/breadcrumb';
import { fullPathToRelative } from '../../utils';

export class ExportBreadcrumbsWebview implements vscode.WebviewViewProvider {
  public static readonly viewType = 'export-breadcrumbs-view';

  private _view?: vscode.WebviewView;
  private breadcrumbs: Map<string, Breadcrumb>;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    breadcrumbs: Map<string, Breadcrumb>,
  ) {
    this.breadcrumbs = breadcrumbs;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'exportBreadcrumbs': {
          exportBreadcrumbs(data.breadcrumbIds, this.breadcrumbs);
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'src',
        'webviews',
        'assets',
        'exportBreadcrumbs.js',
      ),
    );
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'assets', 'reset.css'),
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'src',
        'webviews',
        'assets',
        'vscode.css',
      ),
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'assets', 'main.css'),
    );

    // Get all breadcrumbs and create checkboxes
    const breadcrumbsCheckboxes = Array.from(this.breadcrumbs.entries())
      .map(([id, breadcrumb]) => {
        return `
          <div class="checkbox-item">
            <input type="checkbox" id="breadcrumb-${id}" value="${id}" checked>
            <label for="breadcrumb-${id}"> ${breadcrumb.label} (${breadcrumb.points.length} points)</label>
          </div>
        `;
      })
      .join('');

    const noBreadcrumbsMessage = this.breadcrumbs.size === 0 
      ? '<p>No breadcrumbs available. Create breadcrumbs using the "Security-Notes: Create Breadcrumb" command.</p>'
      : '';

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${styleResetUri}" rel="stylesheet">
          <link href="${styleVSCodeUri}" rel="stylesheet">
          <link href="${styleMainUri}" rel="stylesheet">
        </head>
        <body>
          <h3>Export Breadcrumbs</h3>
          
          ${noBreadcrumbsMessage}
          
          <div id="breadcrumbs-selection" class="${this.breadcrumbs.size === 0 ? 'hidden' : ''}">
            <p>Select breadcrumbs to export:</p>
            <div class="checkbox-container">
              ${breadcrumbsCheckboxes}
            </div>

            <p>Export format:</p>
            <p>
              <select id="format-select">
                <option value="html">HTML with Visual Diagram</option>
              </select>
            </p>
            </br>

            <p>
              <button class="export-breadcrumbs-button" ${this.breadcrumbs.size === 0 ? 'disabled' : ''}>Export</button>
            </p>
          </div>

          <script src="${scriptUri}"></script>
        </body>
      </html>`;
  }
}

async function exportBreadcrumbs(
  breadcrumbIds: string[],
  breadcrumbsMap: Map<string, Breadcrumb>,
) {
  // Filter the selected breadcrumbs
  const selectedBreadcrumbs = breadcrumbIds
    .map((id) => breadcrumbsMap.get(id))
    .filter((breadcrumb): breadcrumb is Breadcrumb => !!breadcrumb);

  if (!selectedBreadcrumbs.length) {
    vscode.window.showInformationMessage('[Export] No breadcrumbs selected.');
    return;
  }

  // Generate the HTML document with diagrams
  const htmlContent = await generateBreadcrumbsHTML(selectedBreadcrumbs);

  // Create a new document with the HTML content
  const document = await vscode.workspace.openTextDocument({
    content: htmlContent,
    language: 'html',
  });
  
  vscode.window.showTextDocument(document);
}

async function generateBreadcrumbsHTML(breadcrumbs: Breadcrumb[]): Promise<string> {
  // Collect all the code snippets asynchronously
  const breadcrumbsWithSnippets = await Promise.all(
    breadcrumbs.map(async (breadcrumb) => {
      const pointsWithSnippets = await Promise.all(
        breadcrumb.points.map(async (point) => {
          const snippet = await getCodeSnippet(point.uri, point.range);
          return {
            ...point,
            snippet,
            fileName: getFileName(point.uri),
            lineNumber: point.range.start.line + 1,
          };
        })
      );
      
      return {
        id: breadcrumb.id,
        label: breadcrumb.label,
        points: pointsWithSnippets,
      };
    })
  );

  // Generate the HTML document with mermaid diagrams
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Breadcrumbs Export</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.0/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8f9fa;
    }
    .breadcrumb-container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      margin-bottom: 30px;
      padding: 20px;
    }
    .breadcrumb-title {
      font-size: 24px;
      margin-bottom: 20px;
      color: #2c3e50;
      border-bottom: 2px solid #e9ecef;
      padding-bottom: 10px;
    }
    .diagram-container {
      margin: 20px 0;
      background-color: white;
      border-radius: 5px;
      padding: 15px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .code-points-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    .code-point {
      background-color: #f8f9fa;
      border-radius: 5px;
      padding: 15px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .code-point-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-weight: bold;
      border-bottom: 1px solid #e9ecef;
      padding-bottom: 5px;
    }
    .tag {
      color: #e67e22;
      font-weight: bold;
      font-size: 14px;
    }
    .ordinal {
      background-color: #3498db;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      margin-right: 8px;
    }
    .file-info {
      color: #7f8c8d;
      font-size: 12px;
      font-family: monospace;
    }
    .code-snippet {
      background-color: #2c3e50;
      color: #ecf0f1;
      border-radius: 5px;
      padding: 10px;
      font-family: 'Courier New', Courier, monospace;
      overflow-x: auto;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .path-description {
      margin: 20px 0;
      padding: 15px;
      background-color: #e3f2fd;
      border-radius: 5px;
      font-size: 16px;
      line-height: 1.8;
    }
  </style>
</head>
<body>
  <h1>Security Notes - Breadcrumbs Export</h1>
  
  ${breadcrumbsWithSnippets.map(breadcrumb => `
    <div class="breadcrumb-container">
      <h2 class="breadcrumb-title">${breadcrumb.label}</h2>
      
      <div class="diagram-container">
        <div class="mermaid">
          flowchart LR
          ${breadcrumb.points.map((point, idx) => 
            `    node${idx}["${point.ordinal + 1}. ${point.tag} (${point.fileName}:${point.lineNumber})"]`
          ).join('\n')}
          
          ${breadcrumb.points.slice(0, -1).map((_, idx) => 
            `    node${idx} --> node${idx + 1}`
          ).join('\n')}
          
          classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px;
          classDef active fill:#ffebcc,stroke:#e67e22,stroke-width:2px;
          
          ${breadcrumb.points.map((_, idx) => 
            `    class node${idx} active;`
          ).join('\n')}
        </div>
      </div>
      
      <div class="path-description">
        <strong>Path Description:</strong> This breadcrumb tracks ${breadcrumb.points.map((point, idx) => 
          `<strong>${idx + 1}. ${point.tag}</strong>${idx < breadcrumb.points.length - 1 ? ' → ' : ''}`
        ).join('')}
      </div>
      
      <div class="code-points-container">
        ${breadcrumb.points.map(point => `
          <div class="code-point">
            <div class="code-point-header">
              <div>
                <span class="ordinal">${point.ordinal + 1}</span>
                <span class="tag">${point.tag}</span>
              </div>
              <div class="file-info">${point.fileName}:${point.lineNumber}</div>
            </div>
            <div class="code-snippet">${escapeHtml(point.snippet)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')}

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      mermaid.initialize({
        startOnLoad: true,
        theme: 'neutral',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis'
        }
      });
    });
  </script>
</body>
</html>`;

  return html;
}

// Helper function to get the filename from a URI
function getFileName(uri: vscode.Uri): string {
  const path = uri.path;
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1] || '';
}

// Helper function to get a code snippet for a given URI and range
async function getCodeSnippet(uri: vscode.Uri, range: vscode.Range): Promise<string> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const newRange = new vscode.Range(
      new vscode.Position(range.start.line, 0),
      new vscode.Position(range.end.line + 1, 0)
    );
    return document.getText(newRange).trimEnd();
  } catch (err: any) {
    console.error('Error getting code snippet:', err);
    return `Error loading snippet: ${err.message || 'Unknown error'}`;
  }
}

// Helper function to escape HTML special characters
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}