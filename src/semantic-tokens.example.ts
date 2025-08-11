import * as vscode from "vscode";

const SEMANTIC_TOKENS_PARSING_PROMPT = `You are an expert code reader. You excel at finding segments of text that match a given description.
You will be given the contents of a text file with each line of text prefixed by its corresponding line number.
Then the user will give you a description of a class of semantic tokens he wants to find in the given document.
You job is to identify a collection of text ranges that fit the user description.
To do that you will respond in a JSON format. Here are some examples:


`;

/**
 * 
    "semanticTokenTypes": [
      {
        "id": "textChunk",
        "description": "A chunk of text that was described in natural language by the user and identified by an AI agent."
      }
    ],
    "semanticTokenModifiers": [
      {
        "id": "identifiedByAi",
        "description": "Annotates a symbol that an AI agent matched to a user description."
      }
    ],
    "semanticTokenScopes": [
      {
        "scopes": {
          "textChunk": [
            "meta.support.other"
          ],
          "textChunk.identifiedByAi": [
            "meta.support.other"
          ]
        }
      }
    ],
 */

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function () {
  const tokenTypesLegend = ["textChunk"];
  tokenTypesLegend.forEach((tokenType, index) =>
    tokenTypes.set(tokenType, index)
  );

  const tokenModifiersLegend = ["identifiedByAi"];
  tokenModifiersLegend.forEach((tokenModifier, index) =>
    tokenModifiers.set(tokenModifier, index)
  );

  return new vscode.SemanticTokensLegend(
    tokenTypesLegend,
    tokenModifiersLegend
  );
})();

/**
 * Activates the extension and registers the DocumentSemanticTokensProvider.
 *
 * @param context - The extension context.
 * @returns A Promise that resolves when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: "*" },
      new DocumentSemanticTokensProvider(),
      legend
    )
  );
}

interface IParsedToken {
  line: number;
  startCharacter: number;
  length: number;
  tokenType: string;
  tokenModifiers: string[];
}

/**
 * Implements the DocumentSemanticTokensProvider interface.
 *
 * @param context - The extension context.
 * @returns A Promise that resolves when the extension is activated.
 */
class DocumentSemanticTokensProvider
  implements vscode.DocumentSemanticTokensProvider
{
  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens> {
    const allTokens = await this._parseText(document.getText());
    const builder = new vscode.SemanticTokensBuilder();
    allTokens.forEach((token) => {
      builder.push(
        token.line,
        token.startCharacter,
        token.length,
        this._encodeTokenType(token.tokenType),
        this._encodeTokenModifiers(token.tokenModifiers)
      );
    });
    return builder.build();
  }

  private _encodeTokenType(tokenType: string): number {
    if (tokenTypes.has(tokenType)) {
      return tokenTypes.get(tokenType)!;
    } else if (tokenType === "notInLegend") {
      return tokenTypes.size + 2;
    }
    return 0;
  }

  private _encodeTokenModifiers(strTokenModifiers: string[]): number {
    let result = 0;
    for (const tokenModifier of strTokenModifiers) {
      if (tokenModifiers.has(tokenModifier)) {
        result = result | (1 << tokenModifiers.get(tokenModifier)!);
      } else if (tokenModifier === "notInLegend") {
        result = result | (1 << (tokenModifiers.size + 2));
      }
    }
    return result;
  }
  private getVisibleCodeWithLineNumbers(
    textEditor: vscode.TextEditor | string
  ) {
    if (typeof textEditor !== `string`) {
      // get the position of the first and last visible lines
      let currentLine = textEditor.visibleRanges[0].start.line;
      const endLine = textEditor.visibleRanges[0].end.line;

      let code = "";

      // get the text from the line at the current position.
      // The line number is 0-based, so we add 1 to it to make it 1-based.
      while (currentLine < endLine) {
        code += `${currentLine + 1}: ${
          textEditor.document.lineAt(currentLine).text
        } \n`;
        // move to the next line position
        currentLine++;
      }
      return code;
    } else {
      let code = "";
      const lines = textEditor.split(/\r\n|\r|\n/);

      lines.forEach((line, lineNumber) => {
        code += `${lineNumber}: ${line}`;
      });

      return code;
    }
  }
  private async parseChatResponse(
    chatResponse: vscode.LanguageModelChatResponse,
    tokensFound: IParsedToken[]
  ) {
    let accumulatedResponse = "";

    for await (const fragment of chatResponse.text) {
      accumulatedResponse += fragment;

      // if the fragment is a }, we can try to parse the whole line
      if (fragment.includes("}")) {
        try {
          const annotation = JSON.parse(accumulatedResponse);
          tokensFound.push({
            ...annotation,
          });
          // reset the accumulator for the next line
          accumulatedResponse = "";
        } catch {
          // do nothing
        }
      }
    }
  }

  private async _parseText(text: string): Promise<IParsedToken[]> {
    const r: IParsedToken[] = [];
    const codeWithLineNumbers = this.getVisibleCodeWithLineNumbers(text);
    // select the chat model
    const [model] = await vscode.lm.selectChatModels();

    // init the chat message
    const messages = [
      vscode.LanguageModelChatMessage.User(SEMANTIC_TOKENS_PARSING_PROMPT),
      vscode.LanguageModelChatMessage.User(codeWithLineNumbers),
    ];

    // make sure the model is available
    if (model) {
      // send the messages array to the model and get the response
      const chatResponse = await model.sendRequest(
        messages,

        {},
        new vscode.CancellationTokenSource().token
      );

      // handle chat response
      await this.parseChatResponse(chatResponse, r);
    }

    return r;
  }
}
