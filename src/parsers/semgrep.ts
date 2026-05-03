'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';
import { relativePathToFull } from '../utils';
import { isNonEmptyString, toPositiveLineNumber } from './utils';

class SemgrepParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];
    const semgrepFindings = JSON.parse(fileContent).results;

    if (!Array.isArray(semgrepFindings)) {
      return toolFindings;
    }

    semgrepFindings.forEach((semgrepFinding: any) => {
      const startLine = toPositiveLineNumber(semgrepFinding.start?.line);
      const endLine = toPositiveLineNumber(semgrepFinding.end?.line);
      if (
        !isNonEmptyString(semgrepFinding.path) ||
        !isNonEmptyString(semgrepFinding.extra?.message) ||
        startLine === undefined ||
        endLine === undefined
      ) {
        return;
      }

      // uri
      const uri = vscode.Uri.file(relativePathToFull(semgrepFinding.path));

      // range
      const range = new vscode.Range(
        startLine - 1,
        0,
        endLine - 1,
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
