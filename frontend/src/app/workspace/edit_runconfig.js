angular.module('app')

.directive('editRunconfig', function(RunconfigService) {
  return {
    require: '^editablePopup',
    restrict: 'AEC',
    scope: true,
    templateUrl: 'app/workspace/edit_runconfig.tpl.html',
    link: function($scope, element, attrs, popupController) {
      element.find("select,.btn-success").attr('disabled', 'disabled');
      RunconfigService.queryAll()
      .then(function(runconfigurations) {
        $scope.configurations = runconfigurations.configurations;
        var storage = popupController.getParentScope().storage;
        $scope.value = runconfigurations.find(storage);
        element.find("select,.btn-success").attr('disabled', false);
        element.find("select").focus();
      }, function() {
        alert.error("FATAL: Can't load run configurations");
      });
      $scope.apply = function() {
        popupController.apply({runner: $scope.value.runner, target: $scope.value.target});
      };
      $scope.cancel = function() {
        popupController.cancel();
      };
    },
  };
})

;
