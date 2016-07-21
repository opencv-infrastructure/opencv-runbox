angular.module('app')

.factory('SimpleStorage', function() {

  function SimpleStorage(initializer) {
    // none
  }
  _.extend(SimpleStorage.prototype, {
    set: function(k, v) {
      console.log("Write key: " + k);
      var key = 'id_' + k,
          value = this[key];
      this[key] = v;
      return value;
    },
    get: function(k) {
      var key = 'id_' + k,
          value = this[key];
      if (value !== undefined)
        console.log("Read key: " + k);
      return value;
    },
  });

  return new SimpleStorage();
})

;
