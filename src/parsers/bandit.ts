'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';
import { relativePathToFull } from '../utils';
import { isNonEmptyString, toPositiveLineNumber } from './utils';

class BanditParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];
    const banditFindings = JSON.parse(fileContent).results;

    if (!Array.isArray(banditFindings)) {
      return toolFindings;
    }

    banditFindings.forEach((banditFinding: any) => {
      const startLine = Array.isArray(banditFinding.line_range)
        ? toPositiveLineNumber(banditFinding.line_range[0])
        : undefined;
      const endLine = Array.isArray(banditFinding.line_range)
        ? toPositiveLineNumber(banditFinding.line_range[1]) ?? startLine
        : undefined;
      if (
        !isNonEmptyString(banditFinding.filename) ||
        !isNonEmptyString(banditFinding.issue_text) ||
        startLine === undefined ||
        endLine === undefined
      ) {
        return;
      }

      // uri
      const uri = vscode.Uri.file(relativePathToFull(banditFinding.filename));

      // range
      const range = new vscode.Range(
        startLine - 1,
        0,
        endLine - 1,
        0,
      );

      // instantiate tool finding and add to list
      const toolFinding = new ToolFinding(uri, range, banditFinding.issue_text);
      toolFindings.push(toolFinding);
    });

    return toolFindings;
  }
}

export { BanditParser };
