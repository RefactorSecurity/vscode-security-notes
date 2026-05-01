'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';
import { relativePathToFull } from '../utils';

class BanditParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];
    const banditFindings = JSON.parse(fileContent).results;

    if (!Array.isArray(banditFindings)) {
      return toolFindings;
    }

    banditFindings.forEach((banditFinding: any) => {
      // uri
      const uri = vscode.Uri.file(relativePathToFull(banditFinding.filename));

      // range
      const lineRange = banditFinding.line_range;
      const range = new vscode.Range(
        lineRange[0] - 1,
        0,
        (lineRange[1] ? lineRange[1] : lineRange[0]) - 1,
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
