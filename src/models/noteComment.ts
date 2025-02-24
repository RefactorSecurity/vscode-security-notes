'use strict';

import * as vscode from 'vscode';

let commentId = 1;

export class NoteComment implements vscode.Comment {
  id: number;
  label: string | undefined;
  savedBody: string | vscode.MarkdownString; // for the Cancel button
  constructor(
    public body: string | vscode.MarkdownString,
    public mode: vscode.CommentMode,
    public author: vscode.CommentAuthorInformation,
    public parent?: vscode.CommentThread,
    public reactions: vscode.CommentReaction[] = [],
    public contextValue?: string,
    public timestamp?: Date,
  ) {
    this.id = ++commentId;
    this.savedBody = this.body;
    if (timestamp) {
      this.timestamp = new Date(timestamp);
    } else {
      this.timestamp = new Date();
    }
    this.contextValue = contextValue;
  }
}
