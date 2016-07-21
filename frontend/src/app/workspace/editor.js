angular.module('app')

.directive('codeEditor', function() {
  return {
    restrict: 'AE',
    scope: {},
    templateUrl: 'app/workspace/editor.tpl.html',
    controller: 'CodeEditorController',
  };
})

.controller('CodeEditorController', function($scope, $state, $q, WorkspaceService, HistoryContainer, UnloadGuard) {
  var self = this;
  console.log('CodeEditorController scope: ' + $scope.$id);
  var unloadCleanup;

  $scope.$on('$destroy', function() {
    console.log('Destroy CodeEditorController scope: ' + $scope.$id);
    unloadCleanup();
  });

  $scope.$on('workspace-storage-close', function(event) {
    if (!self.canClose())
        event.preventDefault();
  });
  unloadCleanup = UnloadGuard.register(function() {
    if (editor.codeDirty) {
      return "You have unsaved changes. Do you want to drop them and leave page?";
    }
  });

  var editor = $scope.$parent.editor;
  $scope.editor = editor;
  editor.controller = self;

  self.canClose = function() {
    if (editor.codeDirty) {
      self.saveChanges();
    }
    return true;
  };

  self.update = function(storage) {
    storage = storage || {}
    if (storage.url === editor.url && storage.codeExt === editor.codeExt)
      return; // no update required
    self.saveState();
    self.initialize(storage);
  };

  $scope.code = editor.code;

  self.initialize = function(storage) {
    _.forEach('url code codeExt codeFoldLines codeHighlights readonly timestamp'.split(' '), function(k) {
      editor[k] = storage[k];
    });
    if (editor.url !== undefined) {
      editor.historyKey = 'codeEditor!' + editor.url;
      editor.state = HistoryContainer.get(editor.historyKey) || {};
      if (editor.state.code !== storage.code && editor.state.baseTimestamp < storage.timestamp) {
        alert.warning('Code mismatch with server. Drop history');
        HistoryContainer.set(editor.historyKey, undefined);
        editor.state = {};
      }
    } else {
      editor.historyKey = undefined;
      editor.state = undefined;
    }
    if ($scope.codeExt != editor.codeExt) {
      if ($scope.cm)
        $scope.cm.setValue('');
      $scope.code = undefined;
      $scope.codeExt = editor.codeExt;
    }
    updateCodeMirrorMode(function() {
      var cm = $scope.cm;
      if (cm === undefined) {
        return; // destroyed
      }

      cm.setOption('readOnly', editor.readonly === true);

      $scope.code = editor.state.code || editor.code;

      { // force editor value update
        var safeViewValue = $scope.code || '';
        cm.setValue(safeViewValue);
      }

      _.forEach(editor.state.codeFoldLines || editor.codeFoldLines, function(line) {
        cm.foldCode(CodeMirror.Pos(line, 0), {}, 'fold');
      });

      _.forEach(editor.state.codeHighlights || editor.codeHighlights, function(e) {
        if ('line' in e)
          cm.markText({line: e.line, ch: 0}, {line: e.line, ch: null}, {className: 'code-highlight-' + e.style});
        else {
          var from = e.from;
          if (typeof from === 'number')
            from = {line: from, ch: 0};
          if (from.ch == null)
            from.ch = 0;
          var to = e.to;
          if (to == null)
            to = {line: from.line, ch: null};
          else if (typeof to === 'number')
            to = {line: to, ch: null};
          cm.markText(from, to, {className: 'code-highlight-' + e.style, addToHistory: true});
        }
      });

      cm.clearHistory();
      if (editor.state.history)
        cm.setHistory(editor.state.history);

      if (editor.state.scrollInfo) {
        cm.scrollTo(editor.state.scrollInfo.left, editor.state.scrollInfo.top);
      }

      if (editor.state.selectionFrom) {
        cm.setSelection(editor.state.selectionFrom, editor.state.selectionTo, {scroll: false});
      }

      cm.focus();
    });
  };

  self.saveState = function() {
    var cm = $scope.cm;
    if (editor.url === undefined || cm === undefined)
      return;
    var state = _.extend(self.grabEditorChanges(), {
        code: $scope.code,
        codeDirty: editor.codeDirty,
        history: cm.getHistory(),
        scrollInfo: cm.getScrollInfo(),
        selectionFrom: cm.doc.getCursor('from'),
        selectionTo: cm.doc.getCursor('to'),
        baseTimestamp: editor.timestamp,
      });
    HistoryContainer.set(editor.historyKey, state);
  };

  $scope.$watch("code", onCodeChange)

  function onCodeChange(newValue, oldValue) {
    if (oldValue && newValue !== editor.code && editor.codeDirty !== true) {
      console.log('code changed...');
      editor.codeDirty = true;
    }
    if (editor.codeDirty)
      self.saveChangesDebounce();
  }

  self.grabEditorChanges = function() {
    var marks = $scope.cm.getAllMarks();
    var codeHighlights = [];
    var codeFoldLines = [];
    _.forEach(marks, function(m) {
      if (m.className && m.className.startsWith('code-highlight-')) {
        var pos = m.find(), style = m.className.replace('code-highlight-', '');
        codeHighlights.push({
          from: pos.from,
          to: pos.to,
          style: style,
        })
      } else if (m.__isFold) {
        var pos = m.find();
        codeFoldLines.push(pos.from.line);
      }
    });
    var res = {};
    if (!angular.equals(editor.codeHighlights, codeHighlights))
      res.codeHighlights = codeHighlights;
    if (!angular.equals(editor.codeFoldLines, codeFoldLines))
      res.codeFoldLines = codeFoldLines;
    if (editor.code != $scope.code)
      res.code = $scope.code;
    return res;
  }

  function saveChanges(url, update) {
    if (Object.keys(update).length === 0)
      return $q.when();
    return WorkspaceService.update(url, update)
    .then(function() {
      if ('code' in update)
        editor.code = update.code;
    });
  };

  self.saveChanges = function() {
    self.saveChangesDebounce.cancel();
    if (editor.codeDirty !== true || editor.url === undefined)
      return $q.when();
    editor.codeDirty = undefined;
    return saveChanges(editor.url, self.grabEditorChanges())
    .then(function() {
      alert.success("Editor contents saved");
    },function() {
      alert.error("Can't save editor changes");
      editor.codeDirty = true;
      delete editor.locked;
      return $q.reject();
    });
  };

  self.saveChangesDebounce = _.debounce(function() {
    $scope.$evalAsync(self.saveChanges);
  }, 5000, {maxWait: 30000});

  function _askForCodeChange() {
    if (confirm('You try to edit code, but history is readonly. Leave history storage?')) {
      $state.go('workspace.storage', {storage_id: 'current'});
    }
  }
  var askForCodeChange = _.debounce(_askForCodeChange, 5000, {leading: true, trailing: false});

  function onKeydown(cm, event) {
    if (!cm.getOption("readOnly")) return;

    var keycode = event.keyCode;

    var valid =
      (keycode > 47 && keycode < 58)   || // number keys
      keycode == 32                    || // spacebar
      (keycode > 64 && keycode < 91)   || // letter keys
      (keycode > 95 && keycode < 112)  || // numpad keys
      (keycode > 185 && keycode < 193) || // ;=,-./` (in order)
      (keycode > 218 && keycode < 223) || // [\]' (in order)
      keycode == 8 || keycode == 46    || // backspace and delete
      false;

    if (!valid)
      return;

    askForCodeChange();
  }

  $scope.cm = undefined;

  function toggleMarkOfSelectedText(cm, style)
  {
    if (cm.getOption("readOnly")) return;
    var from = cm.getCursor(true),
        to = cm.getCursor(false),
        marks = cm.findMarks(from, to),
        isClear = false;
    _.forEach(marks, function(m) {
      if (m.className && m.className.startsWith('code-highlight-')) {
        m.clear();
        if (m.className == 'code-highlight-' + style) {
          isClear = true;
        }
      }
    });
    if (!isClear)
      cm.markText(from, to, {className: 'code-highlight-' + style, addToHistory: true});
    setDirty();
  }

  $scope.editorOptions = {
      lineWrapping : false,
      lineNumbers: true,
      tabSize: 4,
      indentUnit: 4,
      indentWithTabs: false,

      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],

      styleActiveLine: true,
      autoCloseBrackets: true,

      foldGutter: true,

      highlightSelectionMatches: {showToken: /\w/},
      matchBrackets: true,

      showTrailingSpace: true,

      styleSelectedText: true,

      placeholder: '... code ...',

      onLoad : function(cm) {
        $scope.cm = cm;
        cm.on('keydown', onKeydown);
      },

      extraKeys: {
        "F11": function(cm) {
          cm.setOption("fullScreen", !cm.getOption("fullScreen"));
        },
        "Esc": function(cm) {
          if (cm.getOption("readOnly")) return;
          $scope.$evalAsync(saveChanges);
        },
        "Ctrl-Q": function(cm) {
          if (cm.getOption("readOnly")) return;
          cm.foldCode(cm.getCursor());
          setDirty();
        },
        "Ctrl-S": function(cm) {
          if (cm.getOption("readOnly")) return;
          $scope.$evalAsync(self.saveChanges);
        },
        "Ctrl-Enter": function(cm) {
            $scope.$evalAsync(function() {
              if ($scope.$parent.doStorageOperation)
                $scope.$parent.doStorageOperation('run');
            });
        },
        "Ctrl-1": function(cm) {
          toggleMarkOfSelectedText(cm, '1');
        },
        "Ctrl-2": function(cm) {
          toggleMarkOfSelectedText(cm, '2');
        },
        "Ctrl-3": function(cm) {
          toggleMarkOfSelectedText(cm, '3');
        },
        "Ctrl-4": function(cm) {
          toggleMarkOfSelectedText(cm, '4');
        },
        "Ctrl-5": function(cm) {
          toggleMarkOfSelectedText(cm, '5');
        },
        "Ctrl-6": function(cm) {
          toggleMarkOfSelectedText(cm, '6');
        },
      },
  };

  function updateCodeMirrorMode(cb) {
    var cm = $scope.cm;
    if (cm === undefined) {
      function wait() {
        if ($scope.cm) {
          $scope.$apply(function() {
            updateCodeMirrorMode();
          });
        } else
          setTimeout(wait, 50);
      }
      setTimeout(wait, 50);
      return;
    }

    if ($scope.codeExt) {
      var mode, spec;
      var info = CodeMirror.findModeByExtension($scope.codeExt);
      if (info) {
        mode = info.mode;
        spec = info.mime;
      }

      if (mode) {
        function modeLoaded()
        {
          $scope.$apply(function() {
            cb(cm);
          });
        }
        if (spec != cm.getOption("mode")) {
          cm.setOption("mode", spec);
          CodeMirror.autoLoadMode(cm, mode);
          function waitModeLoad() {
            var currentMode = $scope.cm.getModeAt(CodeMirror.Pos(0, 0));
            if (currentMode.name != 'null') {
              modeLoaded();
            } else
              setTimeout(waitModeLoad, 200);
          }
          setTimeout(waitModeLoad, 200);
          return;
        }
      } else {
        alert.error("Could not find editor mode corresponding to " + $scope.codeExt);
      }
    }
    setTimeout(modeLoaded, 0);
  }

  // helper functions

  function setDirty() {
    if (editor.codeDirty === true)
      return;
    $scope.$evalAsync(function() {
      editor.codeDirty = true;
    });
  }
})

;
