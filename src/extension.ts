// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import ollama, { Ollama } from "ollama";
import { InlineCompletionDebouncer } from "./InlineCompletionDebouncer";
import { CodeCompletionCache } from "./CodeCompletionCache";
import * as RenamingSuggestions from "./annotation-sample";
// import * as SemanticTokens from "./semantic-tokens.example";

/**
 * Todo:
 *
 * - Specific niceties. Like:
 *    - SemanticTokensProvider:
 *        - The user can instruct the agent to semantically tokenize arbitrary
 *          patterns given by a natural language prompt.
 *    - TaskProvider:
 *        - With ProcessExecution
 *          - Add documents to VectorIndex;
 *        - With ShellExecution
 *          - Execute an Ollama CLI directly
 *        - With CustomExecution
 *          - (not clear yet) I need vscode extension ideas that could benefit from a custom task execution and a vscode Pseudoterminal:
 *              - will define it later.
 *    - FileSystemProvider
 *        - Don't know yet.
 *    - createCommentController (Comment API)
 *        - Obviously: persisted localized chat histories across sessions.
 *    - CodeActionsProvider // fix problems, beautify code
 *        - Quick smart code actions that refactor some code.
 *          - Moving code to a new separate module.
 *          - Apply Elm best-practices to specific section.
 *     - Diagnostics
 *        - Check for existing or alternative ways of implementing a
 *          problematic section of the sourc code.
 *     - CodeLens
 *        - Suggest existing commands based on the corresponding section of code.
 *            - Randomly explore existing commands using getCommands()
 *                - Randomly select "n" commands and check if their description applies to target code block.
 *      - HoverProvider
 *      - DocumentSymbolProvider
 *          - Arbitrary symbols identified with natural languae.
 *              - tbd
 *      - DocumentHighlight
 *          - Arbitrary highlights like: semantic matches, all exit points of a function, all ranges of code that were identified in a refactoring opportunity.
 *      - DocumentLinkProvider
 *          - Links to a chat message of the past, or links to anything else, really. Could tie in with the FSProvider to open virtual resources like a Graph Rag Note.
 *     - FoldingRangeProvider
 *        - Semantic, automatic #region identifier.
 *        - Regions of code lines Semantically similar to a given argument string or another section.
 *    - TextEditorDecorators
 *        - tbd
 *        - code reviews.
 */

/**
 * New Idea:
 *  - Naming variables and functions, classes, etc:
 *      We ask the llm to identify better name opprtunities
 *      ans then we surround it using the diagnostics system.
 */

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let logger = vscode.window.createOutputChannel(`BNCoder4`, { log: true });
  context.subscriptions.push(logger);

  RenamingSuggestions.activate(context, logger);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "bncoder4.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from bncoder4!");
    }
  );

  context.subscriptions.push(disposable);

  // SemanticTokens.activate(context);

  let temporalContext: string[] = [];

  // Subscribe to editor events in order to build some temporal context
  // information to the completion agent to improve responses.

  /**
   * Listens to changes of the current active editor
   * If the current active editor changes, we get the text that
   * is currently visible to the user and append it to the temporalContext
   * array;
   */
  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (!editor) return;

      // Get the text from the editor's current visible range
      const start = editor.selection.start;
      const end = editor.selection.end;

      let text = editor.document.getText(new vscode.Range(start, end));

      // Now we need to append this text to the temporalContext
      // along with the relative file path and a header to distinguish
      // this event from the other events we will listen to.
      let formattedEventContextChunk = ``;

      // logger.info(`BNCoder4: ${text}`);
    }
  );

  context.subscriptions.push(activeEditorListener);

  let debouncer = InlineCompletionDebouncer.getInstance(logger);
  let requestsCounter = 0;
  let completionsCache = new CodeCompletionCache();
  const requestsInProgress = new Map<number, Ollama>();

  /**
   * Provides inline completion items for the active editor.
   */
  const inlineCompletionProvider: vscode.InlineCompletionItemProvider = {
    provideInlineCompletionItems: function (
      document: vscode.TextDocument,
      position: vscode.Position,
      context: vscode.InlineCompletionContext,
      token: vscode.CancellationToken
    ): vscode.ProviderResult<
      vscode.InlineCompletionItem[] | vscode.InlineCompletionList
    > {
      logger.info(`BNCoder4: InlineCompletionsRequested`);
      const cancelRequest = () => {
        logger.info("BNCoder4: Cancelled");
        logger.info(`Requests in progress: ${requestsInProgress.size}`);
        logger.info(`Request counter: ${requestsCounter}`);
        return { items: [] };
      };

      const fileName = document.uri.toString();

      const completionHandler = async () => {
        if (token.isCancellationRequested) {
          return cancelRequest();
        }
        let items: vscode.InlineCompletionItem[] = [];
        const cacheKey = completionsCache.generateKey(
          fileName,
          document,
          position
        );
        const cachedCompletion = completionsCache.get(cacheKey);

        if (cachedCompletion) {
          logger.info(`BNCoder4: Returning  Cached Completion`);
          return {
            items: [cachedCompletion],
          };
        }

        try {
          if (token.isCancellationRequested) {
            return cancelRequest();
          }

          let text = document.getText();
          let cursorOffset = document.offsetAt(position);
          let prefix = text.slice(0, cursorOffset);
          let suffix = text.slice(cursorOffset);

          requestsCounter += 1;
          if (requestsCounter > 3 || requestsInProgress.size > 3) {
            logger.warn("BNCoder4: Too many requests");
          }

          let client = new Ollama();
          let requestId = Math.floor(Math.random() * 10 ** 9);
          while (requestsInProgress.has(requestId)) {
            requestId = Math.floor(Math.random() * 10 ** 9);
          }
          requestsInProgress.set(requestId, client);

          logger.info(`Requests in progress: ${requestsInProgress.size}`);
          logger.info(`Request counter: ${requestsCounter}`);
          logger.info(`BNCoder4: Sending request [`, requestId, "]");

          let contents = "";

          try {
            let generationStream = await client.generate({
              model: `qwen2.5-coder:1.5b-instruct`,
              prompt: prefix,
              keep_alive: "30m",
              suffix,
              stream: true,
              options: {
                num_predict: 50,
              },
              // system: `You are Qwen, an expert coding assistant.
              // You are running inside an IDE providing inline suggestions to the
              // user as he works.

              // ## Latest user events

              // `,
            });
            try {
              for await (const chunk of generationStream) {
                if (chunk.response?.length) {
                  contents += chunk.response;
                }
                if (
                  token.isCancellationRequested ||
                  !requestsInProgress.has(requestId) ||
                  chunk.done
                ) {
                  requestsInProgress.delete(requestId);
                  client.abort();
                  break;
                }
              }
            } catch (error: any) {
              logger.error(error);
              logger.warn(`Error in request [${requestId}]`);
              throw error;
            }
          } catch (error: any) {
            if (error.name === `AbortError`) {
              logger.warn(`Ollama request aborted : [${requestId}]`);
            } else {
              logger.error(`BNCoder4 Ollama error: ${error}`);
            }
            logger.info(`Requests in progress: ${requestsInProgress.size}`);
            logger.info(`Request counter: ${requestsCounter}`);
          } finally {
            requestsCounter -= 1;
            requestsInProgress.delete(requestId);
            logger.info(
              "BNCoder4 Response:",
              contents.slice(0, Math.min(30, contents.length)),
              "..."
            );

            if (contents.trim().length > 1) {
              items.push({
                insertText: contents,
                range: new vscode.Range(
                  position.line,
                  position.character,
                  position.line,
                  position.character
                ),
              });
              completionsCache.put(cacheKey, items[items.length - 1]);
            }

            logger.info(`BNCoder4: Pending requests: ${requestsCounter}`);
            logger.info(`In progress: ${requestsInProgress.size}`);
          }

          if (token.isCancellationRequested) {
            return cancelRequest();
          }

          logger.info(`BNCoder4: AllsGood`);

          return { items };
        } catch (err) {
          logger.error("BNCoder4 Error:", err);

          return { items: [] };
        }
      };

      if (token.isCancellationRequested) {
        return cancelRequest();
      }
      logger.info(`BNCoder4: Scheduling Request `);
      return debouncer.debounce(async () => completionHandler(), 3000);
    },
  };

  const inlineCompletionDisposable =
    vscode.languages.registerInlineCompletionItemProvider(
      { scheme: "file" },
      inlineCompletionProvider
    );

  context.subscriptions.push(inlineCompletionDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
