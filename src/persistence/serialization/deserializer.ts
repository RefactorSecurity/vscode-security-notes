'use strict';

import * as vscode from 'vscode';
import { CommentReaction, CommentThread, Range } from 'vscode';
import { NoteComment } from '../../models/noteComment';
import { commentController } from '../../controllers/comments';
import { isWindows, pathToWin32, relativePathToFull } from '../../utils';
import { Resource } from '../../reactions/resource';

export class Deserializer {
  static deserializeReaction(reaction: any): CommentReaction {
    let iconPath = relativePathToFull(reaction.iconPath, Resource.extensionPath);
    if (isWindows()) {
      iconPath = pathToWin32(iconPath);
    }
    return {
      count: reaction.count,
      iconPath: iconPath,
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
    let uri = relativePathToFull(thread.uri);
    if (isWindows()) {
      uri = pathToWin32(uri);
    }
    const newThread = commentController.createCommentThread(
      vscode.Uri.file(uri),
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
