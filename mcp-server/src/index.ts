#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { join } from "path";
import { homedir } from "os";
import { registerVideoWatch } from "./tools/video-watch.js";
import { registerVideoInfo } from "./tools/video-info.js";
import { registerVideoSetup } from "./tools/video-setup.js";
import { registerVideoConfigure } from "./tools/video-configure.js";
import { registerVideoAnalyze } from "./tools/video-analyze.js";
import { registerVideoDetail } from "./tools/video-detail.js";
import { loadConfig } from "./config.js";
import { cleanExpiredSessions } from "./session/manager.js";
import { cleanExpiredDownloads, getDownloadsDir } from "./utils/video-source.js";

// Errors outside a tool handler (unhandled rejection, transport-level throw)
// would otherwise kill the process with no diagnostic over stdio.
process.on("uncaughtException", (error) => {
  console.error("[claude-video-vision] uncaught exception:", error);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[claude-video-vision] unhandled rejection:", reason);
  process.exit(1);
});

const server = new McpServer({
  name: "claude-video-vision",
  version: "1.2.0",
});

registerVideoWatch(server);
registerVideoInfo(server);
registerVideoSetup(server);
registerVideoConfigure(server);
registerVideoAnalyze(server);
registerVideoDetail(server);

const CONFIG_PATH = join(homedir(), ".claude-video-vision", "config.json");
const config = loadConfig(CONFIG_PATH);
if (config.enable_index) {
  const sessionsDir = join(homedir(), ".claude-video-vision", "sessions");
  cleanExpiredSessions(sessionsDir, config.session_max_age_days);
}
cleanExpiredDownloads(getDownloadsDir(), config.downloads_max_age_days);

const transport = new StdioServerTransport();
await server.connect(transport);
