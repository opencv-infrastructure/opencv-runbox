window.ondragstart = function() { return false; };

if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.lastIndexOf(searchString, position) === position;
  };
}

CodeMirror.modeURL = "vendor/codemirror/mode/%N/%N.js";

/* App Module */

var app = angular.module('app', [
  'ui.router',
  'ui.bootstrap',
  'ui.layout',
  'ui.codemirror',
  'alert',
  'angularMoment',
  'ngFileUpload',
])

.config(function($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.otherwise("/");
})

;
