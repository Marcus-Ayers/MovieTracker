import "server-only";
import sanitizeHtml from "sanitize-html";

/** Reviews are stored as HTML; only allow the formatting the editor can produce. */
export function cleanReview(html: string | null | undefined) {
  if (!html) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "s", "u", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "code", "pre", "hr"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      // Letterboxd reviews use <i>/<b>.
      i: "em",
      b: "strong",
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
    },
  });
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).trim();
  return text ? clean : null;
}

/** Plain-text review (blank lines between paragraphs) → editor HTML. */
export function reviewTextToHtml(text: string | null | undefined) {
  if (!text?.trim()) return null;
  const html = text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return cleanReview(html);
}
