import { createJiti } from "jiti";
import { createOrmOptions } from "@hackkit/core";
const jiti = createJiti(import.meta.url);
const { default: config } = await jiti.import("../hackkit.config.ts");
export default { ...createOrmOptions(config), connect: false };
