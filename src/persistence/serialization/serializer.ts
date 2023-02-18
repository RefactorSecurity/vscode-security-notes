'use strict';

import { Comment, CommentReaction, CommentThread, Range } from 'vscode';
import { fullPathtoRelative } from '../../utils';
import { Resource } from '../../reactions/resource';

export class Serializer {
  static serializeReaction(reaction: CommentReaction) {
    return {
      count: reaction.count,
      iconPath: fullPathtoRelative(
        typeof reaction.iconPath === 'string'
          ? reaction.iconPath
          : reaction.iconPath.fsPath,
        Resource.extensionPath,
      ),
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

  public static serializeThread(thread: CommentThread): any {
    const serializedComments: any[] = [];
    thread.comments.forEach((comment) => {
      serializedComments.push(this.serializeComment(comment));
    });
    return {
      range: this.serializeRange(thread.range),
      uri: fullPathtoRelative(thread.uri.path),
      comments: serializedComments,
      id: thread.contextValue,
    };
  }

  public static serialize(noteList: Map<string, CommentThread>) {
    const serializedThreads: any[] = [];
    noteList.forEach((thread) => {
      serializedThreads.push(this.serializeThread(thread));
    });
    return serializedThreads;
  }
}
