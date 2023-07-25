'use strict';

import * as vscode from 'vscode';

class ToolFinding {
  constructor(
    public uri: vscode.Uri,
    public range: vscode.Range,
    public text: string,
    public tool: string,
  ) {}
}

export { ToolFinding };
