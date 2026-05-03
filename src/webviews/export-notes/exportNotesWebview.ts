'use strict';

import * as vscode from 'vscode';
import { NoteStatus } from '../../models/noteStatus';
import { fullPathToRelative } from '../../utils';
import { getNonce, getWebviewContentSecurityPolicy } from '../security';

export class ExportNotesWebview implements vscode.WebviewViewProvider {
  public static readonly viewType = 'export-notes-view';

  private _view?: vscode.WebviewView;
  private noteMap: Map<string, vscode.CommentThread>;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    noteMap: Map<string, vscode.CommentThread>,
  ) {
    this.noteMap = noteMap;
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
        case 'exportNotes': {
          exportNotes(data.status, data.options, data.format, this.noteMap);
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
        'exportNotes.js',
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
    const nonce = getNonce();
    const csp = getWebviewContentSecurityPolicy(webview, nonce);

    return `<!DOCTYPE html>
			  <html lang="en">
				  <head>
					  <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="${csp}">
            <link href="${styleResetUri}" rel="stylesheet">
            <link href="${styleVSCodeUri}" rel="stylesheet">
            <link href="${styleMainUri}" rel="stylesheet">
				  </head>
				  <body>
            <p>Select the notes you want to export:</p>
            <p>
              <input type="checkbox" id="vulnerable-notes" value="vulnerable-notes" checked>
              <label for="vulnerable-notes"> Vulnerable</label></br>
              <input type="checkbox" id="not-vulnerable-notes" value="not-vulnerable-notes" checked>
              <label for="not-vulnerable-notes"> Not Vulnerable</label></br>
              <input type="checkbox" id="todo-notes" value="todo-notes" checked>
              <label for="todo-notes"> TODO</label></br>
              <input type="checkbox" id="no-status-notes" value="no-status-notes" checked>
              <label for="no-status-notes"> No Status</label></br>
            </p>
            </br>

            <p>Select additional options:</p>
            <p>
              <input type="checkbox" id="include-code-snippet" name="include-code-snippet" value="include-code-snippet" checked>
              <label for="include-code-snippet"> Include code snippet</label></br>
            </p>
            <p>
              <input type="checkbox" id="include-note-replies" name="include-note-replies" value="include-note-replies" checked>
              <label for="include-note-replies"> Include note replies</label></br>
            </p>
            <p>
              <input type="checkbox" id="include-authors" name="include-authors" value="include-authors" checked>
              <label for="include-authors"> Include authors</label></br>
            </p>
            </br>

            <p>Select export format:</p>
            <p>
              <select id="format-select">
              <option value="markdown">Markdown</option>
              </select>
            </p>
            </br>

            <p>
              <button class="export-notes-button">Export</button>
            </p>

            <script nonce="${nonce}" src="${scriptUri}"></script>
				  </body>
			  </html>`;
  }
}

interface ExportStatusSelection {
  vulnerable?: boolean;
  notVulnerable?: boolean;
  todo?: boolean;
  noStatus?: boolean;
}

const STATUS_PREFIXES = Object.values(NoteStatus).map((status) => `[${status}] `);

export function hasKnownStatusPrefix(body: string) {
  return STATUS_PREFIXES.some((prefix) => body.startsWith(prefix));
}

export function noteMatchesExportStatus(
  note: vscode.CommentThread,
  status: ExportStatusSelection,
) {
  const firstComment = note.comments[0];
  if (!firstComment) {
    return false;
  }

  const firstCommentBody = firstComment.body.toString();
  return (
    (status.vulnerable && firstCommentBody.startsWith(`[${NoteStatus.Vulnerable}] `)) ||
    (
      status.notVulnerable &&
      firstCommentBody.startsWith(`[${NoteStatus.NotVulnerable}] `)
    ) ||
    (status.todo && firstCommentBody.startsWith(`[${NoteStatus.TODO}] `)) ||
    (status.noStatus && !hasKnownStatusPrefix(firstCommentBody))
  );
}

export function selectNotesForExport(
  noteMap: Map<string, vscode.CommentThread>,
  status: ExportStatusSelection,
) {
  return [...noteMap.values()].filter((note) => noteMatchesExportStatus(note, status));
}

async function exportNotes(
  status: any,
  options: any,
  format: string,
  noteMap: Map<string, vscode.CommentThread>,
) {
  // filter notes based on selected status
  const selectedNotes = selectNotesForExport(noteMap, status);

  if (!selectedNotes.length) {
    vscode.window.showInformationMessage('[Export] No notes met the criteria.');
    return;
  }

  switch (format) {
    case 'markdown': {
      const outputs = await Promise.all(
        selectedNotes.map(async (note: any) => {
          // include code snippet
          if (options.includeCodeSnippet) {
            const codeSnippet = await exportCodeSnippet(note.uri, note.range);
            return codeSnippet + exportComments(note, options);
          }
          return exportComments(note, options);
        }),
      );

      const document = await vscode.workspace.openTextDocument({
        content: outputs.join(''),
        language: 'markdown',
      });
      vscode.window.showTextDocument(document);
    }
  }
}

function exportComments(note: vscode.CommentThread, options: any) {
  // export first comment
  let output = '';
  output += exportComment(
    note.comments[0].body.toString(),
    options.includeAuthors ? note.comments[0].author.name : undefined,
  );

  // include replies
  if (options.includeReplies) {
    note.comments.slice(1).forEach((comment: vscode.Comment) => {
      output += exportComment(
        comment.body.toString(),
        options.includeAuthors ? comment.author.name : undefined,
      );
    });
  }

  output += `\n-----\n`;
  return output;
}

function exportComment(body: string, author: string | undefined) {
  if (author) {
    return `\n**${author}** - ${body}\n`;
  }
  return `\n${body}\n`;
}

async function exportCodeSnippet(uri: vscode.Uri, range: vscode.Range) {
  const output = await vscode.workspace.openTextDocument(uri).then(async (document) => {
    const newRange = new vscode.Range(range.start.line, 0, range.end.line + 1, 0);
    const codeSnippet = await document.getText(newRange).trimEnd();

    let lineNumbers;
    if (range.start.line === range.end.line) {
      lineNumbers = range.start.line + 1;
    } else {
      lineNumbers = `${range.start.line + 1}-${range.end.line + 1}`;
    }

    return `\nCode snippet \`${fullPathToRelative(
      uri.fsPath,
    )}:${lineNumbers}\`:\n\n\`\`\`\n${codeSnippet}\n\`\`\`\n`;
  });
  return output;
}
