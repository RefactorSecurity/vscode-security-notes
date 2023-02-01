import * as vscode from 'vscode';
import { NoteStatus } from './models/noteStatus';
import { NoteComment } from './models/noteComment';
import { getReactionGroup } from './reactions/resource';

export const saveNoteComment = (
  thread: vscode.CommentThread,
  text: string,
  firstComment: boolean,
  noteList: vscode.CommentThread[],
  author?: string,
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
    updateNoteStatus(newComment, NoteStatus.TODO);
    noteList.push(thread);
  }
};

export const setNoteStatus = (reply: vscode.CommentReply, status: NoteStatus) => {
  const thread = reply.thread;

  // Prepend new status on first note comment
  updateNoteStatus(thread.comments[0], status);

  // Add note comment about status change
  const newComment = new NoteComment(
    `Status changed to ${status}.`,
    vscode.CommentMode.Preview,
    { name: getSetting('authorName') },
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
};

const updateNoteStatus = (comment: vscode.Comment, status: NoteStatus) => {
  // Remove previous status if any
  comment.body = comment.body.toString().replace(/^\[.*\] /, '');

  // Set new status
  comment.body = `[${status}] ${comment.body}`;
};

export const getSetting = (settingName: string, defaultValue?: any) => {
  return vscode.workspace
    .getConfiguration('security-notes')
    .get(settingName, defaultValue);
};
