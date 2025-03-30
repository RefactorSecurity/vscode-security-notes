'use strict';

import * as vscode from 'vscode';

export interface BreadcrumbPoint {
  id: string;          // Unique identifier
  tag: string;         // User-defined breadcrumb tag/name
  range: vscode.Range; // The selected code range
  uri: vscode.Uri;     // Document URI
  ordinal: number;     // Position in the breadcrumb sequence
  noteId?: string;     // Optional ID of associated note
}

export class Breadcrumb {
  id: string;
  points: BreadcrumbPoint[] = [];
  label: string;
  
  constructor(id: string, label: string) {
    this.id = id;
    this.label = label;
  }

  addPoint(point: BreadcrumbPoint): void {
    this.points.push(point);
    // Sort points by ordinal to maintain correct sequence
    this.points.sort((a, b) => a.ordinal - b.ordinal);
  }

  removePoint(id: string): void {
    this.points = this.points.filter(point => point.id !== id);
  }

  updateLabel(newLabel: string): void {
    this.label = newLabel;
  }
}