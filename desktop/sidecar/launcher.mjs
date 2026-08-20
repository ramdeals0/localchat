import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(__dirname, "../../server/dist/index.js");

const port = process.env.PORT ?? "3001";
const host = process.env.HOST ?? "127.0.0.1";

process.chdir(path.resolve(__dirname, "../.."));

const child = spawn(process.execPath, [serverEntry], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: port,
    HOST: host,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
