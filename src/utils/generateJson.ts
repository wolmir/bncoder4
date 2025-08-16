import * as vscode from "vscode";
import { Ollama } from "ollama";
import zodToJsonSchema from "zod-to-json-schema";

export async function generateJson<T>(
  prompt: string,
  schema: any,
  logger: vscode.LogOutputChannel
): Promise<T | null> {
  logger.info(`[JSON Generator] Start`);
  let accumulatedResponse = ``;
  let parsingError = false;
  let retryCount = 0;

  let prefix = `USER:
${prompt}

Respond using JSON with the following schema:
${"```"}
${JSON.stringify(zodToJsonSchema(schema), null, 2)}
${"```"}

ASSISTANT:
${"```"}json
{
    `;

  let suffix = `
}
${"```"}
`;

  do {
    parsingError = false;
    logger.info(`[JSON Generator] Attempt ${retryCount}`);
    try {
      let client = new Ollama();
      let response = await client.generate({
        model: `qwen2.5-coder:1.5b-instruct`,
        prompt: prefix,
        suffix,
        keep_alive: "30m",
        stream: true,
        options: {
          temperature: 0.2,
          stop: ["```"],
          num_predict: 100,
        },
      });
      logger.info(`[JSON Generator] Stream start`);

      for await (const chunk of response) {
        accumulatedResponse += chunk.response;
      }
      logger.info(`[JSON Generator] Stream end`);
    } catch (err) {
      logger.error(`[JSON Generator] Stream error ${err}`);
      return null;
    }

    accumulatedResponse = `{${accumulatedResponse}}`;
    logger.info(`[JSON Generator] Response text`, accumulatedResponse);

    try {
      logger.info(`[JSON Generator] Parsing start`);
      let result = JSON.parse(accumulatedResponse);
      logger.info(`[JSON Generator] Parsing success`);
      return result;
    } catch (err) {
      logger.info(`[JSON Generator] Parsing error`);
      parsingError = true;
      retryCount += 1;
      accumulatedResponse = ``;
    }
  } while (parsingError && retryCount < 5);

  logger.error(`[JSON Generator] Max retries exceeded`);
  return null;
}
