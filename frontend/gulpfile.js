// TODO
// https://github.com/gulpjs/gulp/blob/master/docs/recipes/pass-arguments-from-cli.md

var
  _ = require('underscore'),
  gulp = require('gulp'),
  gutil = require('gulp-util'),
  runSequence = require('run-sequence'),
  del = require('del'),
  debug = require('gulp-debug'),
  merge = require('merge-stream'),
  series = require('stream-series'),
  gulpif = require('gulp-if'),
  gulpFilter = require('gulp-filter'),
  sort = require('sort-stream'),
  bower = require('main-bower-files'),
  concat = require('gulp-concat'),
  connect = require('gulp-connect'),
//  jade = require('gulp-jade'),
  less = require('gulp-less'),
  sourcemaps = require('./utils/gulp-sourcemaps'),
//  coffee = require('gulp-coffee'),
  inject = require('gulp-inject'),
  karma = require('gulp-karma'),
  changed = require('gulp-changed'),
  watch = require('gulp-watch'),
  plumber = require('gulp-plumber'),
  replace = require('gulp-replace'),

  path = require('path'),
//  through = require('through2');
//  fs = require('fs');
//  File = require('vinyl'),
  debug = require('gulp-debug')

  config = require('./config.js');

  index_path = 'build/index.html';

src_dir = 'src/';

build_dir = 'build/';

function handleError(err) {
  console.log(err.toString());
  this.emit('end');
}

gulp.task('connect', ['build'], function() {
  connect.server({
    port: 9002,
    root : [
      'build'
    ],
    livereload : true
  });
});

gulp.task('clean:build', function (cb) {
  del([
    'build/**/*',
    '!build/data',
    '!build/data/**',
    '!build/layout',
    '!build/layout/**',
  ], function (err, deletedFiles) {
    //console.log('Files deleted:', deletedFiles.join(', '));
    cb(err, deletedFiles);
  });
});

//  gulp.task('move:jade', function() {
//    return gulp.src(config.jade).pipe(plumber()).pipe(jade({
//      pretty: true
//    })).pipe(inject(gulp.src(config.app, {
//      read: false
//    }), {
//      ignorePath: ['build'],
//      addRootSlash: false
//    })).pipe(gulp.dest(build_dir));
//  });

gulp.task('move:graphics', function() {
  return gulp.src(config.graphics)
    .pipe(gulp.dest(build_dir));
});

gulp.task('move:less', function() {
  return gulp.src(config.less)
    .pipe(plumber({ errorHandler: handleError }))
    .pipe(sourcemaps.init({debug:true}))
    .pipe(less({
      paths: [ path.join(__dirname) ]
    }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(build_dir));
});

gulp.task('move:html', ['move:js', 'move:less', 'move:vendor', 'move:codemirror', 'move:graphics'], function() {
  var tasks = []
  var vendorFiles = gulp.src([config.vendor.dest + "/**/*.js", config.vendor.dest + "/**/*.css"], { read : false });
  if (true/*config.dev*/) {
    var files = [];
    bower({ env: config.env }).map(function (e, i) {
      //console.log(e);
      files.push(gulp.src(e));
    });
    vendorFiles = series(files);
  }
  var appFiles = gulp.src([
    'build/app/app.js',
    'build/**/*.js', 'build/**/*.css',
    '!build/layout/**/*.js',
    '!build/vendor/**/*.js', '!build/vendor/**/*.css'
  ], { read : false });

  if (true/*config.dev*/) {
    tasks.push(
        gulp.src(['src/**/*.tpl.html'])
          .pipe(plumber())
          .pipe(gulp.dest(build_dir)));
  }

  tasks.push(
      gulp.src(['src/**/*.html', '!src/**/*.tpl.html'])
        .pipe(plumber())
        .pipe(inject(series(vendorFiles, appFiles).pipe(debug()), { ignorePath : ['build'], addRootSlash : false }))
        .pipe(gulp.dest(build_dir)));
  return merge(tasks);
});

//gulp.task('move:coffee', function() {
//  return gulp.src(config.coffee).pipe(plumber()).pipe(coffee({
//    bare : true
//  })).pipe(gulp.dest(build_dir));
//});

gulp.task('move:js', function() {
  return gulp.src(['src/**/*.js', '!src/**/*_spec.js'])
    .pipe(plumber({ errorHandler: handleError }))
    .pipe(gulp.dest(build_dir));
});

gulp.task('move:vendor', function() {
  var jsFilter = gulpFilter('**/*.js');
  var cssFilter = gulpFilter('**/*.css');

  var stream = gulp.src(bower({ env: config.env }))
    .pipe(plumber({ errorHandler: handleError }))
    .pipe(sourcemaps.init({loadMaps: true,debug:true}))
    .pipe(jsFilter)
//  ;
//  if (config.production) {
//    stream = stream
//      .pipe(concat(config.vendor.js.name));
//  }
//  stream = stream
//    .pipe(replace(/\/\/\# sourceMappingURL=(.*?)map/g, ''))
    .pipe(jsFilter.restore())

    .pipe(cssFilter)
//  ;
//  if (config.production) {
//    stream = stream
//      .pipe(concat(config.vendor.css.name));
//  }
//  stream = stream
//    .pipe(replace(/\/\/\# sourceMappingURL=(.*?)map/g, ''))
    .pipe(cssFilter.restore())

    .pipe(sourcemaps.write({copyOnly:true}))
    .pipe(gulp.dest(function(f) {
      var dir = config.vendor.dest;
      if (true/*config.dev*/) {
        dir = path.join(config.vendor.dest, path.relative(path.join(f.cwd, 'vendor'), f.base));
      }
      //console.log(dir);
      return dir;
    }))
  return stream;
});

gulp.task('move:codemirror', function() {
  return gulp.src([
      'vendor/codemirror/addon/**/*.js',
      'vendor/codemirror/mode/**/*.js',
      'vendor/codemirror/theme/**/*.js',
    ])
    .pipe(plumber({ errorHandler: handleError }))
    .pipe(gulp.dest(build_dir + 'vendor/codemirror/mode'));
});


gulp.task('run:karma', function() {
  return gulp.src(config.karma).pipe(karma({
    configFile : 'karma.conf.js',
    action : 'watch'
  })).on('error', function(err) {
    throw err;
  });
});

gulp.task('watch', ['build', 'connect'], function() {
  //gulp.watch(config.src, [ 'move' ]);
  //gulp.watch(config.jade, [ 'move:jade'  ]);
  //gulp.watch(config.less, [ 'move:less'  ]);
  //gulp.watch(config.coffee, [ 'move:coffee' ]);
  //gulp.watch(config.vendor, [ 'move:vendor' ]);
  //return gulp.watch(config.karma, [ 'run:karma' ]);
  return gulp.watch([config.src, config.vendor_src], [ 'build' ]);
});

gulp.task('build', function(cb) {
  console.log("Build started");
  runSequence(
      'clean:build',
      'build:all',
      cb);
});

gulp.task('build:all', ['move:html'], function() {
  // nothing
});

gulp.task('default', [ 'build', 'connect', 'watch' ]);
