angular.module('app')

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider
  .state('dashboard', {
    url: '/',
    templateUrl: 'app/dashboard/dashboard-page.tpl.html',
    controller: 'DashboardController',
  })
  ;
})

.controller('DashboardController', function($scope, $rootScope, $state, $q, $location, WorkspaceService, naturalSort) {
  console.log('DashboardController for scope: ' + $scope.$id);

  var lastLoadTimestamp;
  function load(timestamp) {
    if (lastLoadTimestamp !== undefined && timestamp !== undefined &&
        timestamp - lastLoadTimestamp < 0)
      return;

    var target = {
        templates: undefined,
        workspaces: undefined,
    };

    var templatesResult = WorkspaceService.queryAll('templates')
    .then(function(response) {
      target.templates = response.data.entries;
      target.templates.sort(function(a, b) {
        var r = naturalSort(a.name, b.name);
        if (r !== 0)
          return r;
        return naturalSort(a.id, b.id);
      });
    }, function () {
      alert.error("Can't load templates");
      return $q.reject();
    });

    var workspacesResult = WorkspaceService.queryAll('workspaces')
    .then(function(response) {
      target.workspaces = response.data.entries;
      target.workspaces.sort(function(a, b) {
        var _a = a.timestamp || 0,
            _b = b.timestamp || 0;
        return _b - _a;
      });
    }, function () {
      alert.error("Can't load workspaces");
      return $q.reject();
    });


    $q.all([templatesResult, workspacesResult]).then(function() {
      target.templates = _.filter(target.templates, function(t) {
        if (!t.readonly)
          return true;
        var existed = _.find(target.workspaces, function(w) {
          return !w.readonly && w.name == t.name;
        });
        return !existed;
      });
      _.extend($scope, target);
      alert.success("Data is updated");
      if ($state.includes('dashboard'))
        $rootScope.title = 'Dashboard';
      lastLoadTimestamp = Date.now();
    }, function() {
      if ($state.includes('dashboard'))
        $rootScope.title = 'Error';
    });
  } // load

  load();

  $scope.$on('workspaces-changed', function(events, args) {
    load(args.timestamp);
  });

  $scope.select = function(workspace) {
    if (workspace.readonly) {
      var existed = _.find($scope.workspaces, function(w) {
        return !w.readonly && w.name == workspace.name;
      });
      if (existed)
        return $location.path(existed.url);
      return WorkspaceService.fork(workspace.url);
    }
    $location.path(workspace.url);
  };

  $scope.onClick = function(e, workspace) {
    e.stopPropagation();
    $scope.select(workspace);
  };

  $scope.doOperation = function(workspace, operation) {
    if (operation === undefined)
      return $scope.select(workspace);
    if (WorkspaceService[operation.name])
      WorkspaceService[operation.name](workspace.url);
    else {
      alert.error('Unsupported operation: ' + operation.name);
    }
  };

  $scope.isActive = function(workspace) {
    return $rootScope.workspaceURL == workspace.url;
  };
})

.directive('dashboardView', function() {
  return {
    restrict: 'C',
    scope: true,
    templateUrl: 'app/dashboard/dashboard-view.tpl.html',
    controller: 'DashboardController',
    link: function($scope, element, attrs) {
    },
  };
})

;
