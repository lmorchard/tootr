var deploy = require('gulp-gh-pages');

var options = {
};

gulp.task('gh-deploy', function () {
  return gulp.src('./build/**/*')
    .pipe(deploy(options));
});
