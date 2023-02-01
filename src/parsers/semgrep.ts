'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';

class SemgrepParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];

    try {
      const semgrepFindings = JSON.parse(fileContent).results;
      semgrepFindings.map((semgrepFinding: any) => {
        // uri
        let fullPath = '';
        if (vscode.workspace.workspaceFolders) {
          fullPath = vscode.workspace.workspaceFolders[0].uri.fsPath + '/';
        }
        const uri = vscode.Uri.file(`${fullPath}${semgrepFinding.path}`);

        // range
        const range = new vscode.Range(
          semgrepFinding.start.line - 1,
          0,
          semgrepFinding.end.line - 1,
          0,
        );

        // instantiate tool finding and add to list
        const toolFinding = new ToolFinding(uri, range, semgrepFinding.extra.message);
        toolFindings.push(toolFinding);
      });
    } catch {
      /* empty */
    }

    return toolFindings;
  }
}

export { SemgrepParser };
