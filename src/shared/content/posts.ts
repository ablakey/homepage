export interface Post {
  slug: string;
  frontmatter: string;
  body: string;
}

// Eagerly import all markdown posts as raw strings. Available to both platforms.
const modules = import.meta.glob("../../content/posts/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** Loads all shared markdown posts. Frontmatter parsing/rendering is TODO. */
export function loadPosts(): Post[] {
  return Object.entries(modules).map(([path, raw]) => ({
    slug: path.split("/").pop()!.replace(/\.md$/, ""),
    frontmatter: "",
    body: raw,
  }));
}
