'use strict';

import * as fs from 'fs';
import * as vscode from 'vscode';
import { BreadcrumbStore } from '../../breadcrumbs/store';
import { BreadcrumbState, Crumb, Trail } from '../../models/breadcrumb';
import { fullPathToRelative, getBreadcrumbsDbFilePath, relativePathToFull } from '../../utils';

interface PersistedRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

interface PersistedCrumb {
  id: string;
  trailId: string;
  uri: string;
  range: PersistedRange;
  snippet: string;
  note?: string;
  createdAt: string;
}

interface PersistedTrail {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  crumbs: PersistedCrumb[];
}

interface PersistedState {
  activeTrailId?: string;
  trails: PersistedTrail[];
}

const persistenceFile = getBreadcrumbsDbFilePath();

const serializeRange = (range: vscode.Range): PersistedRange => ({
  startLine: range.start.line,
  startCharacter: range.start.character,
  endLine: range.end.line,
  endCharacter: range.end.character,
});

const deserializeRange = (range: PersistedRange): vscode.Range =>
  new vscode.Range(range.startLine, range.startCharacter, range.endLine, range.endCharacter);

const serializeCrumb = (crumb: Crumb): PersistedCrumb => ({
  id: crumb.id,
  trailId: crumb.trailId,
  uri: fullPathToRelative(crumb.uri.fsPath),
  range: serializeRange(crumb.range),
  snippet: crumb.snippet,
  note: crumb.note,
  createdAt: crumb.createdAt,
});

const deserializeCrumb = (crumb: PersistedCrumb): Crumb => ({
  id: crumb.id,
  trailId: crumb.trailId,
  uri: vscode.Uri.file(relativePathToFull(crumb.uri)),
  range: deserializeRange(crumb.range),
  snippet: crumb.snippet,
  note: crumb.note,
  createdAt: crumb.createdAt,
});

const serializeTrail = (trail: Trail): PersistedTrail => ({
  id: trail.id,
  name: trail.name,
  description: trail.description,
  createdAt: trail.createdAt,
  updatedAt: trail.updatedAt,
  crumbs: trail.crumbs.map((crumb) => serializeCrumb(crumb)),
});

const deserializeTrail = (trail: PersistedTrail): Trail => ({
  id: trail.id,
  name: trail.name,
  description: trail.description,
  createdAt: trail.createdAt,
  updatedAt: trail.updatedAt,
  crumbs: trail.crumbs.map((crumb) => deserializeCrumb(crumb)),
});

export const saveBreadcrumbsToFile = (store: BreadcrumbStore) => {
  const state = store.getState();
  if (!fs.existsSync(persistenceFile) && !state.trails.length) {
    return;
  }
  const persistedState: PersistedState = {
    activeTrailId: state.activeTrailId,
    trails: state.trails.map((trail) => serializeTrail(trail)),
  };
  fs.writeFileSync(persistenceFile, JSON.stringify(persistedState, null, 2));
};

export const loadBreadcrumbsFromFile = (): BreadcrumbState => {
  if (!fs.existsSync(persistenceFile)) {
    return { activeTrailId: undefined, trails: [] };
  }

  try {
    const jsonFile = fs.readFileSync(persistenceFile).toString();
    const persistedState = JSON.parse(jsonFile) as PersistedState;
    return {
      activeTrailId: persistedState.activeTrailId,
      trails: persistedState.trails.map((trail) => deserializeTrail(trail)),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;
    vscode.window.showErrorMessage(
      `[Breadcrumbs] Failed to load breadcrumbs from file: ${message}`,
    );
    return { activeTrailId: undefined, trails: [] };
  }
};
