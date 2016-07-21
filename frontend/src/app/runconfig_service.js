angular.module('app')

.factory('RunconfigStorage', function() {

  function RunconfigStorage(initializer) {
    var self = this;
    _.forEach(initializer, function(v, k) {
      self[k] = v;
    });
    var configurations = [];
    _.forEach(self.entries, function(runner) {
      _.forEach(runner.targets, function(target, targetId) {
        configurations.push({
          runner: runner.runner,
          runnerName: runner.runnerName || runner.runner,
          target: targetId,
          targetName: target.name
        });
      })
    })
    self.configurations = configurations;
  }
  _.extend(RunconfigStorage.prototype, {
    find: function(storage) {
      if (storage === undefined)
        return undefined;
      return _.find(this.configurations, function(cfg) {
        return cfg.runner == storage.runner && cfg.target == storage.target;
      })
    }
  });

  return {
    RunconfigStorage: RunconfigStorage,
    create: function() {
      var obj = Object.create(RunconfigStorage.prototype);
      RunconfigStorage.apply(obj, arguments);
      return obj;
    }
  };
})


.factory('RunconfigService', function ($http, $q, RunconfigStorage) {
  var baseURL = 'api/v1.0/',
      storage;

  return {
    queryAll: function() {
      if (storage) {
        var q = $q.defer();
        q.resolve(storage);
        return q.promise;
      }
      var path = baseURL + 'runners';
      alert.info('Fetch run configurations ...');
      return $http.get(path)
      .then(function(response) {
        alert.success('SUCCESS: Fetch run configurations');
        storage = RunconfigStorage.create(response.data);
        return storage;
      });
    },
    getCached: function () {
      return storage;
    }
  };
})

;
