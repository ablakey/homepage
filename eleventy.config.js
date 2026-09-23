export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/style.css");
  eleventyConfig.addPassthroughCopy("src/favicon.ico");
  eleventyConfig.addPassthroughCopy("src/**/*.{jpg,png,gif}");
  eleventyConfig.addGlobalData("layout", "base.njk");
  return {
    dir: { input: "src", output: "_site", includes: "_includes" },
  };
}
