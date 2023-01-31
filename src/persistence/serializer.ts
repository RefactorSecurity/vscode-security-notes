'use strict';

import { Comment, CommentReaction, CommentThread, Range } from 'vscode';

export class Serializer {
  static serializeReaction(reaction: CommentReaction) {
    return {
      count: reaction.count,
      iconPath: reaction.iconPath,
      label: reaction.label,
    };
  }

  static serializeComment(comment: Comment): any {
    const serializedReactions: any[] = [];
    if (comment.reactions) {
      comment.reactions.map((reaction) => {
        serializedReactions.push(this.serializeReaction(reaction));
      });
    }
    return {
      author: comment.author.name,
      body: comment.body,
      reactions: serializedReactions,
      timestamp: comment.timestamp,
    };
  }

  static serializeRange(range: Range): any {
    return {
      startLine: range.start.line,
      endLine: range.end.line,
    };
  }

  static serializeThread(thread: CommentThread): any {
    const serializedComments: any[] = [];
    thread.comments.map((comment) => {
      serializedComments.push(this.serializeComment(comment));
    });
    return {
      range: this.serializeRange(thread.range),
      uri: thread.uri.path,
      comments: serializedComments,
    };
  }
  public static serialize(noteList: CommentThread[]) {
    const serializedThreads: any[] = [];
    noteList.map((thread) => {
      serializedThreads.push(this.serializeThread(thread));
    });
    return JSON.stringify(serializedThreads);
  }
}
