export default {
  async fetch(request) {
    const acceptHeader = request.headers.get("Accept") || "";

    // If the client doesn't ask for markdown, pass through normally
    if (!acceptHeader.includes("text/markdown")) {
      return fetch(request);
    }

    // Clone the request but remove the Accept: text/markdown header
    // so the origin returns HTML (not a 406 or error)
    const originRequest = new Request(request, {
      headers: new Headers(request.headers),
    });
    originRequest.headers.set("Accept", "text/html");

    const response = await fetch(originRequest);

    // Only convert successful HTML responses
    const contentType = response.headers.get("Content-Type") || "";
    if (!response.ok || !contentType.includes("text/html")) {
      return response;
    }

    const html = await response.text();
    const markdown = htmlToMarkdown(html);

    // Create a new response with the markdown, keeping original headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Content-Type", "text/markdown; charset=utf-8");
    
    // Ensure Vary: Accept is present for CDNs to cache HTML and Markdown separately
    const vary = newHeaders.get("Vary") || "";
    if (!vary.includes("Accept")) {
      newHeaders.set("Vary", vary ? `${vary}, Accept` : "Accept");
    }
    
    // Remove headers that are no longer valid for the modified body
    newHeaders.delete("Content-Length");
    newHeaders.delete("ETag");

    return new Response(markdown, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};

/**
 * Convert HTML to Markdown.
 * Handles: titles, headings, links, lists, bold, italic, code,
 * paragraphs, images, and strips the rest.
 */
function htmlToMarkdown(html) {
  let text = html;

  // Extract <title>
  let title = "";
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Remove scripts, styles, noscript, comments, head
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  text = text.replace(/<head[\s\S]*?<\/head>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Headings (h1-h6)
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `\n# ${clean(c)}\n`);
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `\n## ${clean(c)}\n`);
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `\n### ${clean(c)}\n`);
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => `\n#### ${clean(c)}\n`);
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, c) => `\n##### ${clean(c)}\n`);
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, c) => `\n###### ${clean(c)}\n`);

  // Bold and italic
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, c) => `**${clean(c)}**`);
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, c) => `*${clean(c)}*`);

  // Inline code
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${clean(c)}\``);

  // Code blocks
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => {
    const code = c.replace(/<[^>]+>/g, "").trim();
    return `\n\`\`\`\n${code}\n\`\`\`\n`;
  });

  // Links — extract href and text
  text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, c) => {
    const linkText = clean(c).trim();
    if (!linkText) return "";
    return `[${linkText}](${href})`;
  });

  // Images
  text = text.replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, (_, src, alt) => `![${alt}](${src})`);
  text = text.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*\/?>/gi, (_, alt, src) => `![${alt}](${src})`);
  text = text.replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/gi, (_, src) => `![](${src})`);

  // Lists — ordered (Must process BEFORE unordered to avoid overlapping matches)
  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    let i = 1;
    let replaced = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `${i++}. ${clean(c).trim()}\n`);
    return `\n${replaced}\n`;
  });

  // Lists — unordered
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    let replaced = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `- ${clean(c).trim()}\n`);
    return `\n${replaced}\n`;
  });

  // Catch any rogue <li> not wrapped in ul/ol
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `- ${clean(c).trim()}\n`);

  // Blockquotes
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => {
    return clean(c).trim().split("\n").map((line) => `> ${line}`).join("\n") + "\n";
  });

  // Horizontal rules
  text = text.replace(/<hr[^>]*\/?>/gi, "\n---\n");

  // Paragraphs and line breaks
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `\n${clean(c).trim()}\n`);
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&copy;/g, "©")
    .replace(/&trade;/g, "™");

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  // Add title as H1 if present and not already in content
  if (title && !text.startsWith(`# ${title}`)) {
    text = `# ${title}\n\n${text}`;
  }

  return text;
}

function clean(str) {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
