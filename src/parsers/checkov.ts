'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';
import { relativePathToFull } from '../utils';

class CheckovParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];

    try {
      const checkovCheckTypes = JSON.parse(fileContent);
      checkovCheckTypes.map((checkovCheckType: any) => {
        const checkovFindings = checkovCheckType.results.failed_checks;
        checkovFindings.map((checkovFinding: any) => {
          // uri
          const uri = vscode.Uri.file(relativePathToFull(checkovFinding.file_path));

          // range
          const range = new vscode.Range(
            checkovFinding.file_line_range[0] - 1,
            0,
            checkovFinding.file_line_range[1] - 1,
            0,
          );

          // instantiate tool finding and add to list
          const toolFinding = new ToolFinding(
            uri,
            range,
            checkovFinding.check_name,
            'checkov',
          );
          toolFindings.push(toolFinding);
        });
      });
    } catch {
      /* empty */
    }

    return toolFindings;
  }
}

export { CheckovParser };
