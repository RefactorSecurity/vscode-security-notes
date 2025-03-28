'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Breadcrumb, BreadcrumbPoint } from '../models/breadcrumb';
import { getSetting } from '../helpers';
import { getWorkspacePath, fullPathToRelative, relativePathToFull } from '../utils';

export const saveBreadcrumbsToFile = (breadcrumbs: Map<string, Breadcrumb>): void => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open. Cannot save breadcrumbs.');
    return;
  }

  const filePath = path.join(getWorkspacePath(), '.security-notes_breadcrumbs.json');


  // Serialize breadcrumbs to JSON
  const serialized = serializeBreadcrumbs(breadcrumbs);

  try {
    fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2));
    vscode.window.showInformationMessage('Breadcrumbs saved to file.');
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to save breadcrumbs: ${error}`);
  }
};

export const loadBreadcrumbsFromFile = (): Map<string, Breadcrumb> => {
  const breadcrumbs = new Map<string, Breadcrumb>();
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders) {
    return breadcrumbs;
  }

  const filePath = path.join(getWorkspacePath(), '.security-notes_breadcrumbs.json');

  if (!fs.existsSync(filePath)) {
    return breadcrumbs;
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const serializedBreadcrumbs = JSON.parse(fileContent);
    return deserializeBreadcrumbs(serializedBreadcrumbs);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to load breadcrumbs: ${error}`);
    return breadcrumbs;
  }
};

// Helper functions for serialization/deserialization
const serializeBreadcrumbs = (breadcrumbs: Map<string, Breadcrumb>): any[] => {
  return Array.from(breadcrumbs.values()).map(breadcrumb => ({
    id: breadcrumb.id,
    label: breadcrumb.label,
    points: breadcrumb.points.map(point => ({
      id: point.id,
      tag: point.tag,
      range: {
        start: {
          line: point.range.start.line,
          character: point.range.start.character
        },
        end: {
          line: point.range.end.line,
          character: point.range.end.character
        }
      },
      uri: fullPathToRelative(point.uri.fsPath),
      ordinal: point.ordinal,
      noteId: point.noteId
    }))
  }));
};

const deserializeBreadcrumbs = (serialized: any[]): Map<string, Breadcrumb> => {
  const breadcrumbs = new Map<string, Breadcrumb>();

  for (const item of serialized) {
    const breadcrumb = new Breadcrumb(item.id, item.label);

    for (const pointData of item.points) {
      const point: BreadcrumbPoint = {
        id: pointData.id,
        tag: pointData.tag,
        range: new vscode.Range(
          new vscode.Position(pointData.range.start.line, pointData.range.start.character),
          new vscode.Position(pointData.range.end.line, pointData.range.end.character)
        ),
        uri: vscode.Uri.parse(relativePathToFull(pointData.uri)),
        ordinal: pointData.ordinal,
        noteId: pointData.noteId
      };

      breadcrumb.addPoint(point);
    }

    breadcrumbs.set(breadcrumb.id, breadcrumb);
  }

  return breadcrumbs;
};
