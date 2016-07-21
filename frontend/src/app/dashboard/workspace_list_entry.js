angular.module('app')

.directive('workspaceListEntry', function() {
  return {
    restrict: 'A',
    scope: {
      'e': '=workspaceListEntry',
      'doOperation': '&workspaceDoOperation',
    },
    templateUrl: 'app/dashboard/workspace_list_entry.tpl.html',
    controller: function($scope) {
      $scope.onClick = function(e, operation) {
        e.stopPropagation();
        $scope.doOperation({'operation': operation});
      };
    },
    link: function($scope, element, attrs) {
      $scope.withOperations = 'workspaceDoOperation' in attrs;
    },
  };
})

;
