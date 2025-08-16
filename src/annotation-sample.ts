import * as vscode from "vscode";
import { generateJson } from "./utils/generateJson";
import { z } from "zod";

const ANNOTATION_PROMPT = `Find renaming oportunities in the following source code:
${"```"}
{{source_code}}
${"```"}
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

export async function generateRenamingSuggestions(
  doc: vscode.TextDocument,
  logger: vscode.LogOutputChannel
) {
  logger.info(`Renames: Start`);
  let lines = doc.getText().split(`\n`);
  let lineCount = lines.length;
  let maxLines = 50;
  let randomStart = Math.floor(Math.random() * lineCount);
  let endIndex = randomStart + maxLines;
  let chunk = lines.slice(randomStart, endIndex).join(`\n`);
  let prompt = ANNOTATION_PROMPT.replace(`{{source_code}}`, chunk);
  let response = await generateJson<IRenameSuggestions>(
    prompt,
    RenameSuggestionsSchema,
    logger
  );
  logger.info(`Renames: End`);

  return (
    response ?? {
      renames: [],
    }
  );
}

// This method is called when your extension is activated
export function activate(
  context: vscode.ExtensionContext,
  logger: vscode.LogOutputChannel
) {
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "bncoder4.suggestBetterNames",
      async (textEditor: vscode.TextEditor) => {
        const suggestions = await generateRenamingSuggestions(
          textEditor.document,
          logger
        );

        await processSuggestions(suggestions, textEditor, logger);
      }
    )
  );
}

async function processSuggestions(
  suggestions: IRenameSuggestions,
  textEditor: vscode.TextEditor,
  logger: vscode.LogOutputChannel
) {
  let accumulatedResponse = "";

  logger.info(`Applying decorations`);
  for (const suggestion of suggestions.renames) {
    logger.info(JSON.stringify(suggestion, null, 2));
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
    backgroundColor: `rgba(255, 183, 3, 0.4)`,
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
