import * as vscode from 'vscode';
import { NoteStatus } from './models/noteStatus';
import { NoteComment } from './models/noteComment';
import { getReactionGroup } from './reactions/resource';
import { RemoteDb } from './persistence/remote-db';
import { v4 as uuidv4 } from 'uuid';
import { Deserializer } from './persistence/serialization/deserializer';
import { saveNotesToFile } from './persistence/local-db';
import { getSetting } from './utils';

export const saveNoteComment = (
  thread: vscode.CommentThread,
  text: string,
  firstComment: boolean,
  noteMap: Map<string, vscode.CommentThread>,
  author?: string,
  remoteDb?: RemoteDb,
) => {
  const newComment = new NoteComment(
    text,
    vscode.CommentMode.Preview,
    { name: author ? author : getSetting('authorName') },
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
    thread.contextValue = uuidv4();
    noteMap.set(thread.contextValue, thread);
  }
  saveNotesToFile(noteMap);
  if (remoteDb) {
    remoteDb.pushNoteComment(thread, firstComment);
  }
};

export const setNoteStatus = (
  thread: vscode.CommentThread,
  status: NoteStatus,
  noteMap: Map<string, vscode.CommentThread>,
  author?: string,
  remoteDb?: RemoteDb,
  replyText?: string,
) => {
  const comment: vscode.Comment | any = thread.comments[0];

  let originalText = comment.body.toString();

  // Clean up any existing status badges
  const statusValuesPattern = Object.values(NoteStatus).join('|');
  const statusRegex = new RegExp(`^\\[(${statusValuesPattern})\\] `, 'g');
  originalText = originalText.replace(statusRegex, '');

  // Update the comment
  comment.body = `[${status}] ${originalText}`;
  comment.savedBody = originalText;

  // Add note comment about status change
  const statusMessage = replyText ?
    `Status changed to ${status}.\n\n${replyText}` :
    `Status changed to ${status}.`;

  saveNoteComment(
    thread,
    statusMessage,
    false,
    noteMap,
    author ? author : '',
    remoteDb,
  );
};

export const mergeThread = (local: vscode.CommentThread, remote: any): boolean => {
  // add comments of new thread to current thread if not exist
  // TODO: replace with structuredClone()
  const mergedComments: vscode.Comment[] = [];
  let merged = false;
  local.comments.forEach((comment) => {
    mergedComments.push(comment);
  });

  remote.comments.forEach((comment: any) => {
    comment = Deserializer.deserializeComment(comment, undefined);
    if (
      !local.comments.find(
        (currentComment) =>
          Number(currentComment.timestamp) == Number(comment.timestamp),
      )
    ) {
      comment.parent = local;
      mergedComments.push(comment);
      merged = true;
    }
  });

  // sort all comments and assign unique comments to current thread
  mergedComments.sort(
    (a: vscode.Comment, b: vscode.Comment) =>
      (a.timestamp ? Number(a.timestamp) : 0) - (b.timestamp ? Number(b.timestamp) : 0),
  );

  // mark all merged comments as deletable, except for the first one
  mergedComments.slice(1).forEach((comment) => (comment.contextValue = 'canDelete'));

  // assigned unique and sorted comments to current thread
  local.comments = mergedComments;
  return merged;
};

export const syncNoteMapWithRemote = (
  noteMap: Map<string, vscode.CommentThread>,
  remoteSerializedThreads: any,
  remoteDb: RemoteDb | undefined,
) => {
  // pull remote threads
  remoteSerializedThreads.forEach((remoteSerializedThread: any) => {
    const threadId = remoteSerializedThread.id;
    // if remote thread doesn't exist in local map, add it to local
    if (!noteMap.has(threadId)) {
      const remoteThread: vscode.CommentThread =
        Deserializer.deserializeThread(remoteSerializedThread);
      noteMap.set(threadId, remoteThread);
      return;
    }

    // get local thread
    const localThread = noteMap.get(threadId);
    if (!localThread) {
      return;
    }

    // if new comments were merged, push to remote
    if (mergeThread(localThread, remoteSerializedThread)) {
      remoteDb && remoteDb.pushNoteComment(localThread, false);
    }
  });

  // push local only threads to remote
  noteMap.forEach((localThread, id) => {
    if (
      !remoteSerializedThreads.find((remoteSerializedThread: any) => {
        return remoteSerializedThread.contextValue == id;
      })
    ) {
      remoteDb && remoteDb.pushNoteComment(localThread, true);
    }
  });

  saveNotesToFile(noteMap);
};