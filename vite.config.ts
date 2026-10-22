// Configures the local dev server and inserts the title from locale resources.
import { defineConfig } from "vite";
import app from "./src/locales/en-CA/app.json";

export default defineConfig({
  server: { port: 8000 },
  plugins: [
    {
      name: "localized-document-title",
      transformIndexHtml: {
        order: "pre",
        handler: (html) =>
          html.replace(
            "%APP_TITLE%",
            app.documentTitle
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;"),
          ),
      },
    },
  ],
});
