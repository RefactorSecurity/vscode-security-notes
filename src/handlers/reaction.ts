'use strict';

import * as vscode from 'vscode';
import { NoteComment } from '../models/noteComment';

export const reactionHandler = async (
  c: vscode.Comment,
  reaction: vscode.CommentReaction,
) => {
  const comment = c as NoteComment;
  if (!comment.parent) {
    return;
  }

  comment.parent.comments = comment.parent.comments.map((cmt) => {
    if ((cmt as NoteComment).id === comment.id) {
      const index = cmt.reactions!.findIndex((r) => r.label === reaction.label);
      cmt.reactions!.splice(index, 1, {
        ...reaction,
        count: reaction.authorHasReacted ? reaction.count - 1 : reaction.count + 1,
        authorHasReacted: !reaction.authorHasReacted,
      });
    }

    return cmt;
  });
};
