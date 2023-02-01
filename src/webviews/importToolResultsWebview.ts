'use strict';

import * as vscode from 'vscode';
import { commentController } from '../controllers/comments';
import { SemgrepParser } from '../parsers/semgrep';
import { ToolFinding } from '../models/toolFinding';
import { saveNoteComment } from '../helpers';

export class ImportToolResultsWebview implements vscode.WebviewViewProvider {
  public static readonly viewType = 'import-tool-results-view';

  private _view?: vscode.WebviewView;
  private noteList: vscode.CommentThread[];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    noteList: vscode.CommentThread[],
  ) {
    this.noteList = noteList;
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
        case 'processToolFile': {
          processToolFile(data.toolName, data.fileContent, this.noteList);
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'assets', 'main.js'),
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

    return `<!DOCTYPE html>
			  <html lang="en">
				  <head>
					  <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleResetUri}" rel="stylesheet">
            <link href="${styleVSCodeUri}" rel="stylesheet">
            <link href="${styleMainUri}" rel="stylesheet">
				  </head>
				  <body>
            <p>Select tool:</p>
            <p>
            <select id="toolSelect">
            <option value="semgrep">semgrep</option>
            </select>
            </p>
            <p>Select file:</p>
            <p>
            <input class=".color-input" type="file" id="fileInput"></input>
            </p>
            <p>
            <button class="process-file-button">Import</button>
            </p>
            <script src="${scriptUri}"></script>
				  </body>
			  </html>`;
  }
}

function processToolFile(
  toolName: string,
  fileContent: string,
  noteList: vscode.CommentThread[],
) {
  let toolFindings: ToolFinding[] = [];

  // parse tool findings
  switch (toolName) {
    case 'semgrep': {
      toolFindings = SemgrepParser.parse(fileContent);
    }
  }

  // instantiate comments based on parsed tool findings
  if (toolFindings.length) {
    toolFindings.map((result: ToolFinding) => {
      const newThread = commentController.createCommentThread(
        result.uri,
        result.range,
        [],
      );
      saveNoteComment(newThread, result.text, true, noteList, toolName);
    });
  }
}
