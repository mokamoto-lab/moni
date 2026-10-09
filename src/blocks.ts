export const RICH_TEXT_LIMIT = 2000;
export const BLOCKS_PER_REQUEST = 100;

export type ParagraphBlock = {
  object: "block";
  type: "paragraph";
  paragraph: {
    rich_text: Array<{ type: "text"; text: { content: string } }>;
  };
};

export function chunkText(text: string, limit = RICH_TEXT_LIMIT): string[] {
  if (text.length === 0) return [""];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += limit) {
    chunks.push(text.slice(i, i + limit));
  }
  return chunks;
}

function paragraphBlock(content: string): ParagraphBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: content
        ? [{ type: "text", text: { content } }]
        : [],
    },
  };
}

/** Turn file text into Notion paragraph blocks. Long lines are split at 2000 chars. */
export function textToBlocks(body: string): ParagraphBlock[] {
  const normalized = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const blocks: ParagraphBlock[] = [];
  for (const line of lines) {
    for (const chunk of chunkText(line)) {
      blocks.push(paragraphBlock(chunk));
    }
  }
  if (blocks.length === 0) {
    blocks.push(paragraphBlock(""));
  }
  return blocks;
}

export function batchBlocks<T>(blocks: T[], size = BLOCKS_PER_REQUEST): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < blocks.length; i += size) {
    batches.push(blocks.slice(i, i + size));
  }
  return batches;
}
