'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';

class GosecParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];
    const gosecFindings = JSON.parse(fileContent).Issues;

    if (!Array.isArray(gosecFindings)) {
      return toolFindings;
    }

    gosecFindings.forEach((gosecFinding: any) => {
      // uri
      const uri = vscode.Uri.file(gosecFinding.file);

      // range
      const line = gosecFinding.line;
      const range = new vscode.Range(line - 1, 0, line - 1, 0);

      // instantiate tool finding and add to list
      const toolFinding = new ToolFinding(uri, range, gosecFinding.details);
      toolFindings.push(toolFinding);
    });

    return toolFindings;
  }
}

export { GosecParser };
