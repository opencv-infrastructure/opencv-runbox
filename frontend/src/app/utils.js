angular.module('app')

.factory('naturalSort', function() {
  naturalSort = (function() {
    var rx = /(\d+)|(\D+)/g,
        rd = /\d/,
        rz = /^0/;
    return function(a, b) {
      // http://stackoverflow.com/a/4373421/112871
      if (typeof a === 'number' || typeof b === 'number') {
        if (isNaN(a)) return 1;
        if (isNaN(b)) return -1;
        return a-b;
      }
      a = a.toLowerCase();
      b = b.toLowerCase();
      if (a === b) return 0;
      if (!(rd.test(a) && rd.test(b))) {
        return (a > b ? 1 : -1);
      }
      a = a.match(rx);
      b = b.match(rx);
      var a1, b1;
      while (a.length && b.length) {
        a1 = a.shift();
        b1 = b.shift();
        if (a1 !== b1) {
          if (rd.test(a1) && rd.test(b1)) {
            return a1.replace(rz, ".0") - b1.replace(rz, ".0");
          } else {
            return (a1 > b1 ? 1 : -1);
          }
        }
      }
      return a.length - b.length;
    };
  })();

  return naturalSort;
})


.filter('bytes', function () {
  var units = ['B', 'kB', 'MB', 'GB'];

  return function(bytes, precision) {
    if (typeof bytes !== 'number') {
      bytes = parseFloat(bytes);
    }

    if (bytes === 0) {
      return '0 B';
    } else if (isNaN(bytes) || !isFinite(bytes)) {
      return '-';
    }

    var isNegative = bytes < 0;
    if (isNegative) {
      bytes = -bytes;
    }

    if (typeof precision !== 'number') {
      precision = parseFloat(precision);
    }

    if (isNaN(precision) || !isFinite(precision)) {
      precision = 1;
    }

    var exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    var number = (bytes / Math.pow(1024, Math.floor(exponent))).toFixed(precision);
    number = parseFloat(number);

    return (isNegative ? '-' : '') +  number +  ' ' + units[exponent];
  };
})

.factory('UnloadGuard', function($window) {
  var entries = [];

  function onBeforeUnload(event) {
    var message,
        blocked = _.any(entries, function(cb) { return !!(message = cb()); });
    if (blocked) {
      event.returnValue = message;
      return message;
    } else {
      return undefined;
    }
  }

  // returns cleanup
  var register = function(cb) {
    entries.unshift(cb);
    return function() {
      var index = entries.indexOf(cb);
      if (index >= 0) {
        entries.splice(index, 1);
      }
    };
  };

  if ($window.addEventListener) {
    $window.addEventListener('beforeunload', onBeforeUnload);
  } else {
    $window.onbeforeunload = onBeforeUnload;
  }

  return {
    register: register
  };
})

;
