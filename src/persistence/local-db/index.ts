'use strict';

import * as fs from 'fs';
import * as vscode from 'vscode';
import { Serializer } from '../serialization/serializer';
import { Deserializer } from '../serialization/deserializer';
import { CommentThread } from 'vscode';
import { getLocalDbFilePath } from '../../utils';

const persistenceFile = getLocalDbFilePath();

export const saveNotesToFile = (noteMap: Map<string, CommentThread>) => {
  // Avoid creating persistence file if no notes were created
  if (!fs.existsSync(persistenceFile) && !noteMap.size) {
    return;
  }
  fs.writeFileSync(persistenceFile, JSON.stringify(Serializer.serialize(noteMap)));
};

export const loadNotesFromFile = (): CommentThread[] => {
  // Check if persistence file exists and load comments
  if (!fs.existsSync(persistenceFile)) {
    return [];
  }

  try {
    const jsonFile = fs.readFileSync(persistenceFile).toString();
    const persistedThreads = JSON.parse(jsonFile);
    return Deserializer.deserialize(persistedThreads);
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;
    vscode.window.showErrorMessage(`[Notes] Failed to load notes from file: ${message}`);
    return [];
  }
};
