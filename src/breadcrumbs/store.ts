'use strict';

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { BreadcrumbState, Crumb, Trail } from '../models/breadcrumb';

export interface CreateTrailOptions {
  description?: string;
  setActive?: boolean;
}

export interface CreateCrumbOptions {
  note?: string;
}

const cloneRange = (range: vscode.Range) =>
  new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);

const cloneUri = (uri: vscode.Uri) => vscode.Uri.parse(uri.toString());

const cloneCrumb = (crumb: Crumb): Crumb => ({
  ...crumb,
  uri: cloneUri(crumb.uri),
  range: cloneRange(crumb.range),
});

const cloneTrail = (trail: Trail): Trail => ({
  ...trail,
  crumbs: trail.crumbs.map((crumb) => cloneCrumb(crumb)),
});

export class BreadcrumbStore {
  private trails = new Map<string, Trail>();

  private activeTrailId: string | undefined;

  private readonly _onDidChange = new vscode.EventEmitter<void>();

  public readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  public getState(): BreadcrumbState {
    return {
      activeTrailId: this.activeTrailId,
      trails: [...this.trails.values()].map((trail) => cloneTrail(trail)),
    };
  }

  public replaceState(state: BreadcrumbState) {
    this.trails.clear();
    state.trails.forEach((trail) => {
      const cloned = cloneTrail(trail);
      this.trails.set(cloned.id, cloned);
    });
    this.activeTrailId = state.activeTrailId;
    this._onDidChange.fire();
  }

  public getTrails(): Trail[] {
    return [...this.trails.values()]
      .map((trail) => cloneTrail(trail))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public getTrail(trailId: string): Trail | undefined {
    const trail = this.trails.get(trailId);
    return trail ? cloneTrail(trail) : undefined;
  }

  public getActiveTrail(): Trail | undefined {
    if (!this.activeTrailId) {
      return undefined;
    }
    return this.getTrail(this.activeTrailId);
  }

  public setActiveTrail(trailId: string | undefined) {
    this.activeTrailId = trailId;
    this._onDidChange.fire();
  }

  public createTrail(name: string, options: CreateTrailOptions = {}): Trail {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const trail: Trail = {
      id,
      name,
      description: options.description,
      createdAt: timestamp,
      updatedAt: timestamp,
      crumbs: [],
    };
    this.trails.set(id, trail);
    if (options.setActive ?? true) {
      this.activeTrailId = id;
    }
    this._onDidChange.fire();
    return cloneTrail(trail);
  }

  public renameTrail(trailId: string, name: string, description?: string) {
    const trail = this.trails.get(trailId);
    if (!trail) {
      return;
    }
    trail.name = name;
    trail.description = description;
    trail.updatedAt = new Date().toISOString();
    this._onDidChange.fire();
  }

  public deleteTrail(trailId: string) {
    if (!this.trails.has(trailId)) {
      return;
    }
    this.trails.delete(trailId);
    if (this.activeTrailId === trailId) {
      this.activeTrailId = this.trails.size ? [...this.trails.keys()][0] : undefined;
    }
    this._onDidChange.fire();
  }

  public addCrumb(
    trailId: string,
    uri: vscode.Uri,
    range: vscode.Range,
    snippet: string,
    options: CreateCrumbOptions = {},
  ): Crumb | undefined {
    const trail = this.trails.get(trailId);
    if (!trail) {
      return undefined;
    }
    const crumb: Crumb = {
      id: uuidv4(),
      trailId,
      uri,
      range,
      snippet,
      note: options.note,
      createdAt: new Date().toISOString(),
    };
    trail.crumbs = [...trail.crumbs, crumb];
    trail.updatedAt = new Date().toISOString();
    this._onDidChange.fire();
    return cloneCrumb(crumb);
  }

  public updateCrumbNote(trailId: string, crumbId: string, note: string | undefined) {
    const trail = this.trails.get(trailId);
    if (!trail) {
      return;
    }
    const index = trail.crumbs.findIndex((crumb) => crumb.id === crumbId);
    if (index === -1) {
      return;
    }
    trail.crumbs[index] = {
      ...trail.crumbs[index],
      note,
    };
    trail.updatedAt = new Date().toISOString();
    this._onDidChange.fire();
  }

  public removeCrumb(trailId: string, crumbId: string) {
    const trail = this.trails.get(trailId);
    if (!trail) {
      return;
    }
    const next = trail.crumbs.filter((crumb) => crumb.id !== crumbId);
    if (next.length === trail.crumbs.length) {
      return;
    }
    trail.crumbs = next;
    trail.updatedAt = new Date().toISOString();
    this._onDidChange.fire();
  }
}
