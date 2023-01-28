'use strict';

import * as vscode from 'vscode';
import { Result } from './result';

class SemgrepParser {
  static parse(fileContent: string) {
    const results: Result[] = [];
    const obj = JSON.parse(fileContent);

    const semgrepResults = obj.results;
    semgrepResults.map((semgrepResult: any) => {
      const uri = vscode.Uri.file(
        `${vscode.workspace.workspaceFolders[0].uri.fsPath}/${semgrepResult.path}`,
      );
      const range = new vscode.Range(
        semgrepResult.start.line - 1,
        0,
        semgrepResult.end.line - 1,
        0,
      );
      const result = new Result(uri, range, semgrepResult.extra.message);
      results.push(result);
    });

    return results;
  }
}

export { SemgrepParser };
