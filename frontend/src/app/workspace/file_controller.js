angular.module('app')

.directive('workspaceFile', function(WorkspaceService) {
  return {
    restrict: 'A',
    scope: {
      'file': '=workspaceFile',
    },
    templateUrl: 'app/workspace/file.tpl.html',
    controller: function($scope) {
      $scope.getTemplate = function() {
        if (/.mp4$/.test($scope.file.name))
          return 'app/workspace/file_video.tpl.html';
        else if (/.jpg$|.png$|.bmp$/.test($scope.file.name))
          return 'app/workspace/file_img.tpl.html';
        else
          return 'app/workspace/file_other.tpl.html';
      };
      $scope.getURL = function() {
        return WorkspaceService.getURL($scope.file.url);
      };
      $scope.getVideoType = function() {
        if (/.mp4$/.test($scope.file.url))
          return 'video/mp4';
        else if (/.avi/.test($scope.file.url))
          return 'video/x-msvideo';
        else
          return 'video';
      };
    },
    link: function($scope, element, attrs) {
    },
  };
})

;
