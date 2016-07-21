var config = {
  env: process.env.ENV || 'production',
  coffee : 'src/**/*.coffee',
  jade : 'src/**/*.jade',
  less : 'src/style/*.less',
  graphics : ['src/**/*.ico'],
  src : 'src/**/*',
  build : 'build/**/*',
  html : 'build/**/*.html',
  app_js : 'build/app/**/*.js',
  app_less : 'src/style/app.less',
  app_css : 'build/app.css',
  vendor_js : 'build/vendor/**/*.js',
  vendor_css : 'build/vendor/**/*.css',
  vendor_src : 'vendor/**/*',
  vendor: {
    dest: 'build/vendor/',
    js: {
      name: 'vendor.js'
    },
    css: {
      name: 'vendor.css'
    }
  }
};

config.karma = [
  'build/vendor/angular/angular.js',
  'build/vendor/angular-mocks/angular-mocks.js',
  'vendor/angular-ui-router/release/angular-ui-router.js',
  config.app_js
];

config.app = [
  'vendor/angular/angular.js',
  'vendor/angular-ui-router/release/angular-ui-router.js',
  config.app_js,
  "!build/app/**/*_spec.js", config.app_css
];

config.dev = config.env !== 'production';
config.production = config.env === 'production';

module.exports = config;
