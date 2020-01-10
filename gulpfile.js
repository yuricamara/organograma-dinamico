'use strict';

const gulp = require('gulp') ;
const del = require('del') ;
const runSequence = require('run-sequence') ;
const browserSync = require('browser-sync') ;
const gulpLoadPlugins = require('gulp-load-plugins') ;
const psi = require('psi') ;

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

gulp.task('lint', () =>
  gulp.src(['app/scripts/**/*.js','!node_modules/**'])
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failAfterError()))
);

gulp.task('images:dist', () =>
  gulp.src(['app/images/**/*', '!app/images/**/*.svg', '!app/images/**/*.html'])
    // FIXME (imagemin): "Error: O sistema n�o pode encontrar o caminho especificado"
    // .pipe($.cache($.imagemin()))
    .pipe(gulp.dest('dist/images'))
    .pipe($.size({title: 'images'}))
);

gulp.task('copy:dist', () => {
  gulp.src([
    'app/*.*',
    'app/*.js',
    '!app/index.html',
    '!app/.htaccess'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'))
    .pipe($.size({title: 'copy'}));

  gulp.src(['app/scripts/polyfills/*.js'] , { base: 'app/scripts' })
    .pipe(gulp.dest('dist/scripts'));
});

gulp.task('styles', () => {
  return gulp.src([
    'app/styles/**/*.scss',
    'app/styles/**/*.css'
  ])
    // SASS
    // *************************************
    .pipe($.newer('.tmp'))
    .pipe($.sourcemaps.init())
    .pipe($.sass({
      precision: 10
    }).on('error', $.sass.logError))
    .pipe(gulp.dest('.tmp'))

    // Concatenate and minify CSS
    // ***************************************
    // FIXME: remoção abusiva de CSS
    // .pipe($.if('*.css', $.purifycss(['./app/*.js','./app/scripts/**/*.js', './app/index.html'])))
    .pipe($.if('*.css', $.cssnano()))
    .pipe($.size({title: 'styles'}))
    .pipe($.sourcemaps.write('./'))
    .pipe(gulp.dest('.tmp'));
});

gulp.task('scripts', () =>
    gulp.src([
      // Note: Since we are not using useref in the scripts build pipeline,
      //       you need to explicitly list your scripts here in the right order
      //       to be correctly concatenated
      './app/scripts/*.js'
      // Other scripts
    ])
      .pipe($.newer('.tmp/scripts'))
      .pipe($.sourcemaps.init())
      .pipe($.sourcemaps.write())
      .pipe(gulp.dest('.tmp/scripts'))
      .pipe($.concat('main.min.js'))
      .pipe($.uglifyEs.default())
      // Output files
      .pipe($.size({title: 'scripts'}))
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('.tmp/scripts'))
);

gulp.task('svg', ()=>{
  return gulp.src('app/images/figures-svg/*.svg')
    .pipe($.svgSprite({
      mode: {
        stack: {
          dest: '.',
          sprite: 'figures-svg.svg',
          example: true
        }
      },
      svg: {
        xmlDeclaration: false,
        doctypeDeclaration: false,
        namespaceClassnames: false
      }
    }))
    .pipe(gulp.dest('.tmp'))
});

gulp.task('rev', () =>
  gulp.src([".tmp/main.css", ".tmp/scripts/main.min.js", ".tmp/figures-svg.svg"])
    .pipe($.rev())
    .pipe(gulp.dest('dist'))
    .pipe($.rev.manifest())
    .pipe(gulp.dest('dist'))
);

gulp.task('html:dist', ['rev'], () => {
  const manifest = gulp.src("./dist/rev-manifest.json");

  return gulp.src('app/index.html')
    .pipe($.useref({
      searchPath: '{.tmp,app}',
      noAssets: true
    }))
    // Minify any HTML
    .pipe($.if('*.html', $.htmlmin({
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      removeOptionalTags: true
    })))
    // Output files
    .pipe($.if('*.html', $.size({title: 'html', showFiles: true})))
    .pipe($.revReplace({manifest: manifest}))
    // Substitui href após minificação e revReplace
    .pipe($.stringReplace(
      new RegExp('(href|src)=\/[^\/\s]+','gi'),
      hrefMatched => {
        return hrefMatched.replace(/=/, '=/dist');
      }
    ))
    .pipe(gulp.dest("./"));
});

gulp.task('clean', () => del(['.tmp', 'dist/*', '!dist/.git'], {dot: true}));

gulp.task('serve', ['scripts', 'styles', 'svg'], () => {
  browserSync({
    notify: false,
    // Customize the Browsersync console logging prefix
    logPrefix: 'WSK',
    // Allow scroll syncing across breakpoints
    scrollElementMapping: ['main', '.mdl-layout'],
    https: true,
    server: ['.tmp', 'app'],
    online: true,
    // tunnel: 'yuricamara',
    port: 3000
  });

  gulp.watch(['app/**/*.html'], reload);
  gulp.watch(['app/styles/**/*.{scss,css}'], ['styles', reload]);
  gulp.watch(['app/scripts/**/*.js'], ['scripts', reload]);
  gulp.watch(['app/images/**/*'], reload);
});

gulp.task('serve:dist', ['dist'], () =>
  browserSync({
    notify: false,
    logPrefix: 'WSK',
    // Allow scroll syncing across breakpoints
    scrollElementMapping: ['main', '.mdl-layout'],
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: './',
    port: 3001
  })
);

gulp.task('dist', ['clean'], cb =>
  runSequence(
    'styles',
    ['scripts', 'images:dist', 'copy:dist', 'svg'],
    'html:dist',
    cb
  )
);

gulp.task('pagespeed', cb =>
  psi('yuricamara.com.br', {
    strategy: 'mobile'
  }, cb)
);
