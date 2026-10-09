import { Client } from "@notionhq/client";
import { batchBlocks, textToBlocks, type ParagraphBlock } from "./blocks.ts";

export const SOURCE_FILENAME_ALIASES = [
  "source filename",
  "source file",
  "filename",
  "file name",
  "source",
];

export const LAST_MODIFIED_ALIASES = [
  "last modified",
  "modified",
  "modified at",
  "file modified",
  "synced at",
];

export type PropertyType = string;

export type DatabaseSchema = {
  dataSourceId: string;
  titleProperty: string;
  sourceFilenameProperty: string | null;
  lastModifiedProperty: string | null;
  properties: Record<string, PropertyType>;
};

export type PageContent = {
  title: string;
  filename: string;
  mtimeMs: number;
  body: string;
};

export type NotionStore = {
  loadSchema(): Promise<DatabaseSchema>;
  findPageId(schema: DatabaseSchema, file: { filename: string; title: string }): Promise<string | null>;
  createPage(schema: DatabaseSchema, content: PageContent): Promise<string>;
  updatePage(schema: DatabaseSchema, pageId: string, content: PageContent): Promise<void>;
};

type NotionProperty = { type?: string; name?: string };

function findProperty(
  properties: Record<string, PropertyType>,
  aliases: string[],
  expectedTypes: string[],
): string | null {
  const entries = Object.entries(properties);
  for (const alias of aliases) {
    const match = entries.find(
      ([name, type]) => name.toLowerCase() === alias && expectedTypes.includes(type),
    );
    if (match) return match[0];
  }
  return null;
}

export function mapSchema(
  properties: Record<string, NotionProperty | string>,
  dataSourceId: string,
): DatabaseSchema {
  const types: Record<string, PropertyType> = {};
  let titleProperty: string | null = null;

  for (const [name, value] of Object.entries(properties)) {
    const type = typeof value === "string" ? value : value.type ?? "";
    types[name] = type;
    if (type === "title") titleProperty = name;
  }

  if (!titleProperty) {
    throw new Error("Notion data source has no Title property.");
  }

  return {
    dataSourceId,
    titleProperty,
    sourceFilenameProperty: findProperty(types, SOURCE_FILENAME_ALIASES, ["rich_text"]),
    lastModifiedProperty: findProperty(types, LAST_MODIFIED_ALIASES, ["date"]),
    properties: types,
  };
}

export function buildPageProperties(
  schema: DatabaseSchema,
  content: PageContent,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    [schema.titleProperty]: {
      title: [{ text: { content: content.title.slice(0, 2000) } }],
    },
  };

  if (schema.sourceFilenameProperty) {
    properties[schema.sourceFilenameProperty] = {
      rich_text: [{ text: { content: content.filename.slice(0, 2000) } }],
    };
  }

  if (schema.lastModifiedProperty) {
    properties[schema.lastModifiedProperty] = {
      date: { start: new Date(content.mtimeMs).toISOString() },
    };
  }

  return properties;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function createNotionStore(
  token: string,
  databaseId: string,
  opts: { baseUrl?: string } = {},
): NotionStore {
  const notion = new Client({
    auth: token,
    notionVersion: "2026-03-11",
    baseUrl: opts.baseUrl,
  });

  async function appendBlocks(pageId: string, blocks: ParagraphBlock[]): Promise<void> {
    for (const batch of batchBlocks(blocks)) {
      if (batch.length === 0) continue;
      await notion.blocks.children.append({
        block_id: pageId,
        children: batch as never,
      });
    }
  }

  return {
    async loadSchema() {
      const database = await notion.databases.retrieve({ database_id: databaseId });
      const dataSources = (asRecord(database).data_sources as Array<{ id?: string }> | undefined) ?? [];
      const dataSourceId = dataSources[0]?.id;
      if (!dataSourceId) {
        throw new Error("Could not find a data source for NOTION_DATABASE_ID. Share the database with the integration.");
      }

      const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
      const properties = asRecord(asRecord(dataSource).properties) as Record<string, NotionProperty>;
      return mapSchema(properties, dataSourceId);
    },

    async findPageId(schema, file) {
      const filter = schema.sourceFilenameProperty
        ? {
            property: schema.sourceFilenameProperty,
            rich_text: { equals: file.filename },
          }
        : {
            property: schema.titleProperty,
            title: { equals: file.title },
          };

      const response = await notion.dataSources.query({
        data_source_id: schema.dataSourceId,
        filter,
        page_size: 1,
      });
      const first = response.results[0];
      return first && "id" in first ? first.id : null;
    },

    async createPage(schema, content) {
      const blocks = textToBlocks(content.body);
      const [first, ...rest] = batchBlocks(blocks);
      const page = await notion.pages.create({
        parent: { data_source_id: schema.dataSourceId },
        properties: buildPageProperties(schema, content) as never,
        children: (first ?? []) as never,
      });
      for (const batch of rest) {
        await appendBlocks(page.id, batch);
      }
      return page.id;
    },

    async updatePage(schema, pageId, content) {
      await notion.pages.update({
        page_id: pageId,
        properties: buildPageProperties(schema, content) as never,
        erase_content: true,
      } as never);
      await appendBlocks(pageId, textToBlocks(content.body));
    },
  };
}
