'use strict';

import * as vscode from 'vscode';
import { CommentReaction, CommentThread, Range } from 'vscode';
import { NoteComment } from '../../models/noteComment';
import { commentController } from '../../controllers/comments';
import { relativePathtoFull } from '../../utils';
import { Resource } from '../../reactions/resource';

export class Deserializer {
  static deserializeReaction(reaction: any): CommentReaction {
    return {
      count: reaction.count,
      iconPath: relativePathtoFull(reaction.iconPath, Resource.extensionPath),
      label: reaction.label,
      authorHasReacted: false,
    };
  }

  static deserializeComment(
    comment: any,
    parent: CommentThread | undefined,
  ): NoteComment {
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
      comment.timestamp,
    );
    return newComment;
  }

  static deserializeRange(range: any): Range {
    return new Range(range.startLine, 0, range.endLine, 0);
  }

  static deserializeThread(thread: any): CommentThread {
    const newThread = commentController.createCommentThread(
      vscode.Uri.file(relativePathtoFull(thread.uri)),
      this.deserializeRange(thread.range),
      [],
    );
    newThread.contextValue = thread.id;
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
