'use strict';

import { Comment, CommentReaction, CommentThread, Range } from 'vscode';
import { fullPathToRelative, isWindows, pathToPosix, pathToWin32 } from '../../utils';
import { Resource } from '../../reactions/resource';

export class Serializer {
  static serializeReaction(reaction: CommentReaction) {
    let iconPath = fullPathToRelative(
      typeof reaction.iconPath === 'string'
        ? reaction.iconPath
        : reaction.iconPath.fsPath,
      Resource.extensionPath,
    );
    if (isWindows()) {
      iconPath = pathToPosix(iconPath);
    }
    return {
      count: reaction.count,
      iconPath: iconPath,
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
    let uri = fullPathToRelative(thread.uri.path);
    if (isWindows()) {
      uri = pathToPosix(uri);
    }
    return {
      range: this.serializeRange(thread.range),
      uri: uri,
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
