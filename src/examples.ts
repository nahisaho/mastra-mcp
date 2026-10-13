export interface Example {
  lang: string;
  heading: string;
  code: string;
}

const LANGS = new Set(["ts", "tsx", "typescript", "js", "jsx", "javascript", "mjs", "bash", "sh", "json", "yaml", "yml", "md", "markdown", "text"]);

// Extracts fenced code blocks, tagging each with the nearest preceding heading (or the block's title attribute).
export function extractExamples(body: string, pageTitle: string): Example[] {
  const out: Example[] = [];
  let heading = pageTitle;
  let open: { fence: string; indent: number; lang: string; title: string; lines: string[] } | null = null;
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*(`{3,}|~{3,})\s*([\w-]*)(.*)$/);
    if (open) {
      if (m && m[1][0] === open.fence[0] && m[1].length >= open.fence.length && !m[2] && !m[3].trim()) {
        const code = open.lines.join("\n").trim();
        const lang = open.lang.toLowerCase();
        if (code.length >= 30 && LANGS.has(lang)) {
          out.push({ lang: lang === "typescript" ? "ts" : lang, heading: open.title || heading, code });
        }
        open = null;
      } else open.lines.push(line.replace(new RegExp(`^ {0,${open.indent}}`), ""));
      continue;
    }
    if (m) {
      const title = m[3].match(/(?:title|filename)=["']([^"']+)["']/)?.[1] ?? "";
      open = { fence: m[1], indent: line.length - line.trimStart().length, lang: m[2], title: title ? `${heading} (${title})` : "", lines: [] };
      continue;
    }
    const h = line.match(/^#{1,4}\s+(.+)$/);
    if (h) heading = h[1].replace(/[`*]/g, "").trim();
  }
  return out;
}
