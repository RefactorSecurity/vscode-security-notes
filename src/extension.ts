'use strict';

import * as vscode from 'vscode';
import { NoteStatus } from './models/noteStatus';
import { NoteComment } from './models/noteComment';
import { Resource } from './reactions/resource';
import { ImportToolResultsWebview } from './webviews/import-tool-results/importToolResultsWebview';
import { ExportNotesWebview } from './webviews/export-notes/exportNotesWebview';
import { ExportBreadcrumbsWebview } from './webviews/export-breadcrumbs/exportBreadcrumbsWebview';
import { commentController } from './controllers/comments';
import { breadcrumbsController } from './controllers/breadcrumbs';
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
import { BreadcrumbsSidebarWebview } from './webviews/breadcrumbs/breadcrumbsSidebarWebview';
import { BreadcrumbsWebview } from './webviews/breadcrumbs/breadcrumbsWebview';
import { updateBreadcrumbDecorations } from './decorations/breadcrumbDecoration';
import { loadBreadcrumbsFromFile, saveBreadcrumbsToFile } from './persistence/breadcrumbs-persistence';

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
  
  // add breadcrumb point from note button
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'security-notes.addBreadcrumbPointFromNote',
      async (commentReply: vscode.CommentReply) => {
        const thread = commentReply.thread;
        if (!thread) {
          return;
        }
        
        // Get existing breadcrumbs
        const breadcrumbs = breadcrumbsController.getAllBreadcrumbs();
        if (breadcrumbs.length === 0) {
          const createNew = await vscode.window.showInformationMessage(
            'No breadcrumbs found. Create a new one?',
            'Yes', 'No'
          );
          
          if (createNew === 'Yes') {
            vscode.commands.executeCommand('security-notes.createBreadcrumb');
          }
          return;
        }

        // Let user select which breadcrumb to add the point to
        const breadcrumbLabels = breadcrumbs.map(b => ({ 
          label: b.label, 
          description: `(${b.points.length} points)`,
          breadcrumb: b
        }));
        
        const selectedBreadcrumb = await vscode.window.showQuickPick(breadcrumbLabels, {
          placeHolder: 'Select a breadcrumb to add a point to'
        });

        if (!selectedBreadcrumb) {
          return;
        }

        // Let user enter a tag for the breadcrumb point
        const tag = await vscode.window.showInputBox({
          prompt: 'Enter a tag for this breadcrumb point',
          placeHolder: 'e.g., User Input, API Call'
        });

        if (!tag) {
          return;
        }

        // Get active editor and selection
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No active editor');
          return;
        }

        // Use the comment thread's range for the breadcrumb point
        const range = thread.range;
        
        // Add point to the selected breadcrumb
        breadcrumbsController.addPointToBreadcrumb(
          selectedBreadcrumb.breadcrumb.id,
          tag,
          range,
          editor.document.uri,
          thread.contextValue // Link to the note ID
        );

        // Refresh UI and persist changes
        breadcrumbsSidebarWebview.refreshWebview();
        saveBreadcrumbsToFile(breadcrumbsController['breadcrumbs']);
        
        // Update decorations in the editor
        updateBreadcrumbDecorations(
          editor,
          breadcrumbsController.getPointsForBreadcrumb(selectedBreadcrumb.breadcrumb.id)
        );
        
        // Show confirmation
        vscode.window.showInformationMessage(`Added point to breadcrumb "${selectedBreadcrumb.breadcrumb.label}"`);
      }
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

  // webview for exporting notes
  const exportNotesWebview = new ExportNotesWebview(context.extensionUri, noteMap);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ExportNotesWebview.viewType,
      exportNotesWebview,
    ),
  );
  
  // webview for exporting breadcrumbs
  const exportBreadcrumbsWebview = new ExportBreadcrumbsWebview(
    context.extensionUri, 
    breadcrumbsController['breadcrumbs']
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ExportBreadcrumbsWebview.viewType,
      exportBreadcrumbsWebview,
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

  // BREADCRUMBS FEATURE
  // Load persisted breadcrumbs from file
  const breadcrumbsMap = loadBreadcrumbsFromFile();
  breadcrumbsMap.forEach((breadcrumb, id) => {
    // Add each loaded breadcrumb to the controller
    breadcrumbsController['breadcrumbs'].set(id, breadcrumb);
  });

  // Add command to create a new breadcrumb
  context.subscriptions.push(
    vscode.commands.registerCommand('security-notes.createBreadcrumb', async () => {
      const label = await vscode.window.showInputBox({
        prompt: 'Enter a label for this breadcrumb trail',
        placeHolder: 'e.g., Authentication Flow'
      });

      if (label) {
        breadcrumbsController.createBreadcrumb(label);
        breadcrumbsSidebarWebview.refreshWebview();
        saveBreadcrumbsToFile(breadcrumbsController['breadcrumbs']);
      }
    })
  );

  // Add command to add a point to a breadcrumb
  context.subscriptions.push(
    vscode.commands.registerCommand('security-notes.addBreadcrumbPoint', async () => {
      const breadcrumbs = breadcrumbsController.getAllBreadcrumbs();
      if (breadcrumbs.length === 0) {
        const createNew = await vscode.window.showInformationMessage(
          'No breadcrumbs found. Create a new one?',
          'Yes', 'No'
        );
        
        if (createNew === 'Yes') {
          vscode.commands.executeCommand('security-notes.createBreadcrumb');
        }
        return;
      }

      const breadcrumbLabels = breadcrumbs.map(b => ({ 
        label: b.label, 
        description: `(${b.points.length} points)`,
        breadcrumb: b
      }));
      
      const selectedBreadcrumb = await vscode.window.showQuickPick(breadcrumbLabels, {
        placeHolder: 'Select a breadcrumb to add a point to'
      });

      if (!selectedBreadcrumb) {
        return;
      }

      const tag = await vscode.window.showInputBox({
        prompt: 'Enter a tag for this breadcrumb point',
        placeHolder: 'e.g., User Input, API Call'
      });

      if (!tag) {
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showErrorMessage('Please select some code to mark as a breadcrumb point');
        return;
      }

      breadcrumbsController.addPointToBreadcrumb(
        selectedBreadcrumb.breadcrumb.id,
        tag,
        selection,
        editor.document.uri
      );

      breadcrumbsSidebarWebview.refreshWebview();
      saveBreadcrumbsToFile(breadcrumbsController['breadcrumbs']);
      
      // Update decorations in the editor
      updateBreadcrumbDecorations(
        editor,
        breadcrumbsController.getPointsForBreadcrumb(selectedBreadcrumb.breadcrumb.id)
      );
    })
  );

  // Add command to follow a breadcrumb
  context.subscriptions.push(
    vscode.commands.registerCommand('security-notes.followBreadcrumb', async () => {
      const breadcrumbs = breadcrumbsController.getAllBreadcrumbs();
      if (breadcrumbs.length === 0) {
        vscode.window.showInformationMessage('No breadcrumbs found');
        return;
      }

      const breadcrumbLabels = breadcrumbs.map(b => ({ 
        label: b.label, 
        description: `(${b.points.length} points)`,
        breadcrumb: b
      }));
      
      const selectedBreadcrumb = await vscode.window.showQuickPick(breadcrumbLabels, {
        placeHolder: 'Select a breadcrumb to follow'
      });

      if (!selectedBreadcrumb || selectedBreadcrumb.breadcrumb.points.length === 0) {
        return;
      }

      // Open the main breadcrumbs panel to navigate through points
      new BreadcrumbsWebview(
        context.extensionUri,
        breadcrumbsController['breadcrumbs'],
        (label) => {
          breadcrumbsController.createBreadcrumb(label);
          breadcrumbsSidebarWebview.refreshWebview();
          saveBreadcrumbsToFile(breadcrumbsController['breadcrumbs']);
        },
        (id) => {
          breadcrumbsController.deleteBreadcrumb(id);
          breadcrumbsSidebarWebview.refreshWebview();
          saveBreadcrumbsToFile(breadcrumbsController['breadcrumbs']);
        },
        (uri, range) => {
          vscode.workspace.openTextDocument(uri).then(doc => {
            vscode.window.showTextDocument(doc).then(editor => {
              editor.selection = new vscode.Selection(range.start, range.end);
              editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            });
          });
        }
      );
    })
  );

  // Add command to save breadcrumbs to file
  context.subscriptions.push(
    vscode.commands.registerCommand('security-notes.saveBreadcrumbsToFile', () => {
      saveBreadcrumbsToFile(breadcrumbsController['breadcrumbs']);
    })
  );
  
  // Add command to export breadcrumbs
  context.subscriptions.push(
    vscode.commands.registerCommand('security-notes.exportBreadcrumbs', () => {
      vscode.commands.executeCommand('export-breadcrumbs-view.focus');
    })
  );

  // Create and register the breadcrumbs sidebar webview
  const breadcrumbsSidebarWebview = new BreadcrumbsSidebarWebview(
    context.extensionUri,
    breadcrumbsController['breadcrumbs']
  );
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BreadcrumbsSidebarWebview.viewType,
      breadcrumbsSidebarWebview
    )
  );
  
  // Update breadcrumb decorations when editor changes
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      const allPoints = Array.from(breadcrumbsController['breadcrumbs'].values())
        .flatMap(breadcrumb => breadcrumb.points);
      
      updateBreadcrumbDecorations(editor, allPoints);
    }
  }, null, context.subscriptions);
  
  // Update initial decorations in active editor
  if (vscode.window.activeTextEditor) {
    const allPoints = Array.from(breadcrumbsController['breadcrumbs'].values())
      .flatMap(breadcrumb => breadcrumb.points);
    
    updateBreadcrumbDecorations(vscode.window.activeTextEditor, allPoints);
  }
}

export function deactivate(context: vscode.ExtensionContext) {
  // persist comments in file
  saveNotesToFile(noteMap);
  
  // persist breadcrumbs in file
  saveBreadcrumbsToFile(breadcrumbsController['breadcrumbs']);
}