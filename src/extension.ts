'use strict';

import * as vscode from 'vscode';
import { NoteStatus } from './models/noteStatus';
import { NoteComment } from './models/noteComment';
import { Resource } from './reactions/resource';
import { ImportToolResultsWebview } from './webviews/importToolResultsWebview';
import { commentController } from './controllers/comments';
import { reactionHandler } from './handlers/reaction';
import { saveNotesToFileHandler } from './handlers/saveNotesToFile';
import {
  getSetting,
  saveNoteComment,
  setNoteStatus,
  syncNoteMapWithRemote,
} from './helpers';
import { RemoteDb } from './persistence/remote-db';
import { loadNotesFromFile, saveNotesToFile } from './persistence/local-db';

const noteMap = new Map<string, vscode.CommentThread>();
let remoteDb: RemoteDb | undefined;

export function activate(context: vscode.ExtensionContext) {
  Resource.initialize(context);
  if (getSetting('collab.enabled')) {
    remoteDb = new RemoteDb(
      getSetting('collab.host'),
      getSetting('collab.port'),
      getSetting('collab.username'),
      getSetting('collab.password'),
      getSetting('collab.database'),
      getSetting('collab.projectName'),
      getSetting('collab.ssl'),
      noteMap,
    );
  } else {
    remoteDb = undefined;
  }

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

  // save notes to file handler
  context.subscriptions.push(
    vscode.commands.registerCommand('security-notes.saveNotesToFile', () =>
      saveNotesToFileHandler(noteMap),
    ),
  );

  // create note button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.createNote',
      (reply: vscode.CommentReply) => {
        saveNoteComment(reply.thread, reply.text, true, noteMap, '', remoteDb);
      },
    ),
  );

  // reply note comment button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.replyNoteComment',
      (reply: vscode.CommentReply) => {
        saveNoteComment(reply.thread, reply.text, false, noteMap, '', remoteDb);
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
        if (thread.contextValue) {
          noteMap.delete(thread.contextValue);
        }
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

          if (remoteDb && comment.parent) {
            remoteDb.pushNoteComment(comment.parent, false);
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
        setNoteStatus(
          commentReply.thread,
          NoteStatus.Vulnerable,
          noteMap,
          '',
          remoteDb,
        ),
    ),
  );

  // set note status as not vulnerable button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.setNoteStatusNotVulnerable',
      (commentReply: vscode.CommentReply) =>
        setNoteStatus(
          commentReply.thread,
          NoteStatus.NotVulnerable,
          noteMap,
          '',
          remoteDb,
        ),
    ),
  );

  // set note status as TODO button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.setNoteStatusToDo',
      (commentReply: vscode.CommentReply) =>
        setNoteStatus(commentReply.thread, NoteStatus.TODO, noteMap, '', remoteDb),
    ),
  );

  // webview for importing tool results
  const importToolResultsWebview = new ImportToolResultsWebview(
    context.extensionUri,
    noteMap,
    remoteDb,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ImportToolResultsWebview.viewType,
      importToolResultsWebview,
    ),
  );

  // load persisted comments from file
  const persistedThreads = loadNotesFromFile();
  persistedThreads.forEach((thread) => {
    noteMap.set(thread.contextValue ? thread.contextValue : '', thread);
  });

  // initial retrieval of notes from database
  setTimeout(() => {
    if (remoteDb) {
      remoteDb.retrieveAll().then((remoteThreads) => {
        syncNoteMapWithRemote(noteMap, remoteThreads, remoteDb);
      });
    }
  }, 1500);
}

export function deactivate(context: vscode.ExtensionContext) {
  // persist comments in file
  saveNotesToFile(noteMap);
}
