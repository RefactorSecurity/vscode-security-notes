'use strict';

import * as vscode from 'vscode';
import { Trail } from '../models/breadcrumb';
import { formatRangeLabel } from './format';
import { fullPathToRelative } from '../utils';

const escapeCodeBlock = (value: string) => value.replace(/```/g, '\`\`\`');

const headline = (level: number, text: string) => `${'#'.repeat(level)} ${text}`;

const formatDate = (value: string | undefined) =>
  value ? new Date(value).toLocaleString() : undefined;

const buildSummary = (trail: Trail) => {
  const files = new Set(trail.crumbs.map((crumb) => fullPathToRelative(crumb.uri.fsPath)));
  const first = formatDate(trail.crumbs[0]?.createdAt);
  const last = formatDate(trail.crumbs[trail.crumbs.length - 1]?.createdAt);

  const lines: string[] = [];
  lines.push(headline(2, 'Summary'));
  lines.push('');
  lines.push(`- **Total crumbs:** ${trail.crumbs.length}`);
  lines.push(`- **Files touched:** ${files.size}`);
  lines.push(`- **Generated:** ${formatDate(new Date().toISOString())}`);
  if (first && last) {
    lines.push(`- **Investigation window:** ${first} – ${last}`);
  }
  lines.push('');
  return lines.join('\n');
};

const buildCrumbSection = (trail: Trail) => {
  const lines: string[] = [];
  lines.push(headline(2, 'Trail'));
  lines.push('');

  trail.crumbs.forEach((crumb, index) => {
    const filePath = fullPathToRelative(crumb.uri.fsPath);
    const rangeLabel = formatRangeLabel(crumb.range);
    const createdAt = formatDate(crumb.createdAt) ?? 'n/a';
    lines.push(headline(3, `${index + 1}. ${filePath}:${rangeLabel}`));
    lines.push('');
    lines.push(`- **Captured:** ${createdAt}`);
    if (crumb.note) {
      lines.push(`- **Note:** ${crumb.note}`);
    }
    lines.push('');
    lines.push('```');
    lines.push(escapeCodeBlock(crumb.snippet));
    lines.push('```');
    lines.push('');
  });

  return lines.join('\n');
};

const generateTrailMarkdown = (trail: Trail) => {
  const lines: string[] = [];
  lines.push(headline(1, `Breadcrumb Trail – ${trail.name}`));
  lines.push('');
  if (trail.description) {
    lines.push(trail.description);
    lines.push('');
  }
  lines.push(buildSummary(trail));
  lines.push(buildCrumbSection(trail));
  return lines.join('\n');
};

export const exportTrailToMarkdown = async (trail: Trail, uri?: vscode.Uri) => {
  if (!trail.crumbs.length) {
    vscode.window.showInformationMessage('[Breadcrumbs] Cannot export an empty trail.');
    return undefined;
  }

  const markdown = generateTrailMarkdown(trail);
  const buffer = Buffer.from(markdown, 'utf8');

  if (!uri) {
    const fileNameSafe = trail.name.replace(/[^a-z0-9\-_]+/gi, '-').replace(/-+/g, '-');
    const defaultUri = vscode.workspace.workspaceFolders?.length
      ? vscode.Uri.joinPath(
          vscode.workspace.workspaceFolders[0].uri,
          `${fileNameSafe || 'breadcrumb-trail'}.md`,
        )
      : undefined;

    uri = await vscode.window.showSaveDialog({
      filters: { Markdown: ['md', 'markdown'] },
      defaultUri,
      saveLabel: 'Export Breadcrumb Trail',
    });
    if (!uri) {
      return undefined;
    }
  }

  await vscode.workspace.fs.writeFile(uri, buffer);

  const selection = await vscode.window.showInformationMessage(
    `Breadcrumb trail exported to ${uri.fsPath}.`,
    'Open export',
  );

  if (selection === 'Open export') {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false });
  }

  return uri;
};
