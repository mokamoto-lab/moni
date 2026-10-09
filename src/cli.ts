import { loadConfig } from "./config.ts";
import { syncFolder } from "./sync.ts";
import { watchFolder } from "./watch.ts";

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.command === "sync") {
    const result = await syncFolder(config);
    console.log(
      `Done. created=${result.created.length} updated=${result.updated.length} skipped=${result.skipped.length}`,
    );
    return;
  }

  await watchFolder(config);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
