import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const hashes = new Set();
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = dir + "/" + entry.name;
    if (entry.isDirectory()) await scan(path);
    else if (path.endsWith(".html")) {
      const html = await readFile(path, "utf8");
      for (const match of html.matchAll(
        /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
      ))
        if (match[1])
          hashes.add(
            "'sha256-" +
              createHash("sha256").update(match[1]).digest("base64") +
              "'",
          );
    }
  }
}
await scan("out");
const headers = await readFile("public/_headers", "utf8");
await writeFile(
  "out/_headers",
  headers.replace(
    "script-src 'self'",
    "script-src 'self' " + [...hashes].join(" "),
  ),
);
console.log("Static Next.js CSP hashes:", hashes.size);
