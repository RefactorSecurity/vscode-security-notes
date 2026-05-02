'use strict';

import * as vscode from 'vscode';
import { commentController } from '../../controllers/comments';
import { BanditParser } from '../../parsers/bandit';
import { BrakemanParser } from '../../parsers/brakeman';
import { CheckovParser } from '../../parsers/checkov';
import { GosecParser } from '../../parsers/gosec';
import { SemgrepParser } from '../../parsers/semgrep';
import { ToolFinding } from '../../models/toolFinding';
import { saveNoteComment } from '../../helpers';
import { RemoteDb } from '../../persistence/remote-db';

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
        case 'importError': {
          vscode.window.showErrorMessage(`[Import] ${data.message}`);
          break;
        }
        case 'processToolFile': {
          processToolFile(data.toolName, data.fileContent, this.noteMap, this.remoteDb);
          break;
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
        'importToolResults.js',
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
                <option value="bandit">bandit (JSON)</option>
                <option value="brakeman">brakeman (JSON)</option>
                <option value="checkov">checkov (JSON)</option>
                <option value="gosec">gosec (JSON)</option>
                <option value="semgrep">semgrep (JSON)</option>
              </select>
            </p>
            </br>

            <p>Select file:</p>
            <p>
              <input class=".color-input" type="file" id="fileInput"></input>
            </p>
            </br>

            <p>
              <button class="process-file-button">Import</button>
            </p>

            <script src="${scriptUri}"></script>
				  </body>
			  </html>`;
  }
}

export function parseToolFindings(toolName: string, fileContent: string): ToolFinding[] {
  switch (toolName) {
    case 'bandit': {
      return BanditParser.parse(fileContent);
    }
    case 'brakeman': {
      return BrakemanParser.parse(fileContent);
    }
    case 'checkov': {
      return CheckovParser.parse(fileContent);
    }
    case 'gosec': {
      return GosecParser.parse(fileContent);
    }
    case 'semgrep': {
      return SemgrepParser.parse(fileContent);
    }
    default: {
      throw new Error(`Unsupported tool: ${toolName}.`);
    }
  }
}

function processToolFile(
  toolName: string,
  fileContent: string,
  noteMap: Map<string, vscode.CommentThread>,
  remoteDb: RemoteDb | undefined,
) {
  let toolFindings: ToolFinding[] = [];

  try {
    toolFindings = parseToolFindings(toolName, fileContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;
    vscode.window.showErrorMessage(
      `[Import] Failed to parse ${toolName} results: ${message}`,
    );
    return;
  }

  if (!toolFindings.length) {
    vscode.window.showErrorMessage(
      '[Import] No findings were found in the selected file.',
    );
    return;
  }

  if (noteMap.size && identifyPotentialDuplicates(toolName, noteMap)) {
    vscode.window
      .showWarningMessage(
        `[Import] Potential duplicates. Current comments already include findings from ${toolName}. Do you want to import findings anyway?`,
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

export function identifyPotentialDuplicates(
  toolName: string,
  noteMap: Map<string, vscode.CommentThread>,
) {
  return [...noteMap.values()].some((thread) => {
    const firstComment = thread.comments[0];
    return firstComment?.author.name.toLowerCase() === toolName.toLowerCase();
  });
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
    `[Import] ${toolFindings.length} findings were imported successfully.`,
  );
}
