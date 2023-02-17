'use strict';

import * as vscode from 'vscode';
import { commentController } from '../controllers/comments';
import { SemgrepParser } from '../parsers/semgrep';
import { ToolFinding } from '../models/toolFinding';
import { saveNoteComment } from '../helpers';
import { RemoteDb } from '../persistence/remote-db';

export class ImportToolResultsWebview implements vscode.WebviewViewProvider {
  public static readonly viewType = 'import-tool-results-view';

  private _view?: vscode.WebviewView;
  private noteMap: Map<string, vscode.CommentThread>;
  private remoteDb: RemoteDb | undefined;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    noteMap: Map<string, vscode.CommentThread>,
    remoteDb: RemoteDb | undefined,
  ) {
    this.noteMap = noteMap;
    this.remoteDb = remoteDb ? remoteDb : undefined;
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
          processToolFile(
            data.toolName,
            data.fileContent,
            this.noteMap,
            this.remoteDb,
          );
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
  noteMap: Map<string, vscode.CommentThread>,
  remoteDb: RemoteDb | undefined,
) {
  let toolFindings: ToolFinding[] = [];

  // parse tool findings
  switch (toolName) {
    case 'semgrep': {
      toolFindings = SemgrepParser.parse(fileContent);
    }
  }

  if (!toolFindings.length) {
    vscode.window.showErrorMessage('An error has ocurred while parsing the file.');
    return;
  }

  if (noteMap.size && identifyPotentialDuplicates(toolName, noteMap)) {
    vscode.window
      .showWarningMessage(
        `Potential duplicates. Current comments already include findings from ${toolName}. Do you want to import findings anyway?`,
        'Yes',
        'No',
      )
      .then((answer) => {
        if (answer === 'Yes') {
          saveToolFindings(toolFindings, noteMap, toolName, remoteDb);
        }
      });
  } else {
    saveToolFindings(toolFindings, noteMap, toolName, remoteDb);
  }
}

function identifyPotentialDuplicates(
  toolName: string,
  noteMap: Map<string, vscode.CommentThread>,
) {
  // return noteList.some((thread) => {
  //   return thread.comments[0].author.name === toolName;
  // });
  return false;
}

function saveToolFindings(
  toolFindings: ToolFinding[],
  noteMap: Map<string, vscode.CommentThread>,
  toolName: string,
  remoteDb: RemoteDb | undefined,
) {
  // instantiate comments based on parsed tool findings
  toolFindings.forEach((toolFinding: ToolFinding) => {
    const newThread = commentController.createCommentThread(
      toolFinding.uri,
      toolFinding.range,
      [],
    );
    saveNoteComment(newThread, toolFinding.text, true, noteMap, toolName, remoteDb);
  });
  vscode.window.showInformationMessage(
    `${toolFindings.length} findings were imported successfully.`,
  );
}
