'use strict';

import * as vscode from 'vscode';

let commentId = 1;

export class NoteComment implements vscode.Comment {
  id: number;
  label: string | undefined;
  savedBody: string | vscode.MarkdownString; // for the Cancel button
  constructor(
    public body: string,
    public mode: vscode.CommentMode,
    public author: vscode.CommentAuthorInformation,
    public parent?: vscode.CommentThread,
    public reactions: vscode.CommentReaction[] = [],
    public contextValue?: string,
  ) {
    this.id = ++commentId;
    this.savedBody = this.body;
  }
}
