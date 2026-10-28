import { config as loadEnv } from "dotenv";
import { createJiti } from "jiti";
loadEnv({ path: ".dev.vars", quiet: true });
const jiti = createJiti(import.meta.url);
const { assertDemoEnvironment } = await jiti.import("../env.ts");
assertDemoEnvironment();
const { seedDemo } = await jiti.import("./seed.ts");
await seedDemo();
console.log("Demo setup complete. Existing users were retained.");
