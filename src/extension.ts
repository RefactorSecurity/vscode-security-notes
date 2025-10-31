'use strict';

import * as vscode from 'vscode';
import { NoteStatus } from './models/noteStatus';
import { NoteComment } from './models/noteComment';
import { Resource } from './reactions/resource';
import { ImportToolResultsWebview } from './webviews/import-tool-results/importToolResultsWebview';
import { ExportNotesWebview } from './webviews/export-notes/exportNotesWebview';
import { commentController } from './controllers/comments';
import { reactionHandler } from './handlers/reaction';
import { saveNotesToFileHandler } from './handlers/saveNotesToFile';
import { getSetting } from './utils';
import {
  saveNoteComment,
  setNoteStatus,
  syncNoteMapWithRemote,
} from './helpers';
import { RemoteDb } from './persistence/remote-db';
import { loadNotesFromFile, saveNotesToFile } from './persistence/local-db';
import { BreadcrumbStore } from './breadcrumbs/store';
import { registerBreadcrumbCommands } from './breadcrumbs/commands';
import {
  loadBreadcrumbsFromFile,
  saveBreadcrumbsToFile,
} from './persistence/local-db/breadcrumbs';
import { BreadcrumbsWebview } from './webviews/breadcrumbs/breadcrumbsWebview';

const noteMap = new Map<string, vscode.CommentThread>();
let remoteDb: RemoteDb | undefined;
const breadcrumbStore = new BreadcrumbStore();

export function activate(context: vscode.ExtensionContext) {
  Resource.initialize(context);
  const persistedBreadcrumbState = loadBreadcrumbsFromFile();
  breadcrumbStore.replaceState(persistedBreadcrumbState);
  const breadcrumbStoreSubscription = breadcrumbStore.onDidChange(() => {
    saveBreadcrumbsToFile(breadcrumbStore);
  });
  context.subscriptions.push(breadcrumbStoreSubscription);

  const breadcrumbsWebview = new BreadcrumbsWebview(
    context.extensionUri,
    breadcrumbStore,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BreadcrumbsWebview.viewType,
      breadcrumbsWebview,
    ),
    breadcrumbsWebview,
  );

  registerBreadcrumbCommands(context, breadcrumbStore, {
    onShowTrailDiagram: async (trail) => {
      breadcrumbStore.setActiveTrail(trail.id);
      breadcrumbsWebview.reveal(trail.id);
    },
  });
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

  /**
   * Handles the common logic for setting a note's status via a command.
   *
   * @param reply The argument passed by the command (either CommentReply or just the thread).
   * @param status The NoteStatus to set (TODO, Vulnerable, Not Vulnerable).
   * @param noteMap The object storing all notes in memory.
   * @param remoteDb Remote db for collaboration.
   */
  const handleSetStatusAction = (
    reply: vscode.CommentReply | { thread: vscode.CommentThread },
    status: NoteStatus,
    noteMap: Map<string, vscode.CommentThread>,
    remoteDb?: RemoteDb
  ) => {
    const thread = reply.thread;
    // Extract the text of the reply box
    const text = 'text' in reply ? reply.text : undefined;

    // Set the status (this function handles adding the status change comment)
    setNoteStatus(
      thread,
      status, // New status to set
      noteMap,
      '',
      remoteDb,
      text // Reply text
    );
  };

  // --- Register the status commands ---

  // Set note status as Vulnerable button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.setNoteStatusVulnerable',
      (reply: vscode.CommentReply | { thread: vscode.CommentThread }) =>
        handleSetStatusAction(reply, NoteStatus.Vulnerable, noteMap, remoteDb)
    )
  );

  // Set note status as Not Vulnerable button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.setNoteStatusNotVulnerable',
      (reply: vscode.CommentReply | { thread: vscode.CommentThread }) =>
        handleSetStatusAction(reply, NoteStatus.NotVulnerable, noteMap, remoteDb)
    )
  );

  // Set note status as TODO button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.setNoteStatusToDo',
      (reply: vscode.CommentReply | { thread: vscode.CommentThread }) =>
        handleSetStatusAction(reply, NoteStatus.TODO, noteMap, remoteDb)
    )
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

  // webview for exporting notes
  const exportNotesWebview = new ExportNotesWebview(context.extensionUri, noteMap);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ExportNotesWebview.viewType,
      exportNotesWebview,
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
  saveBreadcrumbsToFile(breadcrumbStore);
}
