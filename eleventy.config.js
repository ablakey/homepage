export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/style.css");
  eleventyConfig.addPassthroughCopy("src/favicon.ico");
  eleventyConfig.addPassthroughCopy("src/**/*.{jpg,png,gif}");
  eleventyConfig.addGlobalData("layout", "base.njk");
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/posts/**/index.md").reverse(),
  );
  eleventyConfig.addFilter("isoDate", (date) =>
    date.toISOString().slice(0, 10),
  );
  return {
    dir: { input: "src", output: "_site", includes: "_includes" },
    markdownTemplateEngine: "njk",
  };
}
