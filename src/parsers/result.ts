'use strict';

import * as vscode from 'vscode';

class Result {
  constructor(
    public uri: vscode.Uri,
    public range: vscode.Range,
    public text: string,
  ) {}
}

export { Result };
