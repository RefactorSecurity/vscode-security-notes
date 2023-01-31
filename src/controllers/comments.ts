'use strict';

import * as vscode from 'vscode';

export const commentController = vscode.comments.createCommentController(
  'security-notes',
  'Security Notes',
);
