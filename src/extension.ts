'use strict';

import * as vscode from 'vscode';
import * as path from 'path';

class Resource {
  static icons: any;

  static initialize(context: vscode.ExtensionContext) {
    Resource.icons = {
      reactions: {
        THUMBS_UP: context.asAbsolutePath(
          path.join('resources', 'reactions', 'thumbs_up.png'),
        ),
        THUMBS_DOWN: context.asAbsolutePath(
          path.join('resources', 'reactions', 'thumbs_down.png'),
        ),
        CONFUSED: context.asAbsolutePath(
          path.join('resources', 'reactions', 'confused.png'),
        ),
        EYES: context.asAbsolutePath(path.join('resources', 'reactions', 'eyes.png')),
        HEART: context.asAbsolutePath(path.join('resources', 'reactions', 'heart.png')),
        HOORAY: context.asAbsolutePath(
          path.join('resources', 'reactions', 'hooray.png'),
        ),
        LAUGH: context.asAbsolutePath(path.join('resources', 'reactions', 'laugh.png')),
        ROCKET: context.asAbsolutePath(
          path.join('resources', 'reactions', 'rocket.png'),
        ),
      },
    };
  }
}

function getReactionGroup(): { title: string; label: string; icon: vscode.Uri }[] {
  const ret = [
    {
      title: 'CONFUSED',
      label: '😕',
      icon: Resource.icons.reactions.CONFUSED,
    },
    {
      title: 'EYES',
      label: '👀',
      icon: Resource.icons.reactions.EYES,
    },
    {
      title: 'HEART',
      label: '❤️',
      icon: Resource.icons.reactions.HEART,
    },
    {
      title: 'HOORAY',
      label: '🎉',
      icon: Resource.icons.reactions.HOORAY,
    },
    {
      title: 'LAUGH',
      label: '😄',
      icon: Resource.icons.reactions.LAUGH,
    },
    {
      title: 'ROCKET',
      label: '🚀',
      icon: Resource.icons.reactions.ROCKET,
    },
    {
      title: 'THUMBS_DOWN',
      label: '👎',
      icon: Resource.icons.reactions.THUMBS_DOWN,
    },
    {
      title: 'THUMBS_UP',
      label: '👍',
      icon: Resource.icons.reactions.THUMBS_UP,
    },
  ];

  return ret;
}

let commentId = 1;

enum NoteCommentStatus {
  TODO = 'To-Do',
  Vulnerable = 'Vulnerale',
  NotVulnerable = 'Not Vulnerable',
}

class NoteComment implements vscode.Comment {
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

export function activate(context: vscode.ExtensionContext) {
  Resource.initialize(context);

  // A `CommentController` is able to provide comments for documents.
  const commentController = vscode.comments.createCommentController(
    'comment-sample',
    'Comment API Sample',
  );
  context.subscriptions.push(commentController);

  // A `CommentingRangeProvider` controls where gutter decorations that allow adding comments are shown
  commentController.commentingRangeProvider = {
    provideCommentingRanges: (
      document: vscode.TextDocument,
      token: vscode.CancellationToken,
    ) => {
      const lineCount = document.lineCount;
      return [new vscode.Range(0, 0, lineCount - 1, 0)];
    },
  };

  commentController.reactionHandler = async (
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

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mywiki.createNote',
      (reply: vscode.CommentReply) => {
        replyNote(reply, true);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mywiki.replyNote',
      (reply: vscode.CommentReply) => {
        replyNote(reply, false);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mywiki.deleteNoteComment',
      (comment: NoteComment) => {
        const thread = comment.parent;
        if (!thread) {
          return;
        }

        thread.comments = thread.comments.filter(
          (cmt) => (cmt as NoteComment).id !== comment.id,
        );

        if (thread.comments.length === 0) {
          thread.dispose();
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mywiki.deleteNote',
      (thread: vscode.CommentThread) => {
        thread.dispose();
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mywiki.cancelsaveNote', (comment: NoteComment) => {
      if (!comment.parent) {
        return;
      }

      comment.parent.comments = comment.parent.comments.map((cmt) => {
        if ((cmt as NoteComment).id === comment.id) {
          cmt.body = (cmt as NoteComment).savedBody;
          cmt.mode = vscode.CommentMode.Preview;
        }

        return cmt;
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mywiki.saveNote', (comment: NoteComment) => {
      if (!comment.parent) {
        return;
      }

      comment.parent.comments = comment.parent.comments.map((cmt) => {
        if ((cmt as NoteComment).id === comment.id) {
          (cmt as NoteComment).savedBody = cmt.body;
          cmt.mode = vscode.CommentMode.Preview;
        }

        return cmt;
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mywiki.editNote', (comment: NoteComment) => {
      if (!comment.parent) {
        return;
      }

      comment.parent.comments = comment.parent.comments.map((cmt) => {
        if ((cmt as NoteComment).id === comment.id) {
          cmt.mode = vscode.CommentMode.Editing;
        }

        return cmt;
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mywiki.dispose', () => {
      commentController.dispose();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mywiki.setNoteStatusVulnerable',
      (commentReply: vscode.CommentReply) =>
        setNoteStatus(commentReply, NoteCommentStatus.Vulnerable),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mywiki.setNoteStatusNotVulnerable',
      (commentReply: vscode.CommentReply) =>
        setNoteStatus(commentReply, NoteCommentStatus.NotVulnerable),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mywiki.setNoteStatusToDo',
      (commentReply: vscode.CommentReply) =>
        setNoteStatus(commentReply, NoteCommentStatus.TODO),
    ),
  );

  function replyNote(reply: vscode.CommentReply, firstComment: boolean) {
    const thread = reply.thread;
    const newComment = new NoteComment(
      reply.text,
      vscode.CommentMode.Preview,
      { name: 'vscode' },
      thread,
      getReactionGroup().map((reaction) => ({
        iconPath: reaction.icon,
        label: reaction.label,
        count: 0,
        authorHasReacted: false,
      })),
      thread.comments.length ? 'canDelete' : undefined,
    );
    thread.comments = [...thread.comments, newComment];
    if (firstComment) {
      updateFirstCommentStatus(newComment, NoteCommentStatus.TODO);
    }
  }

  function updateFirstCommentStatus(
    comment: vscode.Comment,
    status: NoteCommentStatus,
  ) {
    // Remove previous status if any
    comment.body = comment.body.toString().replace(/^\[.*\] /, '');

    // Set new status
    comment.body = `[${status}] ${comment.body}`;
  }

  function setNoteStatus(reply: vscode.CommentReply, status: NoteCommentStatus) {
    const thread = reply.thread;

    // Prepend new status to first comment
    updateFirstCommentStatus(thread.comments[0], status);

    // Add comment about status change
    const newComment = new NoteComment(
      `Status changed to ${status}.`,
      vscode.CommentMode.Preview,
      { name: 'vscode' },
      thread,
      getReactionGroup().map((reaction) => ({
        iconPath: reaction.icon,
        label: reaction.label,
        count: 0,
        authorHasReacted: false,
      })),
      thread.comments.length ? 'canDelete' : undefined,
    );
    thread.comments = [...thread.comments, newComment];
  }
}
