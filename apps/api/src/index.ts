import { buildServer } from "./server.js";
import { loadAppConfig } from "./config.js";

const config = loadAppConfig();
const app = await buildServer(config);

await app.listen({ host: config.host, port: config.port });
