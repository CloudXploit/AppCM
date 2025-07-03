import type { Config } from "tailwindcss";
import sharedConfig from "@cm-diagnostics/tailwind-config";

const config: Config = {
  presets: [sharedConfig],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;