'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { platform } from 'os';

export const isWindows = () => {
  return platform() === 'win32';
};

export const pathToPosix = (aPath: string) => {
  return aPath.split(path.sep).join(path.posix.sep);
};

export const pathToWin32 = (aPath: string) => {
  return aPath.split(path.win32.sep).join(path.win32.sep);
};

export const getWorkspacePath = () => {
  if (vscode.workspace.workspaceFolders) {
    return vscode.workspace.workspaceFolders[0].uri.path;
  } else {
    return '';
  }
};

export const relativePathToFull = (aPath: string, basePath?: string) => {
  if (basePath) {
    return path.join(basePath, aPath);
  }
  return path.join(getWorkspacePath(), aPath);
};

export const fullPathToRelative = (aPath: string, basePath?: string) => {
  if (basePath) {
    return path.relative(basePath, aPath);
  }
  return path.relative(getWorkspacePath(), aPath);
};
