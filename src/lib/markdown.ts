import { marked } from "marked";
import DOMPurify from "dompurify";
export function renderMarkdown(text: string) {
  return DOMPurify.sanitize(
    marked.parse(text, { async: false, breaks: true, gfm: true }),
    {
      FORBID_TAGS: [
        "img",
        "iframe",
        "style",
        "input",
        "form",
        "video",
        "audio",
      ],
      FORBID_ATTR: ["style"],
    },
  );
}
