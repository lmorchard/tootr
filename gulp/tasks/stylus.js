var gulp = require('gulp');
var stylus = require('gulp-stylus');
var nib = require('nib');

var handleErrors = require('../util/handleErrors');
var config = require('../config').stylus;

gulp.task('stylus', function () {
  return gulp.src(config.src)
    .pipe(stylus({
      use: nib(),
      compress: false
    }))
    .on('error', handleErrors)
    .pipe(gulp.dest(config.dest));
});
