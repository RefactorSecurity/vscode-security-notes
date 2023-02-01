'use strict';

import * as vscode from 'vscode';
import { NoteStatus } from './models/noteStatus';
import { NoteComment } from './models/noteComment';
import { Resource } from './reactions/resource';
import { ImportToolResultsWebview } from './webviews/importToolResultsWebview';
import { commentController } from './controllers/comments';
import { reactionHandler } from './handlers/reaction';
import { loadCommentsFromFile, saveCommentsToFile } from './persistence';
import { saveNoteComment, setNoteStatus } from './helpers';

const noteList: vscode.CommentThread[] = [];

export function activate(context: vscode.ExtensionContext) {
  Resource.initialize(context);

  // A `CommentController` is able to provide comments for documents.
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

  // reaction handler
  commentController.reactionHandler = reactionHandler;

  // create note button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.createNote',
      (reply: vscode.CommentReply) => {
        saveNoteComment(reply.thread, reply.text, true, noteList);
      },
    ),
  );

  // reply note comment button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.replyNoteComment',
      (reply: vscode.CommentReply) => {
        saveNoteComment(reply.thread, reply.text, false, noteList);
      },
    ),
  );

  // delete note comment button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.deleteNoteComment',
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

  // delete note button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.deleteNote',
      (thread: vscode.CommentThread) => {
        thread.dispose();
      },
    ),
  );

  // cancel edit note comment button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.cancelEditNoteComment',
      (comment: NoteComment) => {
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
      },
    ),
  );

  // save edit note comment button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.saveEditNoteComment',
      (comment: NoteComment) => {
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
      },
    ),
  );

  // edit note comment button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.editNoteComment',
      (comment: NoteComment) => {
        if (!comment.parent) {
          return;
        }

        comment.parent.comments = comment.parent.comments.map((cmt) => {
          if ((cmt as NoteComment).id === comment.id) {
            cmt.mode = vscode.CommentMode.Editing;
          }

          return cmt;
        });
      },
    ),
  );

  // set note status as vulnerable button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.setNoteStatusVulnerable',
      (commentReply: vscode.CommentReply) =>
        setNoteStatus(commentReply, NoteStatus.Vulnerable),
    ),
  );

  // set note status as not vulnerable button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.setNoteStatusNotVulnerable',
      (commentReply: vscode.CommentReply) =>
        setNoteStatus(commentReply, NoteStatus.NotVulnerable),
    ),
  );

  // set note status as TODO button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.setNoteStatusToDo',
      (commentReply: vscode.CommentReply) =>
        setNoteStatus(commentReply, NoteStatus.TODO),
    ),
  );

  // webview for importing tool results
  const importToolResultsWebview = new ImportToolResultsWebview(
    context.extensionUri,
    noteList,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ImportToolResultsWebview.viewType,
      importToolResultsWebview,
    ),
  );

  // load persisted comments from file
  noteList.push(...loadCommentsFromFile());
}

export function deactivate(context: vscode.ExtensionContext) {
  // persist comments in file
  saveCommentsToFile(noteList);
}
