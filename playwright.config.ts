import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npx tsx tests/support/server.ts",
      url: "http://127.0.0.1:54321/health",
      reuseExistingServer: true,
    },
    {
      command:
        "VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=local-test-key npm run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
  ],
});
