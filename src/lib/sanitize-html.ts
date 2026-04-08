export const sanitizeHtml = (input: string) => {
  if (!input) return "";

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");

  const removeTags = ["script", "iframe", "object", "embed", "link", "meta", "style"];
  for (const tag of removeTags) {
    doc.querySelectorAll(tag).forEach((n) => n.remove());
  }

  doc.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        return;
      }

      if ((name === "href" || name === "src") && /^\s*javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
        return;
      }

      if (name === "srcdoc") {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML || "";
};

