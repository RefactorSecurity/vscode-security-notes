'use strict';

import { CommentThread } from 'vscode';
import { saveNotesToFile } from '../persistence/local-db';

export const saveNotesToFileHandler = (noteMap: Map<string, CommentThread>) =>
  saveNotesToFile(noteMap);
