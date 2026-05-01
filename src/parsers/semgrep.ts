'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';
import { relativePathToFull } from '../utils';

class SemgrepParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];
    const semgrepFindings = JSON.parse(fileContent).results;

    if (!Array.isArray(semgrepFindings)) {
      return toolFindings;
    }

    semgrepFindings.forEach((semgrepFinding: any) => {
      // uri
      const uri = vscode.Uri.file(relativePathToFull(semgrepFinding.path));

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

    return toolFindings;
  }
}

export { SemgrepParser };
