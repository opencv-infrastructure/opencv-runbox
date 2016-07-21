'use strict';

var alertOptions = {
  showLimit : 5,
  showTimeout: 20000,
  expireTime: 5000,
};

angular.module('alert', [])

.controller('alertController', function($scope, $rootScope, $timeout) {
  $scope.options = alertOptions;
  $scope.alerts = [];

  $scope.showList = false;
  $scope.toggleAlertList = function() {
    $scope.showList = !$scope.showList;
  };

  $scope.getItemCount = function(type) {
    var count = 0;
    _.forEach($scope.alerts, function(a) {
      if (a.type === type)
        count++;
    });
    return count;
  };

  $scope.preventRemoval = false;
  $scope.closeAlert = function(p) {
    if (p.hold)
      return;
    delete p.timeout;
    var index = $scope.alerts.indexOf(p);
    if (index < 0)
      return;
    return $scope.alerts.splice(index, 1);
  };
  $scope.updateAlertTimeout = function(p) {
    if (p.timeoutHandler)
      $timeout.cancel(p.timeoutHandler);
    if (p.hold)
      return true;
    var newTimeout = p.timeout ? p.timeout - Date.now() : -1;
    if (newTimeout < -100) {
      p.timeout = Date.now() + alertOptions.expireTime;
      newTimeout = alertOptions.expireTime;
    }
    p.expireMode = newTimeout <= alertOptions.expireTime;
    if (!p.expireMode)
      newTimeout -= alertOptions.expireTime;
    newTimeout = Math.max(100, newTimeout);
    p.timeoutHandler = $timeout(function() {
      if ($scope.preventRemoval)
        return;
      if (!p.timeout)
        return;
      var diff = p.timeout - Date.now();
      if (diff > alertOptions.expireTime + 100)
        return p.updateAlertTimeout();
      if (diff > 100) {
        p.expireMode = true;
        return p.updateAlertTimeout();
      }
      $scope.closeAlert(p);
      return null;
    }, newTimeout);
    return p;
  };
  return $rootScope.$on('alert', function(ev, p) {
    p.msg = p.msg.replace(/ /g, '\u00a0');
    console.log(((typeof(p.type) === 'string') ? p.type.toUpperCase() : 'UNK') + ': ' + p.msg);
    p.updateAlertTimeout = function () {
      return $scope.updateAlertTimeout(p);
    };
    p.timeout = Date.now() + alertOptions.showTimeout;
    function doWork() {
      $scope.alerts.push(p);
      $scope.updateAlertTimeout(p);
    }
    if ($rootScope.$$phase)
      doWork();
    else
      $scope.$apply(doWork);
  });
})


.run(function($rootScope) {
  var alert;
  alert = function(msg, type) {
    if (type === null) type = 'danger';
    return $rootScope.$emit('alert', {
      type: type,
      msg: msg
    });
  };
  alert.error = function(msg) {
    return alert(msg, 'danger');
  };
  alert.warning = function(msg) {
    return alert(msg, 'warning');
  };
  alert.info = function(msg) {
    return alert(msg, 'info');
  };
  alert.success = function(msg) {
    return alert(msg, 'success');
  };
  window.alert = alert;
})

.directive('alertContainer', function() {
  return {
    restrict: 'E',
    templateUrl: 'alert/index.tpl.html',
    controller: 'alertController',
    link : function(scope, element, attrs) {
      var $scope = scope;

      var timestart;
      element.on('mouseenter.timer', function () {
        scope.preventRemoval = true;
        timestart = Date.now();
        scope.$apply(function () {
          var alerts = scope.alerts;
          for (var index = 0, _length = alerts.length; index < _length; index++) {
            var a = alerts[index];
            a.expireMode = false;
          }
        });
      });
      element.on('mouseleave.timer', function () {
        scope.$apply(function () {
          scope.preventRemoval = false;
          var now = Date.now();
          var timeShift = (now - (timestart || now));
          if (timeShift > 1000)
            timeShift += 3000;
          if (timeShift > alertOptions.showTimeout)
            timeShift = alertOptions.showTimeout;
          timestart = undefined;
          var alerts = scope.alerts;
          for (var index = 0, _length = alerts.length; index < _length; index++) {
            var a = alerts[index];
            if (a.timeout) {
              a.timeout += timeShift;
              a.timeout = Math.max(a.timeout, now + 500 + alertOptions.expireTime);
            }
            scope.updateAlertTimeout(a);
          }
        });
      });

      var mouseEnterTimer, mouseLeaveTimer;
      function mouseenter(e) {
        if (mouseLeaveTimer !== undefined) {
          clearTimeout(mouseLeaveTimer); mouseLeaveTimer = undefined;
        }
        if (mouseEnterTimer === undefined)
          mouseEnterTimer = setTimeout(function() {
            $scope.$apply(function() {
              $scope.showPreview = true;
            });
          }, 500);
      }
      function mouseleave(e) {
        if (mouseEnterTimer !== undefined) {
          clearTimeout(mouseEnterTimer); mouseEnterTimer = undefined;
        }
        if (mouseLeaveTimer === undefined)
          mouseLeaveTimer = setTimeout(function() {
            $scope.$apply(function() {
              $scope.showPreview = false;
            });
          }, 450);
      }

      function enablePreview() {
        element.on('mouseenter', mouseenter);
        element.on('mouseleave', mouseleave);
      }
      function disablePreview() {
        element.off('mouseenter', mouseenter);
        element.off('mouseleave', mouseleave);
        if (mouseLeaveTimer !== undefined) {
          clearTimeout(mouseLeaveTimer); mouseLeaveTimer = undefined;
        }
        if (mouseEnterTimer !== undefined) {
          clearTimeout(mouseEnterTimer); mouseEnterTimer = undefined;
        }
        $scope.showPreview = false;
      }

      $scope.$watch('!showList && alerts.length !== 0', function(value) {
        if (value) {
          enablePreview();
        } else {
          disablePreview();
        }
      });
    }
  };
})

.directive('alert', function () {
  return {
    restrict:'C',
    link : function(scope, element, attrs) {
      scope.$parent.$watch('alert.expireMode', function(newValue, oldValue) {
        if (newValue)
          element.fadeTo(alertOptions.expireTime, 0.3);
        else {
          element.stop(true);
          element.fadeTo(500, 1.0);
        }
      });
    }
  };
})

.filter('reverse', function() {
  return function(items) {
    return items.slice().reverse();
  };
});
