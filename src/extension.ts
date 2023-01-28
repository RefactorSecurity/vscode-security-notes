'use strict';

import * as vscode from 'vscode';

let commentId = 1;

enum NoteCommentStatus {
	TODO = "To-Do",
	Vulnerable = "Vulnerale",
	NotVulnerable = "Not Vulnerable",
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
		public contextValue?: string
	) {
		this.id = ++commentId;
		this.savedBody = this.body;
	}
}

export function activate(context: vscode.ExtensionContext) {
	// A `CommentController` is able to provide comments for documents.
	const commentController = vscode.comments.createCommentController('comment-sample', 'Comment API Sample');
	context.subscriptions.push(commentController);

	// A `CommentingRangeProvider` controls where gutter decorations that allow adding comments are shown
	commentController.commentingRangeProvider = {
		provideCommentingRanges: (document: vscode.TextDocument, token: vscode.CancellationToken) => {
			const lineCount = document.lineCount;
			return [new vscode.Range(0, 0, lineCount - 1, 0)];
		}
	};

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.createNote', (reply: vscode.CommentReply) => {
		replyNote(reply, true);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.replyNote', (reply: vscode.CommentReply) => {
		replyNote(reply, false);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.deleteNoteComment', (comment: NoteComment) => {
		const thread = comment.parent;
		if (!thread) {
			return;
		}

		thread.comments = thread.comments.filter(cmt => (cmt as NoteComment).id !== comment.id);

		if (thread.comments.length === 0) {
			thread.dispose();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.deleteNote', (thread: vscode.CommentThread) => {
		thread.dispose();
	}));
	
	context.subscriptions.push(vscode.commands.registerCommand('mywiki.cancelsaveNote', (comment: NoteComment) => {
		if (!comment.parent) {
			return;
		}
		
		comment.parent.comments = comment.parent.comments.map(cmt => {
			if ((cmt as NoteComment).id === comment.id) {
				cmt.body = (cmt as NoteComment).savedBody;
				cmt.mode = vscode.CommentMode.Preview;
			}
			
			return cmt;
		});
	}));
	
	context.subscriptions.push(vscode.commands.registerCommand('mywiki.saveNote', (comment: NoteComment) => {
		if (!comment.parent) {
			return;
		}
		
		comment.parent.comments = comment.parent.comments.map(cmt => {
			if ((cmt as NoteComment).id === comment.id) {
				(cmt as NoteComment).savedBody = cmt.body;
				cmt.mode = vscode.CommentMode.Preview;
			}
			
			return cmt;
		});
	}));
	
	context.subscriptions.push(vscode.commands.registerCommand('mywiki.editNote', (comment: NoteComment) => {
		if (!comment.parent) {
			return;
		}
		
		comment.parent.comments = comment.parent.comments.map(cmt => {
			if ((cmt as NoteComment).id === comment.id) {
				cmt.mode = vscode.CommentMode.Editing;
			}
			
			return cmt;
		});
	}));
	
	context.subscriptions.push(vscode.commands.registerCommand('mywiki.dispose', () => {
		commentController.dispose();
	}));
	
	context.subscriptions.push(vscode.commands.registerCommand('mywiki.setNoteStatusVulnerable', (commentReply: vscode.CommentReply) => setNoteStatus(commentReply, NoteCommentStatus.Vulnerable)));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.setNoteStatusNotVulnerable', (commentReply: vscode.CommentReply) => setNoteStatus(commentReply, NoteCommentStatus.NotVulnerable)));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.setNoteStatusToDo', (commentReply: vscode.CommentReply) => setNoteStatus(commentReply, NoteCommentStatus.TODO)));
	
	function replyNote(reply: vscode.CommentReply, firstComment: boolean) {
		const thread = reply.thread;
		const newComment = new NoteComment(reply.text, vscode.CommentMode.Preview, { name: 'vscode' }, thread, thread.comments.length ? 'canDelete' : undefined);
		thread.comments = [...thread.comments, newComment];
		if (firstComment) {
			updateFirstCommentStatus(newComment, NoteCommentStatus.TODO);
		}
	}

	function updateFirstCommentStatus(comment: vscode.Comment, status: NoteCommentStatus) {
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
		const newComment = new NoteComment(`Status changed to ${status}.`, vscode.CommentMode.Preview, { name: 'vscode' }, thread, thread.comments.length ? 'canDelete' : undefined);
		thread.comments = [...thread.comments, newComment];
	}

}
