/**
 * The code below was created from this specification:
 *
 * # Project Name
 *
 * VSCode Comments Extension
 *
 * ## Overview
 *
 * This extension provides a simple comment API to allow users to add comments to documents in VSCode. The extension includes commands for creating notes, replying to notes, starting and finishing drafts, deleting note comments, deleting notes, editing notes, and disposing of the controller.
 *
 *
 * # Requirements
 *
 * 1. Implement the following command handlers:
 *   - `mywiki.createNote` to create a note comment.
 *   - `mywiki.replyNote` to reply to a note comment.
 *   - `mywiki.startDraft` to start a draft note.
 *   - `mywiki.finishDraft` to finish a draft note.
 *   - `mywiki.deleteNoteComment` to delete a note comment.
 *   - `mywiki.deleteNote` to delete a note.
 *   - `mywiki.cancelsaveNote` to cancel a note save.
 *   - `mywiki.saveNote` to save a note.
 *   - `mywiki.editNote` to edit a note.
 *   - `mywiki.dispose` to dispose of the comment controller.
 *
 * 2. Implement the `replyNote` function to create a new note comment in reply to the previous note comment that was replied to.
 *
 * 3. Implement the `replyNote` function to create a new note comment in reply to the previous note comment that was replied to.
 *
 * 4. Implement the `saveNote` function to save a note comment.
 *
 * 5. Implement the `finishDraft` function to save a note comment.
 *
 * 6. Implement the `deleteNoteComment` function to delete a note comment.
 *
 * 7. Implement the `deleteNote` function to delete a note.
 *
 * 8. Implement the `editNote` function to edit a note comment.
 *
 * 9. Implement the `dispose` function to dispose of the comment controller.
 *
 * 10. Create a command handler for the `createNote` command that replies to the previous note comment that was replied to.
 *
 */
import * as vscode from "vscode";

let commentId = 1;

class NoteComment implements vscode.Comment {
  id: number;
  label: string | undefined;
  savedBody: string | vscode.MarkdownString; // for the Cancel button
  constructor(
    public body: string | vscode.MarkdownString,
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
  const commentController = vscode.comments.createCommentController(
    "comment-sample",
    "Comment API Sample"
  );
  context.subscriptions.push(commentController);

  // A `CommentingRangeProvider` controls where gutter decorations that allow adding comments are shown
  commentController.commentingRangeProvider = {
    provideCommentingRanges: (
      document: vscode.TextDocument,
      _token: vscode.CancellationToken
    ) => {
      const lineCount = document.lineCount;
      return [new vscode.Range(0, 0, lineCount - 1, 0)];
    },
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.createNote",
      (reply: vscode.CommentReply) => {
        replyNote(reply);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.replyNote",
      (reply: vscode.CommentReply) => {
        replyNote(reply);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.startDraft",
      (reply: vscode.CommentReply) => {
        const thread = reply.thread;
        thread.contextValue = "draft";
        const newComment = new NoteComment(
          reply.text,
          vscode.CommentMode.Preview,
          { name: "vscode" },
          thread
        );
        newComment.label = "pending";
        thread.comments = [...thread.comments, newComment];
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.finishDraft",
      (reply: vscode.CommentReply) => {
        const thread = reply.thread;

        if (!thread) {
          return;
        }

        thread.contextValue = undefined;
        thread.collapsibleState =
          vscode.CommentThreadCollapsibleState.Collapsed;
        if (reply.text) {
          const newComment = new NoteComment(
            reply.text,
            vscode.CommentMode.Preview,
            { name: "vscode" },
            thread
          );
          thread.comments = [...thread.comments, newComment].map((comment) => {
            comment.label = undefined;
            return comment;
          });
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.deleteNoteComment",
      (comment: NoteComment) => {
        const thread = comment.parent;
        if (!thread) {
          return;
        }

        thread.comments = thread.comments.filter(
          (cmt) => (cmt as NoteComment).id !== comment.id
        );

        if (thread.comments.length === 0) {
          thread.dispose();
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.deleteNote",
      (thread: vscode.CommentThread) => {
        thread.dispose();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.cancelsaveNote",
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
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.saveNote",
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
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.editNote",
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
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("mywiki.dispose", () => {
      commentController.dispose();
    })
  );

  function replyNote(reply: vscode.CommentReply) {
    const thread = reply.thread;
    const newComment = new NoteComment(
      reply.text,
      vscode.CommentMode.Preview,
      { name: "vscode" },
      thread,
      thread.comments.length ? "canDelete" : undefined
    );
    if (thread.contextValue === "draft") {
      newComment.label = "pending";
    }

    thread.comments = [...thread.comments, newComment];
  }
}
