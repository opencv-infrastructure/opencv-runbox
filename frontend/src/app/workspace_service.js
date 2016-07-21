angular.module('app')

.factory('WorkspaceStorage', function(naturalSort) {

  function WorkspaceStorage(initializer) {
    var self = this;
    _.forEach(initializer, function(v, k) {
      self[k] = v;
    });
    var storage_list = [];
    _.forEach(self.storage, function(v, k) {
      v.name = k;
      storage_list.push(v);
    });
    storage_list.sort(function(a, b) {
      return -naturalSort(a.name, b.name);
    });
    self.storage_list = storage_list;
  }
  _.extend(WorkspaceStorage.prototype, {
    // TODO
  });

  return {
    WorkspaceStorage: WorkspaceStorage,
    create: function() {
      var obj = Object.create(WorkspaceStorage.prototype);
      WorkspaceStorage.apply(obj, arguments);
      return obj;
    }
  };
})


.factory('WorkspaceService', function ($http, $q, $location, $rootScope, Upload) {
  var baseURL = 'api/v1.0/';

  return {
    query: function(id, params) {
      var resource = id;
      var path = baseURL + resource;
      alert.info('Fetch: ' + resource + ' ...');
      return $http.get(path, {'params':params})
      .then(function(response) {
        alert.success('SUCCESS: Fetch: ' + resource);
        return response;
      });
    },
    edit: function(id) {
      $location.path(id);
    },
    fork: function(id) {
      var resource = id;
      var path = baseURL + resource + '/fork';
      alert.info('Fork: ' + resource + ' ...');
      return $http.post(path)
      .then(function(response) {
        var timestamp = Date.now(),
            result = response.data,
            url = result.url;
        alert.success('SUCCESS: Fork: ' + resource + ' (created: ' + url + ')');
        $location.path(url);
        $rootScope.$broadcast('workspaces-changed', {timestamp: timestamp});
        return response.data;
      }, function(response) {
        var message = 'unknown';
        try {
          message = response.data.message;
        } catch (e) {}
        alert.error('FAILED: Fork: ' + resource + ' (status: ' + response.status + ', message: ' + message + ')');
        return $q.reject();
      });
    },
    'delete': function(id) {
      if (!confirm('Are you sure you want to delete "' + id + '"?'))
        return;
      var resource = id;
      var path = baseURL + resource;
      alert.info('Delete: ' + resource + ' ...');
      return $http({
        method: 'DELETE',
        url: path,
      })
      .then(function(response) {
        var timestamp = Date.now(),
            result = response.data,
            url = result.url;
        alert.success('SUCCESS: Delete: ' + resource);
        $location.path(url||'');
        $rootScope.$broadcast('workspaces-changed', {timestamp: timestamp});
        return response.data;
      }, function(response) {
        var message = 'unknown';
        try {
          message = response.data.message;
        } catch (e) {}
        alert.error('FAILED: Delete: ' + resource + ' (status: ' + response.status + ', message: ' + message + ')');
        return $q.reject();
      });
    },
    commit: function(id) {
      var resource = id;
      var path = baseURL + resource + '/commit';
      alert.info('Commit: ' + resource + ' ...');
      return $http({
        method: 'POST',
        url: path,
      })
      .then(function(response) {
        var timestamp = Date.now();
        alert.success('SUCCESS: Commit: ' + resource);
        $rootScope.$broadcast('workspaces-changed', {timestamp: timestamp});
        return response.data;
      }, function(response) {
        var message = 'unknown';
        try {
          message = response.data.message;
        } catch (e) {}
        alert.error('FAILED: Commit: ' + resource + ' (status: ' + response.status + ', message: ' + message + ')');
        return $q.reject();
      });
    },
    restore: function(id) {
      var resource = id;
      var path = baseURL + resource + '/restore';
      alert.info('Restore from history: ' + resource + ' ...');
      return $http({
        method: 'POST',
        url: path,
      })
      .then(function(response) {
        var timestamp = Date.now();
        alert.success('SUCCESS: Restore from history: ' + resource);
        $rootScope.$broadcast('workspaces-changed', {timestamp: timestamp});
        return response.data;
      }, function(response) {
        var message = 'unknown';
        try {
          message = response.data.message;
        } catch (e) {}
        alert.error('FAILED: Restore from history: ' + resource + ' (status: ' + response.status + ', message: ' + message + ')');
        return $q.reject();
      });
    },
    publish: function(id) {
      var resource = id;
      var path = baseURL + resource + '/publish';
      alert.info('Publish workspace: ' + resource + ' ...');
      return $http({
        method: 'POST',
        url: path,
      })
      .then(function(response) {
        var timestamp = Date.now(),
            result = response.data,
            url = result.url;
        alert.success('SUCCESS: Publish workspace: ' + resource);
        if (url)
          $location.path(url);
        $rootScope.$broadcast('workspaces-changed', {timestamp: timestamp});
        return response.data;
      }, function(response) {
        var message = 'unknown';
        try {
          message = response.data.message;
        } catch (e) {}
        alert.error('FAILED: Publish workspace: ' + resource + ' (status: ' + response.status + ', message: ' + message + ')');
        return $q.reject();
      });
    },
    run: function(id) {
      var resource = id;
      var path = baseURL + resource + '/run';
      alert.info('Submit task: ' + resource + ' ...');
      return $http({
        method: 'POST',
        url: path,
      })
      .then(function(response) {
        var timestamp = Date.now(),
            result = response.data,
            url = result.url;
        alert.success('SUCCESS: Submit task: ' + resource);
        if (url)
          $location.path(url);
        $rootScope.$broadcast('workspaces-changed', {timestamp: timestamp});
        return response.data;
      }, function(response) {
        var message = 'unknown';
        try {
          message = response.data.message;
        } catch (e) {}
        alert.error('FAILED: Submit task: ' + resource + ' (status: ' + response.status + ', message: ' + message + ')');
        return $q.reject();
      });
    },
    stop: function(id) {
      var resource = id;
      var path = baseURL + resource + '/stop';
      alert.info('Stop task: ' + resource + ' ...');
      return $http({
        method: 'POST',
        url: path,
      })
      .then(function(response) {
        var timestamp = Date.now(),
            result = response.data,
            url = result.url;
        alert.success('SUCCESS: Stop task: ' + resource);
        if (url)
          $location.path(url);
        $rootScope.$broadcast('workspaces-changed', {timestamp: timestamp});
        return response.data;
      }, function(response) {
        var message = 'unknown';
        try {
          message = response.data.message;
        } catch (e) {}
        alert.error('FAILED: Stop task: ' + resource + ' (status: ' + response.status + ', message: ' + message + ')');
        return $q.reject();
      });
    },
    update: function(id, fields) {
      var resource = id;
      var path = baseURL + resource;
      alert.info('Update: ' + resource + ': ' + Object.keys(fields).join(',') + ' ...');
      return $http({
        method: 'PUT',
        url: path,
        data: fields,
        //headers: {'Content-Type': 'application/x-www-form-urlencoded'}
      })
      .then(function(response) {
        var timestamp = Date.now();
        alert.success('SUCCESS: Update: ' + resource);
        $rootScope.$broadcast('workspaces-changed', {timestamp: timestamp});
        return response.data;
      }, function(response) {
        var message = 'unknown';
        try {
          message = response.data.message;
        } catch (e) {}
        alert.error('FAILED: Update: ' + resource + ' (status: ' + response.status + ', message: ' + message + ')');
        return $q.reject();
      });
    },
    queryAll: function(resource, params) {
      var path = baseURL + resource;
      alert.info('Fetch all: ' + resource + ' ...');
      return $http.get(path, {'params':params})
      .then(function(response) {
        alert.success('SUCCESS: Fetch all: ' + resource);
        return response;
      });
    },
    getURL: function(url) {
      return baseURL + url;
    },

    upload: function(id, file) {
      var resource = id;
      var url = baseURL + resource + '/upload';
      return Upload.upload({
        url: url,
        file: file
      });
    }
  };
})

;
