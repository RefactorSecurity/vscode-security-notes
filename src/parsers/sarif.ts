'use strict';

import * as vscode from 'vscode';
import { ToolFinding } from '../models/toolFinding';
import { relativePathToFull } from '../utils';

class SarifParser {
  static parse(fileContent: string) {
    const toolFindings: ToolFinding[] = [];

    try {
      const sarifRuns = JSON.parse(fileContent).runs;
      sarifRuns.map((sarifRun: any) => {
        // tool name
        const toolName = sarifRun.tool.driver.name;

        sarifRun.results.map((sarifResult: any) => {
          // note
          const note = sarifResult.message.text;

          sarifResult.locations.map((sarifResultLocation: any) => {
            // uri
            const uri = vscode.Uri.file(
              relativePathToFull(
                sarifResultLocation.physicalLocation.artifactLocation.uri,
              ),
            );

            // range
            const range = new vscode.Range(
              sarifResultLocation.physicalLocation.region.startLine - 1,
              sarifResultLocation.physicalLocation.region.startColumn,
              sarifResultLocation.physicalLocation.region.endLine - 1,
              sarifResultLocation.physicalLocation.region.endColumn,
            );

            // instantiate tool finding and add to list
            const toolFinding = new ToolFinding(uri, range, note, toolName);
            toolFindings.push(toolFinding);
          });
        });
      });
    } catch {
      /* empty */
    }

    return toolFindings;
  }
}

export { SarifParser };
