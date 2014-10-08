var gulp  = require('gulp');
var config = require('../config');
var deploy = require('gulp-gh-pages');

gulp.task('gh-deploy', function () {
  return gulp.src('./build/**/*')
    .pipe(deploy(config.ghdeploy));
});
