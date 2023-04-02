'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';

class BrakemanParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];

    try {
      const brakemanFindings = JSON.parse(fileContent).warnings;
      brakemanFindings.map((brakemanFinding: any) => {
        // uri
        let fullPath = '';
        if (vscode.workspace.workspaceFolders) {
          fullPath = vscode.workspace.workspaceFolders[0].uri.fsPath + '/';
        }
        const uri = vscode.Uri.file(`${fullPath}${brakemanFinding.file}`);

        // range
        const range = new vscode.Range(
          brakemanFinding.line - 1,
          0,
          brakemanFinding.line - 1,
          0,
        );

        // instantiate tool finding and add to list
        const toolFinding = new ToolFinding(
          uri,
          range,
          `${brakemanFinding.warning_type}: ${brakemanFinding.message}`,
        );
        toolFindings.push(toolFinding);
      });
    } catch {
      /* empty */
    }

    return toolFindings;
  }
}

export { BrakemanParser };
