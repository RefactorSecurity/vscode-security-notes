'use strict';

import * as vscode from 'vscode';
import { BreadcrumbPoint } from '../models/breadcrumb';

// Create a decoration type for breadcrumb markers
export const breadcrumbDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 165, 0, 0.2)',
  border: '1px dashed orange',
  after: {
    contentText: ' 🔶 ',
    margin: '0 0 0 3px'
  },
  light: {
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    border: '1px dashed orange',
  },
  dark: {
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    border: '1px dashed orange',
  },
  isWholeLine: false,
});

// Create decoration options for breadcrumb points with sequence information
export const createBreadcrumbDecorationByTag = (tag: string, ordinal: number, range: vscode.Range): vscode.DecorationOptions => {
  return {
    range: range,
    renderOptions: {
      after: {
        contentText: ` 🔶 ${tag} (${ordinal + 1})`,
        color: 'orange',
        fontWeight: 'bold',
        fontStyle: 'italic',
        margin: '0 0 0 3px'
      }
    }
  };
};

// Apply decorations to an editor
export const updateBreadcrumbDecorations = (
  editor: vscode.TextEditor,
  breadcrumbPoints: BreadcrumbPoint[]
): void => {
  // Filter points that belong to the current document
  const documentUri = editor.document.uri.toString();
  const pointsInDocument = breadcrumbPoints.filter(point => 
    point.uri.toString() === documentUri
  );

  // Create decorations for each breadcrumb point
  const decorations = pointsInDocument.map(point => {
    const decoration = createBreadcrumbDecorationByTag(point.tag, point.ordinal, point.range);
    return {
      ...decoration,
      hoverMessage: `Breadcrumb: ${point.tag} (${point.ordinal + 1})`
    };
  });

  // Apply the decorations
  editor.setDecorations(breadcrumbDecorationType, decorations);
};