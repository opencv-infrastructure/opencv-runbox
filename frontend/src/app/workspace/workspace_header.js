angular.module('app')

.directive('workspaceHeader', function() {
  return {
    restrict: 'C',
    scope: true,
    templateUrl: 'app/workspace/workspace_header.tpl.html',
    controller: function($scope) {
      $scope.onClick = function(e, operation) {
        e.stopPropagation();
        $scope.doStorageOperation(operation.name);
      };
    },
    link: function($scope, element, attrs) {
    },
  };
})

;
