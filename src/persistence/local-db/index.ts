'use strict';

import * as fs from 'fs';
import { Serializer } from '../serialization/serializer';
import { Deserializer } from '../serialization/deserializer';
import { CommentThread } from 'vscode';
import { getSetting } from '../../helpers';
import { getLocalDbFilePath } from '../../utils';

const persistenceFile = getLocalDbFilePath();

export const saveCommentsToFile = (noteList: Map<string, CommentThread>) => {
  fs.writeFileSync(persistenceFile, JSON.stringify(Serializer.serialize(noteList)));
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
