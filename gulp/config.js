var dest = "./build";
var src = './src';

module.exports = {
  browserSync: {
    open: false,
    https: true,
    port: 2112,
    server: {
      // We're serving the src folder as well
      // for sass sourcemap linking
      baseDir: [dest, src]
    },
    files: [
      dest + "/**",
      // Exclude Map files
      "!" + dest + "/**.map"
    ]
  },
  stylus: {
    src: src + "/stylus/*.styl",
    dest: dest
  },
  sass: {
    src: src + "/sass/*.{sass, scss}",
    dest: dest
  },
  images: {
    src: src + "/img/**",
    dest: dest + "/img"
  },
  markup: {
    src: src + "/htdocs/**",
    dest: dest
  },
  ghdeploy : {
  },
  browserify: {
    // Enable source maps
    debug: false,
    // Additional file extentions to make optional
    extensions: ['.coffee'],
    // A separate bundle will be generated for each
    // bundle config in the list below
    bundleConfigs: [
      {
        entries: './src/javascript/app.js',
        dest: dest,
        outputName: 'app.js'
      },
      {
        entries: './src/javascript/site/index.js',
        dest: dest,
        outputName: 'site.js'
      }
    ]
  }
};
