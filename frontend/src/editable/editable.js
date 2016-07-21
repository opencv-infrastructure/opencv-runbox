angular.module('app')

.directive('editable', function($parse, $rootScope, $document, EditablePopupService) {
  return {
    require: ['editable', '?ngModel', '?ngDisabled'],
    restrict: 'AE',
    transclude: true,
    scope: {
      'editableApply': '&',
      'editableTemplate': '@',
    },
    templateUrl: 'editable/editable_container.tpl.html',
    controller: function($scope) {
      $scope.editableTemplate = $scope.editableTemplate || 'editable-template-simple';
      $scope.editMode = false;
      $scope.showEditButton = false;
      this.edit = function() {
        if ($scope.getValue)
          $scope.value = $scope.getValue();
        $scope.editMode = true;
        $scope.validating = false;
        $scope.validationErrorMessage = undefined;
      }
      this.cancel = function(force) {
        if ($scope.validating && !force)
          return false;
        $scope.editMode = false;
      }
      $scope.validating = false;
      this.apply = function(value) {
        if ($scope.validating)
          return false;

        if ($scope.getValue && angular.equals(value, $scope.getValue())) {
          $scope.editMode = false;
          return;
        }

        function success() {
          if ($scope.editMode) { // it is not canceled
            if ($scope.setValue)
              $scope.setValue(value);
          }
          $scope.editMode = false;
          end();
        }
        function failure(message) {
          $scope.validationErrorMessage = message ? (message.message ? message.message : message) : "Validation failed";
          end();
        }
        function end() {
          $scope.validating = false;
          if (!$rootScope.$$phase)
            $rootScope.$digest();
        }

        $scope.validating = true;
        var applyResult = $scope.editableApply({
          value: value
        });

        if (applyResult && applyResult.then) { // promise
          applyResult.then(success, failure);
        } else if (applyResult || typeof applyResult === 'undefined') {
          success();
        } else {
          failure();
        }
      }
      this.name = 'Editable controller';
    },
    link: function($scope, element, attrs, ctrls) {
      var controller = ctrls[0],
          ngModel = ctrls[1];
      if (ngModel) {
        $scope.getValue = function() {
          return ngModel.$viewValue;
        };
        $scope.setValue = function(value) {
          return ngModel.$setViewValue(value);
        };
      }

      var ngDisabled_fn = $parse(attrs.ngDisabled);

      var mouseEnterTimer, mouseLeaveTimer;
      function mouseenter(e) {
        if (mouseLeaveTimer !== undefined) {
          clearTimeout(mouseLeaveTimer); mouseLeaveTimer = undefined;
        }
        if (mouseEnterTimer === undefined)
          mouseEnterTimer = setTimeout(function() {
            $scope.$apply(function() {
              $scope.showEditButton = true;
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
              $scope.showEditButton = false;
            });
          }, 450);
      }
      function click(e) {
        if (mouseLeaveTimer !== undefined) {
          clearTimeout(mouseLeaveTimer); mouseLeaveTimer = undefined;
        }
        if (mouseEnterTimer !== undefined) {
          clearTimeout(mouseEnterTimer); mouseEnterTimer = undefined;
        }
        $scope.$apply(function() {
          $scope.showEditButton = true;
        });
        mouseLeaveTimer = setTimeout(function() {
          $scope.$apply(function() {
            $scope.showEditButton = false;
          });
        }, 3000);
      }
      function dblclick(e) {
        if (mouseLeaveTimer !== undefined) {
          clearTimeout(mouseLeaveTimer); mouseLeaveTimer = undefined;
        }
        if (mouseEnterTimer !== undefined) {
          clearTimeout(mouseEnterTimer); mouseEnterTimer = undefined;
        }
        $scope.$apply(function() {
          controller.edit();
        });
      }

      function enableEditableBtn() {
        element.on('mouseenter', mouseenter);
        element.on('mouseleave', mouseleave);
        element.on('click', click);
        element.on('dblclick', dblclick);
      }
      function disableEditableBtn() {
        element.off('mouseenter', mouseenter);
        element.off('mouseleave', mouseleave);
        element.off('click', click);
        element.off('dblclick', dblclick);
        if (mouseLeaveTimer !== undefined) {
          clearTimeout(mouseLeaveTimer); mouseLeaveTimer = undefined;
        }
        if (mouseEnterTimer !== undefined) {
          clearTimeout(mouseEnterTimer); mouseEnterTimer = undefined;
        }
        $scope.showEditButton = false;
      }

      $scope.$watchGroup([function() {
          var disabled = ngDisabled_fn($scope.$parent);
          return disabled;
        }, 'editMode'], function(value) {
        if (!value[0] && !$scope.editMode) {
          enableEditableBtn();
        } else {
          disableEditableBtn();
        }
      });

      var popupBtn;
      $scope.$watch('showEditButton', function() {
        if ($scope.showEditButton) {
          function activate() {
            popupBtn = EditablePopupService.activate('<editable-popup-edit-btn></editable-popup-edit-btn>', $scope, element, controller);
            if (!$rootScope.$$phase)
              $scope.$digest();
          }
          var timer = setInterval(check, 50);
          var currentPopup;
          function check() {
            currentPopup = EditablePopupService.getPopupElement();
            if ($scope.showEditButton) {
              if (currentPopup == undefined) {
                activate();
              } else {
                return;
              }
            }
            clearInterval(timer);
          };
        } else {
          if (popupBtn) {
            EditablePopupService.deactivate(popupBtn);
            popupBtn = undefined;
          }
        }
      });

      var popup;
      $scope.$watch('editMode', function() {
        if ($scope.editMode) {
          popup = EditablePopupService.activate('<editable-popup></editable-popup>', $scope, element, controller);
        } else {
          if (popup) {
            EditablePopupService.deactivate(popup);
            popup = undefined;
          }
        }
      });

      $scope.onEditClick = function(e) {
        e.stopPropagation();
        controller.edit();
        return false;
      }
    },
  };
})

.directive('editablePopupEditBtn', function($document, EditablePopupService) {
  return {
    restrict: 'AE',
    scope: true,
    templateUrl: 'editable/editable_popup_edit_btn.tpl.html',
    link: function($scope, element, attrs) {
      var baseElement = EditablePopupService.getElement();
      var controller = EditablePopupService.getController();
      element.addClass('editable-popup-edit-btn');
      function updatePosition() {
        var offset = baseElement.offset(),
            width = baseElement.width(),
            height = baseElement.height(),
            self_width = element.width(),
            self_height = element.height(),
            parent = element.parent(),
            parent_width = parent.width(),
            parent_height = parent.height(),
            left = offset.left + width,
            top = offset.top + (height - self_height)/2;
        var diff = parent_width - (left + self_width);
        if (diff < 0)
          left += diff;
        if (left < 0)
          left = 0;
        if (top < 0)
          top = 0;
        element.css({
          left: left,
          top: top,
        });
      }
      updatePosition();
      $scope.$watch(function() { return element.height(); }, updatePosition);
      element.addClass('visible');

      function mouseenter(e) {
        baseElement.trigger('mouseenter');
      }
      function mouseleave(e) {
        baseElement.trigger('mouseleave');
      }
      element.on('mouseenter', mouseenter);
      element.on('mouseleave', mouseleave);

      $scope.$on('$destroy', function() {
        element.off('mouseenter', mouseenter);
        element.off('mouseleave', mouseleave);
      });
    },
  };
})

.directive('editablePopup', function($compile, $document, EditablePopupService) {
  return {
    restrict: 'AE',
    scope: true,
    templateUrl: 'editable/editable_popup.tpl.html',
    controller: function PopupController($scope) {
      var controller = EditablePopupService.getController(),
          parentScope = EditablePopupService.getParentScope();
      this.apply = controller.apply;
      this.cancel = controller.cancel;
      this.getParentScope = function() { return parentScope; }
    },
    link: function($scope, element, attrs, popupController) {
      var templateElement = $compile('<' + $scope.editableTemplate + '/>')($scope, function(clonedElement) {
        element.find('.editable-template').append(clonedElement);
      });
      var baseElement = EditablePopupService.getElement();
      element.addClass('editable-popup');
      function updatePosition() {
        var offset = baseElement.offset(),
            width = baseElement.width(),
            height = baseElement.height(),
            self_width = element.width(),
            self_height = element.height(),
            parent = element.parent(),
            parent_width = parent.width(),
            parent_height = parent.height(),
            left = offset.left + width,
            top = offset.top + (height - self_height)/2;
        var diff = parent_width - (left + self_width);
        if (diff < 0)
          left += diff;
        if (left < 0)
          left = 0;
        if (top < 0)
          top = 0;
        element.css({
          left: left,
          top: top,
        });
      }
      updatePosition();
      $scope.$watch(function() { return element.height(); }, updatePosition);
      element.addClass('visible');

      function elementClick(e) {
        e.stopPropagation();
        return false;
      }
      element.on('click', elementClick);

      function documentClick(e) {
        $scope.$apply(function() {
          if (!popupController.cancel())
            e.stopPropagation();
        });
      }
      $document.on('click', documentClick);

      function keyUp(e) {
        switch (e.keyCode) {
        case 13: // ENTER
          $scope.$apply(templateElement.scope().apply);
          break;
        case 27: // ESC
          $scope.$apply(popupController.cancel);
          break;
        default:
          break;
       }
      }
      $document.on('keyup', keyUp);

      $scope.$watch('validating', function() {
        var controlElements = element.find(':input');
        if ($scope.validating) {
          controlElements.each(function(i, e) {
            if (e.disabled)
              e.$editable_disabled = true;
            else
              e.disabled = true;
          });
        } else {
          $.each(controlElements, function(i, e) {
            if (e.$editable_disabled)
              delete e.$editable_disabled;
            else
              e.disabled = false;
          });
        }
      })

      $scope.$on('$destroy', function() {
        element.off('click', elementClick);
        $document.off('click', documentClick);
        $document.off('keyup', keyUp);
        if ($scope.editMode)
          popupController.cancel(true);
      });
    },
  };
})

.directive('editableTemplateSimple', function() {
  return {
    require: '^editablePopup',
    restrict: 'AEC',
    scope: true,
    templateUrl: 'editable/editable_template_simple.tpl.html',
    link: function($scope, element, attrs, popupController) {
      element.find("input").focus();
      $scope.apply = function() {
        popupController.apply($scope.value);
      };
      $scope.cancel = function() {
        popupController.cancel();
      };
    },
  };
})

.factory('EditablePopupService', function($compile) {
  var baseScope,
      baseElement,
      popupElement,
      popupController;

  return {
    activate: function(popup, $scope, element, controller) {
      if (popupElement !== undefined)
        this.deactivate();
      baseScope = $scope;
      baseElement = element;
      popupController = controller;
      var body = angular.element(document).find('body').eq(0);
      popupElement = $compile(popup)($scope);
      body.append(popupElement);
      return popupElement;
    },
    deactivate: function(popupToDeactivate) {
      if (popupToDeactivate !== undefined && popupElement !== undefined && popupElement[0] != popupToDeactivate[0]) {
        return; // something else is activated
      }
      if (popupElement) {
        popupElement.scope().$destroy();
        popupElement.remove();
      }
      baseScope = undefined;
      baseElement = undefined;
      popupElement = undefined;
      popupController = undefined;
    },
    getElement: function() {
      return baseElement;
    },
    getPopupElement: function() {
      return popupElement;
    },
    getController: function() {
      return popupController;
    },
    getParentScope: function() {
      return baseScope.$parent;
    },
  };
})

;
