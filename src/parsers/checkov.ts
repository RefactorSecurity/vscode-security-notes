'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';
import { relativePathToFull } from '../utils';
import { isNonEmptyString, toPositiveLineNumber } from './utils';

class CheckovParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];
    const checkovCheckTypes = JSON.parse(fileContent);

    if (!Array.isArray(checkovCheckTypes)) {
      return toolFindings;
    }

    checkovCheckTypes.forEach((checkovCheckType: any) => {
      const checkovFindings = checkovCheckType.results?.failed_checks;
      if (!Array.isArray(checkovFindings)) {
        return;
      }

      checkovFindings.forEach((checkovFinding: any) => {
        const startLine = Array.isArray(checkovFinding.file_line_range)
          ? toPositiveLineNumber(checkovFinding.file_line_range[0])
          : undefined;
        const endLine = Array.isArray(checkovFinding.file_line_range)
          ? toPositiveLineNumber(checkovFinding.file_line_range[1])
          : undefined;
        if (
          !isNonEmptyString(checkovFinding.file_path) ||
          !isNonEmptyString(checkovFinding.check_name) ||
          startLine === undefined ||
          endLine === undefined
        ) {
          return;
        }

        // uri
        const uri = vscode.Uri.file(relativePathToFull(checkovFinding.file_path));

        // range
        const range = new vscode.Range(
          startLine - 1,
          0,
          endLine - 1,
          0,
        );

        // instantiate tool finding and add to list
        const toolFinding = new ToolFinding(uri, range, checkovFinding.check_name);
        toolFindings.push(toolFinding);
      });
    });

    return toolFindings;
  }
}

export { CheckovParser };
