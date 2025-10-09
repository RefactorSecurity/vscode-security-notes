'use strict';

import * as vscode from 'vscode';
import { BreadcrumbStore } from './store';
import { Crumb, Trail } from '../models/breadcrumb';
import { fullPathToRelative } from '../utils';
import { formatRangeLabel, snippetPreview } from './format';

interface TrailQuickPickItem extends vscode.QuickPickItem {
  trail: Trail;
}

interface CrumbQuickPickItem extends vscode.QuickPickItem {
  crumb: Crumb;
}

const mapTrailToQuickPickItem = (trail: Trail, activeTrailId?: string): TrailQuickPickItem => ({
  label: trail.name,
  description: trail.description,
  detail: `${trail.crumbs.length} crumb${trail.crumbs.length === 1 ? '' : 's'} · Last updated ${new Date(
    trail.updatedAt,
  ).toLocaleString()}`,
  trail,
  picked: trail.id === activeTrailId,
});

const mapCrumbToQuickPickItem = (crumb: Crumb, index: number): CrumbQuickPickItem => ({
  label: `${index + 1}. ${fullPathToRelative(crumb.uri.fsPath)}:${formatRangeLabel(crumb.range)}`,
  description: crumb.note,
  detail: snippetPreview(crumb.snippet),
  crumb,
});

const ensureActiveTrail = async (
  store: BreadcrumbStore,
  options: { promptUser?: boolean } = { promptUser: true },
): Promise<Trail | undefined> => {
  const activeTrail = store.getActiveTrail();
  if (activeTrail) {
    return activeTrail;
  }

  const trails = store.getTrails();
  if (!trails.length) {
    if (options.promptUser) {
      vscode.window.showInformationMessage(
        '[Breadcrumbs] No breadcrumb trails yet. Create one before adding crumbs.',
      );
    }
    return undefined;
  }

  if (!options.promptUser) {
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    trails.map((trail) => mapTrailToQuickPickItem(trail, store.getState().activeTrailId)),
    {
      placeHolder: 'Select a breadcrumb trail to work with',
    },
  );

  if (!picked) {
    return undefined;
  }

  store.setActiveTrail(picked.trail.id);
  return store.getTrail(picked.trail.id);
};

const promptForTrail = async (store: BreadcrumbStore, placeHolder: string) => {
  const trails = store.getTrails();
  if (!trails.length) {
    vscode.window.showInformationMessage('[Breadcrumbs] No trails available. Create one first.');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    trails.map((trail) => mapTrailToQuickPickItem(trail, store.getState().activeTrailId)),
    { placeHolder },
  );
  return picked?.trail;
};

const promptForCrumb = async (trail: Trail, placeHolder: string): Promise<Crumb | undefined> => {
  if (!trail.crumbs.length) {
    vscode.window.showInformationMessage('[Breadcrumbs] The selected trail has no crumbs yet.');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    trail.crumbs.map((crumb, index) => mapCrumbToQuickPickItem(crumb, index)),
    { placeHolder },
  );
  return picked?.crumb;
};

export const revealCrumb = async (crumb: Crumb) => {
  const document = await vscode.workspace.openTextDocument(crumb.uri);
  const editor = await vscode.window.showTextDocument(document, { preview: false });
  const selection = new vscode.Selection(crumb.range.start, crumb.range.end);
  editor.selection = selection;
  editor.revealRange(crumb.range, vscode.TextEditorRevealType.InCenter);
};

interface RegisterBreadcrumbCommandsOptions {
  onShowTrailDiagram?: (trail: Trail) => Promise<void> | void;
}

export const registerBreadcrumbCommands = (
  context: vscode.ExtensionContext,
  store: BreadcrumbStore,
  options: RegisterBreadcrumbCommandsOptions = {},
) => {
  const disposables: vscode.Disposable[] = [];

  disposables.push(
    vscode.commands.registerCommand('security-notes.breadcrumbs.createTrail', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Name for the new breadcrumb trail',
        placeHolder: 'e.g. User login flow',
        ignoreFocusOut: true,
        validateInput: (value) => (!value?.trim().length ? 'Trail name is required.' : undefined),
      });
      if (!name) {
        return;
      }
      const description = await vscode.window.showInputBox({
        prompt: 'Optional description',
        placeHolder: 'What does this trail capture?',
        ignoreFocusOut: true,
      });
      const trail = store.createTrail(name.trim(), {
        description: description?.trim() ? description.trim() : undefined,
        setActive: true,
      });
      vscode.window.showInformationMessage(
        `[Breadcrumbs] Created trail "${trail.name}" and set it as active.`,
      );
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('security-notes.breadcrumbs.selectTrail', async () => {
      const trail = await promptForTrail(store, 'Select the breadcrumb trail to activate');
      if (!trail) {
        return;
      }
      store.setActiveTrail(trail.id);
      vscode.window.showInformationMessage(
        `[Breadcrumbs] Active trail set to "${trail.name}".`,
      );
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('security-notes.breadcrumbs.addCrumb', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage(
          '[Breadcrumbs] Open a file and select the code you want to add as a crumb.',
        );
        return;
      }

      const trail = await ensureActiveTrail(store);
      if (!trail) {
        return;
      }

      const selection = editor.selection;
      const document = editor.document;
      const range = selection.isEmpty
        ? document.lineAt(selection.start.line).range
        : new vscode.Range(selection.start, selection.end);
      const snippet = selection.isEmpty
        ? document.lineAt(selection.start.line).text
        : document.getText(selection);

      if (!snippet.trim().length) {
        vscode.window.showInformationMessage(
          '[Breadcrumbs] The selected snippet is empty. Expand the selection and try again.',
        );
        return;
      }

      const note = await vscode.window.showInputBox({
        prompt: 'Optional note for this crumb',
        placeHolder: 'Why is this snippet important?',
        ignoreFocusOut: true,
      });

      const crumb = store.addCrumb(trail.id, document.uri, range, snippet, {
        note: note?.trim() ? note.trim() : undefined,
      });

      if (!crumb) {
        vscode.window.showErrorMessage('[Breadcrumbs] Failed to add crumb to the trail.');
        return;
      }

      vscode.window.showInformationMessage(
        `[Breadcrumbs] Added crumb to "${trail.name}" at ${fullPathToRelative(
          crumb.uri.fsPath,
        )}:${formatRangeLabel(crumb.range)}.`,
        'View',
      ).then((selectionAction) => {
        if (selectionAction === 'View') {
          revealCrumb(crumb);
        }
      });
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('security-notes.breadcrumbs.removeCrumb', async () => {
      const trail = await ensureActiveTrail(store);
      if (!trail) {
        return;
      }
      const crumb = await promptForCrumb(trail, 'Select the crumb to remove');
      if (!crumb) {
        return;
      }
      store.removeCrumb(trail.id, crumb.id);
      vscode.window.showInformationMessage(
        `[Breadcrumbs] Removed crumb from "${trail.name}".`,
      );
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('security-notes.breadcrumbs.editCrumbNote', async () => {
      const trail = await ensureActiveTrail(store);
      if (!trail) {
        return;
      }
      const crumb = await promptForCrumb(trail, 'Select the crumb to edit');
      if (!crumb) {
        return;
      }
      const note = await vscode.window.showInputBox({
        prompt: 'Update the crumb note',
        value: crumb.note,
        ignoreFocusOut: true,
      });
      store.updateCrumbNote(trail.id, crumb.id, note?.trim() ? note.trim() : undefined);
      vscode.window.showInformationMessage('[Breadcrumbs] Updated crumb note.');
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('security-notes.breadcrumbs.showTrailDiagram', async () => {
      const trail = await ensureActiveTrail(store);
      if (!trail) {
        return;
      }
      if (options.onShowTrailDiagram) {
        await options.onShowTrailDiagram(trail);
      } else {
        vscode.window.showInformationMessage(
          '[Breadcrumbs] Diagram view is not available yet in this session.',
        );
      }
    }),
  );

  disposables.forEach((disposable) => context.subscriptions.push(disposable));
};
