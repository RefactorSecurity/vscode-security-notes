'use strict';

import * as vscode from 'vscode';
import { CommentReaction, CommentThread, Range } from 'vscode';
import { NoteComment } from '../models/noteComment';
import { commentController } from '../controllers/comments';

export class Deserializer {
  static deserializeReaction(reaction: any): CommentReaction {
    return {
      count: reaction.count,
      iconPath: reaction.iconPath,
      label: reaction.label,
      authorHasReacted: false,
    };
  }

  static deserializeComment(comment: any, parent: CommentThread): NoteComment {
    const deserializedReactions: any[] = [];
    comment.reactions.forEach((reaction: any) => {
      deserializedReactions.push(this.deserializeReaction(reaction));
    });
    const newComment = new NoteComment(
      comment.body,
      vscode.CommentMode.Preview,
      { name: comment.author },
      parent,
      deserializedReactions,
      undefined,
    );
    return newComment;
  }

  static deserializeRange(range: any): Range {
    return new Range(range.startLine, 0, range.endLine, 0);
  }

  static deserializeThread(thread: any): CommentThread {
    // TODO: do NoteComments need a parent?
    const newThread = commentController.createCommentThread(
      vscode.Uri.file(thread.uri),
      this.deserializeRange(thread.range),
      [],
    );
    const deserializedComments: NoteComment[] = [];
    thread.comments.forEach((comment: any) => {
      deserializedComments.push(this.deserializeComment(comment, newThread));
    });
    newThread.comments = deserializedComments;
    return newThread;
  }

  public static deserialize(deserializednoteList: any[]): CommentThread[] {
    const deserializedCommentThreads: CommentThread[] = [];
    deserializednoteList.forEach((thread) => {
      deserializedCommentThreads.push(this.deserializeThread(thread));
    });
    return deserializedCommentThreads;
  }
}
