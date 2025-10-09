'use strict';

import * as vscode from 'vscode';

export const formatRangeLabel = (range: vscode.Range) => {
  const startLine = range.start.line + 1;
  const endLine = range.end.line + 1;
  if (startLine === endLine) {
    return `L${startLine}`;
  }
  return `L${startLine}-L${endLine}`;
};

export const snippetPreview = (snippet: string, maxLength = 80) => {
  const trimmed = snippet.trim();
  if (!trimmed.length) {
    return '(empty selection)';
  }
  const preview = trimmed.split('\n')[0].trim();
  return preview.length > maxLength ? `${preview.slice(0, maxLength - 3)}...` : preview;
};
