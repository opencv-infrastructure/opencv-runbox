angular.module('app')

.config(function($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.when('/{workspace_class}/{workspace_id}', '/{workspace_class}/{workspace_id}/storage/current');
  $stateProvider
  .state('workspace', {
    url: "/{workspace_class}/{workspace_id}",
    templateUrl: 'app/workspace/workspace.tpl.html',
    controller: 'WorkspaceController',
    resolve: {
      RunConfigurations: function(RunconfigService) {
        return RunconfigService.queryAll();
      },
    },
    onEnter: function($stateParams, $rootScope) {
      console.log("Open workspace");
      $rootScope.title = 'Loading';
      $rootScope.workspaceURL = $stateParams.workspace_class + '/' + $stateParams.workspace_id;
    },
    onExit: function($rootScope) {
      console.log("Close workspace");
      delete $rootScope.workspaceURL;
    }
  })
  .state('workspace.storage', {
    url: "/storage/{storage_id}",
    onEnter: function($stateParams, $rootScope) {
      console.log("Open workspace storage: " + $stateParams.storage_id);
      $rootScope.currentStorage = $stateParams.storage_id;
    },
    onExit: function($stateParams, $rootScope) {
      console.log("Close workspace storage: " + $stateParams.storage_id);
      if ($rootScope.$broadcast('workspace-storage-close').defaultPrevented)
        throw "Cancelled by user";
      delete $rootScope.currentStorage;
    }
  })
  ;
})

.controller('WorkspaceController', function($scope, $rootScope, $state, $q, $timeout, $location, WorkspaceService, WorkspaceStorage, RunconfigService, SimpleStorage) {
  console.log('WorkspaceController scope: ' + $scope.$id);

  $scope.$on('$destroy', function() {
    console.log('Destroy WorkspaceController scope: ' + $scope.$id);
  });

  $scope.editor = {};

  function loadWorkspace() {
    var target = {
        workspace: undefined,
    };

    var workspaceResult = WorkspaceService.query($rootScope.workspaceURL)
    .then(function(response) {
      target.workspace = WorkspaceStorage.create(response.data);
    }, function () {
      alert.error("Can't load workspace");
      return $q.reject();
    })
    .then(function() {
      return loadStorage(target);
    })
    .then(function() {
      _.extend($scope, target);
      delete $scope.notfound;
      alert.success("Data is updated");
      $rootScope.title = $scope.storage.readonly ? 'View' : 'Edit';

      if ($scope.editor.controller) {
        $scope.editor.controller.update($scope.storage);
      }

      if (_.includes(['queue','submit','run'], $scope.storage.job)) {
        $timeout(function() {
          loadWorkspace();
        }, 3000);
      }
    }, function() {
      $scope.notfound = true;
      if ($scope.editor.controller)
        $scope.editor.controller.update(undefined);
      $rootScope.title = 'Error';
    });
  } // loadWorkspace

  function loadStorage(target) {
    target = target || $scope;

    target.currentStorage = $rootScope.currentStorage;
    if (target.currentStorage !== undefined) {
      if (target.workspace.storage[target.currentStorage] === undefined) {
        target.currentStorage = undefined;
      }
    }
    target.currentStorage = target.currentStorage === undefined ? 'current' : target.currentStorage;
    var url = target.workspace.storage[target.currentStorage].url;
    var storageResult = WorkspaceService.query(url)
    .then(function(response) {
      target.storage = response.data;
      if (target.currentStorage != $rootScope.currentStorage)
        $state.go('workspace.storage', {storage_id: target.currentStorage});
    }, function () {
      alert.error("Can't load storage");
      return $q.reject();
    });
    return storageResult;
  } // loadStorage


  $scope.$watchGroup([function() {
    return $rootScope.workspaceURL;
  }, function() {
    return $rootScope.currentStorage;
  }], loadWorkspace);

  function saveChanges() {
    if ($scope.codeDirty !== true)
      return $q.when();
    var update = grabEditorChanges();
    return WorkspaceService.update($scope.storage.url, update)
    .then(function() {
      $scope.codeDirty = undefined;
    });
  };

  $scope.doStorageOperation = function(operationName) {
    var res = _.find($scope.storage.operations, function(o) {
      return o.name === operationName;
    });
    if (res === undefined) {
      alert.error("Operation '" + operationName + "' is not allowed");
      return;
    }
    function doJob() {
      return WorkspaceService[operationName](res.url)
      .then(function() {
        if (operationName == 'run') {
          $scope.$evalAsync(function() {
            loadWorkspace();
          });
        }
      });
    }
    if (WorkspaceService[operationName]) {
      if ($scope.editor.controller) {
        return $scope.editor.controller.saveChanges()
        .then(function() {
          return doJob();
        }, function() {
          alert.error("Operation '" + operationName + "' canceled, can't save editor contents");
          return $q.reject();
        });
      } else {
        return doJob();
      }
    } else {
      alert.error('Unsupported operation: ' + operationName);
    }
  };

  $scope.changeName = function(newValue) {
    return WorkspaceService.update($scope.workspace.url, {'name': newValue});
  };
  $scope.changeDescription = function(newValue) {
    return WorkspaceService.update($scope.workspace.url, {'description': newValue});
  };
  $scope.changeRunArguments = function(newValue) {
    return WorkspaceService.update($scope.storage.url, {'runArguments': newValue});
  };
  $scope.changeRunconfig = function(newValue) {
    return WorkspaceService.update($scope.storage.url, {'runner': newValue.runner, 'target': newValue.target})
    .then(function() {
      $scope.$evalAsync(function() {
        loadWorkspace();
      });
      return true;
    });
  };

  $scope.getRunconfigDescription = function() {
    var runconfigurations = RunconfigService.getCached();
    if (runconfigurations) {
      var cfg = runconfigurations.find($scope.storage);
      if (cfg)
        return cfg.targetName;
      else
        return '!invalid';
    } else {
      return '... wait ...';
    }
  };

  $scope.onStorageClick = function(e, storage) {
    e.stopPropagation();
    console.error(this);
    $scope.$evalAsync(function() {
      loadWorkspace();
    });
  };

  $scope.saveChanges = function() {
    saveChanges();
  };

  $scope.createCommit = function() {
    ($scope.editor.controller ? $scope.editor.controller.saveChanges() : $q.when())
    .then(function() {
      WorkspaceService.commit($scope.workspace.url)
      .then(function(result) {
        $location.path(result.url);
      });
    });
  };

  $scope.restoreCode = function() {
    WorkspaceService.restore($scope.storage.url)
    .then(function(result) {
      $location.path(result.url);
    });
  };

  $scope.goStorage = function(storage) {
    alert.info('Change storage: ' + storage.name);
    $state.go('workspace.storage', {storage_id: storage.name});
  };

  $scope.getStorageBtnClass = function(storage) {
    if (storage.name == ($scope.currentStorage ||'current')) {
      if (storage.readonly)
        return 'btn-info';
      else
        return 'btn-primary';
    }
    return '';
  };

  var jobClasses = {
    'cancel': 'glyphicon glyphicon-remove text-warning',
    'failed': 'glyphicon glyphicon-flash text-danger',
    'queue': 'glyphicon glyphicon-time text-info',
    'submit': 'glyphicon glyphicon-flash text-info',
    'run': 'glyphicon glyphicon-flash text-success',
    'done': 'glyphicon glyphicon-ok text-success',
  };
  var jobDescription = {
    'cancel': 'Job was canceled',
    'failed': 'Job was failed (build problem, timeout/memory limits, etc)',
    'queue': 'Job is in queue',
    'submit': 'Job is submitted',
    'run': 'Processing...',
    'done': 'Done',
  };
  $scope.getJobIcon = function(storage) {
    if (storage.job === undefined)
      return undefined;
    return jobClasses[storage.job];
  };
  $scope.getJobDescription = function(storage) {
    if (storage.job === undefined)
      return undefined;
    return jobDescription[storage.job];
  };

  $scope.getLogString = function() {
    if ($scope.storage === undefined)
      return undefined;
    if ($scope.storage.log)
      return $scope.storage.log;
    return $scope.getJobDescription($scope.storage) || 'Press Ctrl+Enter to submit job';
  };

  $scope.upload = function (files) {
    if (files && files.length) {
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var upload = WorkspaceService.upload($scope.storage.url, file);
        upload
        .progress(function (evt) {
          var progressPercentage = parseInt(100.0 * evt.loaded / evt.total);
          console.log('progress: ' + progressPercentage + '% ' + evt.config.file.name);
        })
        .success(function (data, status, headers, config) {
          alert.success('File ' + config.file.name + ' uploaded');
          $scope.$evalAsync(function() {
            loadWorkspace();
          });
        })
        .error(function (data, status, headers, config) {
          alert.error('File ' + config.file.name + ' upload failed (status=' + status + ')');
        })
        ;
      }
    }
  };

  $scope.getUILayoutStorage = function(key) {
    return {
      get: function() {
        return SimpleStorage.get(key);
      },
      set: function(value) {
        return SimpleStorage.set(key, value);
      },
    };
  };
})

.directive('workspaceConsole', function() {
  return {
    restrict: 'C',
    scope: false,
    link: function($scope, element, attrs) {
      var textarea = element.find('textarea')[0];
      function cancelAnimation() {
        $(textarea).stop();
      }
      $scope.$watch(function() {
        return $scope.getLogString();
      }, function(newContent) {
        var oldScrollPos = textarea.scrollTop,
            isBottomScrolled = textarea.scrollTop >= textarea.scrollHeight - textarea.clientHeight - 30; // 30 is overhead
        textarea.value = newContent;
        if (isBottomScrolled) {
          var newScrollPos = textarea.scrollHeight - textarea.clientHeight;
          $(textarea).finish();
          if (oldScrollPos === 0 && newScrollPos > textarea.clientHeight) {
            textarea.scrollTop = newScrollPos;
          } else {
            $(textarea).on("mousedown wheel mousewheel keyup touchmove", cancelAnimation);
            $(textarea).animate({scrollTop: newScrollPos}, 2000, function() {
              $(textarea).off("mousedown wheel mousewheel keyup touchmove", cancelAnimation);
            });
          }
        }
      });
    },
  };
})

;
