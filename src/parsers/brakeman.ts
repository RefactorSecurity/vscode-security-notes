'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';
import { relativePathToFull } from '../utils';

class BrakemanParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];
    const brakemanFindings = JSON.parse(fileContent).warnings;

    if (!Array.isArray(brakemanFindings)) {
      return toolFindings;
    }

    brakemanFindings.forEach((brakemanFinding: any) => {
      // uri
      const uri = vscode.Uri.file(relativePathToFull(brakemanFinding.file));

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

    return toolFindings;
  }
}

export { BrakemanParser };
