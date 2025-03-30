'use strict';

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { Breadcrumb, BreadcrumbPoint } from '../models/breadcrumb';

export class BreadcrumbsController {
  private breadcrumbs: Map<string, Breadcrumb> = new Map();
  
  constructor() {
    // This is intentionally empty since initialization happens at declaration
  }

  // Create a new breadcrumb with the given label
  createBreadcrumb(label: string): Breadcrumb {
    const id = uuidv4();
    const breadcrumb = new Breadcrumb(id, label);
    this.breadcrumbs.set(id, breadcrumb);
    return breadcrumb;
  }

  // Get a breadcrumb by ID
  getBreadcrumb(id: string): Breadcrumb | undefined {
    return this.breadcrumbs.get(id);
  }

  // Get all breadcrumbs
  getAllBreadcrumbs(): Breadcrumb[] {
    return Array.from(this.breadcrumbs.values());
  }

  // Delete a breadcrumb
  deleteBreadcrumb(id: string): boolean {
    return this.breadcrumbs.delete(id);
  }

  // Add a point to an existing breadcrumb
  addPointToBreadcrumb(
    breadcrumbId: string,
    tag: string,
    range: vscode.Range,
    uri: vscode.Uri,
    noteId?: string
  ): BreadcrumbPoint | undefined {
    const breadcrumb = this.breadcrumbs.get(breadcrumbId);
    if (!breadcrumb) {
      return undefined;
    }

    const point: BreadcrumbPoint = {
      id: uuidv4(),
      tag,
      range,
      uri,
      ordinal: breadcrumb.points.length,
      noteId
    };

    breadcrumb.addPoint(point);
    return point;
  }

  // Remove a point from a breadcrumb
  removePoint(breadcrumbId: string, pointId: string): boolean {
    const breadcrumb = this.breadcrumbs.get(breadcrumbId);
    if (!breadcrumb) {
      return false;
    }

    const initialLength = breadcrumb.points.length;
    breadcrumb.removePoint(pointId);
    return initialLength !== breadcrumb.points.length;
  }

  // Update a breadcrumb's label
  updateBreadcrumbLabel(breadcrumbId: string, newLabel: string): boolean {
    const breadcrumb = this.breadcrumbs.get(breadcrumbId);
    if (!breadcrumb) {
      return false;
    }

    breadcrumb.updateLabel(newLabel);
    return true;
  }

  // Get all points for a breadcrumb
  getPointsForBreadcrumb(breadcrumbId: string): BreadcrumbPoint[] {
    const breadcrumb = this.breadcrumbs.get(breadcrumbId);
    if (!breadcrumb) {
      return [];
    }

    return [...breadcrumb.points];
  }

  // Find breadcrumbs by tag
  findBreadcrumbsByTag(tag: string): Breadcrumb[] {
    return Array.from(this.breadcrumbs.values()).filter(breadcrumb => 
      breadcrumb.points.some(point => point.tag === tag)
    );
  }
}

export const breadcrumbsController = new BreadcrumbsController();