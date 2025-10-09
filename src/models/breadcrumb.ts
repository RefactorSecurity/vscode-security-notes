'use strict';

import * as vscode from 'vscode';

export interface Crumb {
  id: string;
  trailId: string;
  uri: vscode.Uri;
  range: vscode.Range;
  snippet: string;
  note?: string;
  createdAt: string;
}

export interface Trail {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  crumbs: Crumb[];
}

export interface BreadcrumbState {
  activeTrailId?: string;
  trails: Trail[];
}
