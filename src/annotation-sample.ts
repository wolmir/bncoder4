// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { generateJson } from "./utils/generateJson";
import { z } from "zod";

const ANNOTATION_PROMPT = `Find renaming oportunities in the following source code:
-----
{{source_code}}
-----
`;

export interface IRenameSuggestion {
  oldName?: string | null;
  newName?: string | null;
}

export interface IRenameSuggestions {
  renames: IRenameSuggestion[];
}

const RenameSchema = z.object({
  oldName: z
    .nullable(z.string())
    .describe(`The original name in the given code`),
  newName: z
    .nullable(z.string())
    .describe(`A new name for that symbol, if it is better than the old one`),
});
const RenameSuggestionsSchema = z.object({
  renames: z
    .array(RenameSchema)
    .describe(`A list of rename suggestions for the given code`),
});

export async function generateRenamingSuggestions(doc: vscode.TextDocument) {
  let prompt = ANNOTATION_PROMPT.replace(`{{source_code}}`, doc.getText());
  let response = await generateJson<IRenameSuggestions>(
    prompt,
    RenameSuggestionsSchema
  );

  return (
    response ?? {
      renames: [],
    }
  );
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "bncoder4.suggestBetterNames",
      async (textEditor: vscode.TextEditor) => {
        const suggestions = await generateRenamingSuggestions(
          textEditor.document
        );

        await processSuggestions(suggestions, textEditor);
      }
    )
  );
}

async function processSuggestions(
  suggestions: IRenameSuggestions,
  textEditor: vscode.TextEditor
) {
  let accumulatedResponse = "";

  for (const suggestion of suggestions.renames) {
    if (!!suggestion.newName?.length && !!suggestion.oldName?.length) {
      try {
        applyDecoration(textEditor, suggestion);
        // reset the accumulator for the next line
        accumulatedResponse = "";
      } catch {
        // do nothing
      }
    }
  }
}

function applyDecoration(
  editor: vscode.TextEditor,
  suggestion: IRenameSuggestion
) {
  if (!suggestion.newName || !suggestion.oldName) return;

  const { oldName, newName } = suggestion;
  const message = `Hint: Rename "${oldName}" to "${newName}"`;

  const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: `red`,
    // after: {
    //   contentText: ` ${message.substring(0, 25) + "..."}`,
    //   color: "grey",
    // },
  });

  const indexOfOldNameOccurrence = editor.document.getText().indexOf(oldName);
  const position = editor.document.positionAt(indexOfOldNameOccurrence);
  const endIndex = indexOfOldNameOccurrence + oldName.length;
  const endPosition = editor.document.positionAt(endIndex);

  const range = new vscode.Range(position, endPosition);

  const decoration: vscode.DecorationOptions = {
    range: range,
    hoverMessage: message,
  };

  vscode.window.activeTextEditor?.setDecorations(decorationType, [decoration]);
}

// This method is called when your extension is deactivated
export function deactivate() {}
