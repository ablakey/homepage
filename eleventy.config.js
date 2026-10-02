import EleventyVitePlugin from "@11ty/eleventy-plugin-vite";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyVitePlugin);
  eleventyConfig.addPassthroughCopy("src/style.css");
  eleventyConfig.addPassthroughCopy("src/scripts");
  eleventyConfig.addPassthroughCopy("src/**/*.{jpg,png,gif,svg}");
  eleventyConfig.addGlobalData("layout", "base.njk");
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/posts/**/index.md").reverse(),
  );
  eleventyConfig.addFilter("isoDate", (date) =>
    date.toISOString().slice(0, 10),
  );
  return {
    dir: { input: "src" },
    markdownTemplateEngine: "njk",
  };
}
