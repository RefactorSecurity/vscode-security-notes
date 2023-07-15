'use strict';

import * as fs from 'fs';
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
  if (fs.existsSync(persistenceFile)) {
    const jsonFile = fs.readFileSync(persistenceFile).toString();
    const persistedThreads = JSON.parse(jsonFile);
    return Deserializer.deserialize(persistedThreads);
  } else {
    return [];
  }
};
