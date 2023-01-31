'use strict';

import * as fs from 'fs';
import { Serializer } from '../persistence/serializer';
import { Deserializer } from '../persistence/deserializer';
import { CommentThread } from 'vscode';

const persistenceFile = '/tmp/.security-notes.json';

export const saveCommentsToFile = (noteList: CommentThread[]) => {
  fs.writeFileSync(persistenceFile, Serializer.serialize(noteList));
};

export const loadCommentsFromFile = (): CommentThread[] => {
  // Check if persistence file exists and load comments
  if (fs.existsSync(persistenceFile)) {
    const jsonFile = fs.readFileSync(persistenceFile).toString();
    const persistedThreads = JSON.parse(jsonFile);
    return Deserializer.deserialize(persistedThreads);
  } else {
    return [];
  }
};
