const modern = require('eleventy-plugin-modern');
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");

module.exports = eleventyConfig => {
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.addPlugin(modern());
  eleventyConfig.addLayoutAlias('post', 'layouts/post.njk');

  eleventyConfig.addFilter("withBlogName", function(value) {
    return `举个栗子 - ${value}`;
  });

  eleventyConfig.addFilter("formaterDate", function(value) {
    const d = new Date(value);
    console.log(d);
    let year = d.getFullYear(),
          month = '' + (d.getMonth() + 1),
          day = '' + d.getDate();
    if (month.length < 2) {
      month = '0' + month;
    }
    if (day.length < 2) {
      day = '0' + day;
    }
    return `${year}年${month}月${day}日`;
  });

  return {
    dir: {
      input: 'src',
      includes: '_includes',
      output: '_site'
    },
    templateFormats: ['md', 'njk', 'html'],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    dataTemplateEngine: 'njk'
  };
}
