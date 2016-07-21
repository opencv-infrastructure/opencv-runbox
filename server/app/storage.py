import json
import os
import time

from werkzeug.exceptions import abort

from app import app
from app.helpers import LoadableObject
from app.runner import runners, isActiveJob
import code
import re
import app.account as account
import shutil

log = app.logger

class Storage(LoadableObject):
    workspace = None
    workdir = None
    url = None
    meta = None

    def __init__(self, workspace, workdir, url):
        self.workspace = workspace
        self.workdir = workdir
        self.url = url
        super(Storage, self).__init__()
        if not isActiveJob(workdir):
            with self as s:
                if s.meta.get('job', None) in ['queue', 'submit', 'run']:
                    log.warning("Job died for storage: %s" % s.workdir)
                    s.meta['job'] = 'failed'
                    s.modified = True

    def _reset(self):
        self.meta = None

    def _load(self):
        try:
            metaFile = os.path.join(self.workdir, 'meta.json')
            with open(metaFile, 'r') as f:
                self.meta = json.load(f)
        except:
            log.error("Can't load meta: " + self.workdir)
            self.meta = {}
            self.meta['timestamp'] = os.path.getmtime(self.workdir)
            pass
        self._updateCodePathLocation()

    def _updateCodePathLocation(self):
        try:
            self.base_code_path = None
            if 'runner' in self.meta and 'target' in self.meta:
                self.base_code_path = self.getRunnerTarget()['code']
        except:
            log.exception('Code path is not available: %s' % self.workdir)

    def _save(self):
        try:
            new_code_path = None
            if 'runner' in self.meta and 'target' in self.meta:
                new_code_path = self.getRunnerTarget()['code']
        except:
            log.exception('New code path is not available: %s' % self.workdir)
        if self.base_code_path != new_code_path:
            try:
                log.debug("Moving code: %s" % self.workdir)
                log.debug("from: %r to %r" % (self.base_code_path, new_code_path))
                code = self._getCode(self.base_code_path)
                self._removeCode(self.base_code_path)
                self._updateCode(new_code_path, code)
            except:
                log.exception("Can't change code location: %s" % self.workdir)

        self.meta['timestamp'] = time.time()

        metaFile = os.path.join(self.workdir, 'meta.json')
        metaFileNew = metaFile + ".new"
        with open(metaFileNew, 'w') as f:
            json.dump(self.meta, f, indent=2)
        os.renames(metaFileNew, metaFile)

    def getRunner(self):
        assert 'runner' in self.meta
        r = runners.find_or_404(self.meta['runner'])
        return r

    def getRunnerTarget(self):
        r = self.getRunner()
        rt = r.getTarget(self.meta['target'])
        return rt

    def isJobLaunched(self):
        return self.meta.get('job', None) in ['queue', 'submit', 'run']

    def dump(self, full=False):
        self.workspace.validate_read_access()
        assert self.meta is not None
        res = self.meta.copy()
        res['url'] = self.url
        if not full:
            if 'codeFoldLines' in res:
                del res['codeFoldLines']
            if 'codeHighlights' in res:
                del res['codeHighlights']
        if full:
            operations = []
            operations.append(dict(name='fork', description='Fork', glyphicon='glyphicon-plus'))
            if self.workspace.check_write_access():
                operations.append(dict(name='delete', description='Delete', glyphicon='glyphicon-remove', type='danger'))
                if not self.meta.get('public', False) and not self.meta.get('readonly', False) and account.is_admin():
                    operations.append(dict(name='publish', description='Publish', glyphicon='glyphicon-share', type='warning'))
            for op in operations:
                op['url'] = self.url
            res['operations'] = operations
        if not self.meta.get('readonly', False) and not self.workspace.check_write_access():
            res['readonly'] = True
        return res

    def dumpFull(self):
        self.workspace.validate_read_access()
        res = self.dump(True)
        operations = res['operations']
        if self.workspace.check_write_access():
            if self.meta.get('job', None) is None:
                operations.append(dict(name='run', description='Run', glyphicon='glyphicon-play', type='success'))
            if self.isJobLaunched():
                operations.append(dict(name='stop', description='Stop', glyphicon='glyphicon-stop', type='danger'))
        operations_order = ['run', 'stop', 'delete', 'fork', 'publish']
        operations.sort(key=lambda x: operations_order.index(x['name']))
        for op in operations:
            op['url'] = self.url
        res['inputs'] = self.getInputs()
        res['code'] = self.getCode()
        res['codeExt'] = self.getRunnerTarget()['codeExt']
        res['outputs'] = self.getOutputs()
        res['log'] = self.getLog()
        return res

    def update(self, **fields):
        self.workspace.validate_write_access()
        log.info('Update "%s" in %s' % (','.join(fields.keys()), self.workdir))
        assert self.meta.get('readonly', False) == False
        for (k, v) in fields.items():
            if k in ['runArguments', 'runner', 'target', 'codeHighlights', 'codeFoldLines']:
                if k == 'runner':
                    assert v in dict(runners.getItems())
                elif k == 'target':
                    assert v in dict(runners.getItems())[fields.get('runner', self.meta['runner'])].targets
                if len(v) > 0:
                    self.meta[k] = v
                else:
                    if k in self.meta:
                        del self.meta[k]
                self.modified = True
            elif k == 'code':
                pass  # only after runner and target
            else:
                abort(403)
        if 'code' in fields:
            self.updateCode(fields['code'])
        self.modified = True

    def _getCode(self, code_path):
        if code_path is None:
            if 'code' in self.meta:
                return self.meta['code']
            else:
                return ''
        fileName = os.path.join(self.workdir, code_path)
        if os.path.exists(fileName):
            with open(fileName, 'r') as f:
                return f.read()
        log.warning("Code not found: %s" % fileName)
        return ''

    def getCode(self):
        if 'code' in self.meta:
            return self._getCode(None)
        code_path = self.getRunnerTarget()['code']
        return self._getCode(code_path)

    def _updateCode(self, code_path, code):
        self._updateCodePathLocation()
        if code_path is None:
            self.meta['code'] = code
            self.modified = True
            return
        fileName = os.path.join(self.workdir, code_path)
        dirName = os.path.dirname(fileName)
        os.makedirs(dirName, exist_ok=True)
        fileNameNew = fileName + '.new'
        with open(fileNameNew, 'w') as f:
            f.write(code)
        os.renames(fileNameNew, fileName)
        self.modified = True

    def updateCode(self, code):
        self.workspace.validate_write_access()
        if self.meta.get('readonly'):
            abort(403)
        if 'code' in self.meta:
            return self._updateCode(None)
        code_path = self.getRunnerTarget()['code']
        return self._updateCode(code_path, code)

    def _removeCode(self, code_path):
        if code_path is None:
            del self.meta['code']
            self.modified = True
            return
        fileName = os.path.join(self.workdir, code_path)
        if os.path.exists(fileName):
            try:
                os.remove(fileName)
            except:
                log.exception("Can't remove file: %s" % fileName)
        self.modified = True

    def _dumpFiles(self, workdir, urlPrefix, files=None):
        if files is None:
            files = os.listdir(path=workdir)
        def mtime(e):
            try:
                return os.path.getmtime(os.path.join(workdir, e))
            except:
                return time.time()
        files = [dict(name=e, url=urlPrefix + e, size=os.path.getsize(os.path.join(workdir, e)), timestamp=mtime(e)) for e in sorted(files)]
        return files

    def getInputs(self):
        self.workspace.validate_read_access()
        try:
            workdir = os.path.join(self.workdir, 'input');
            urlPrefix = self.url + '/file/input/'
            return self._dumpFiles(workdir, urlPrefix)
        except:
            return []

    def getOutputs(self):
        self.workspace.validate_read_access()
        try:
            workdir = os.path.join(self.workdir, 'output');
            urlPrefix = self.url + '/file/output/'
            files = os.listdir(path=workdir)
            files = [f for f in files if f != '.runbox_log' and f != 'input']
            return self._dumpFiles(workdir, urlPrefix, files)
        except:
            return []

    def getLog(self):
        self.workspace.validate_read_access()
        logFile = os.path.join(self.workdir, 'output/.runbox_log')
        if os.path.exists(logFile):
            with open(logFile, 'r') as f:
                data = f.read()
                data = data.replace('\t', '    ');
                data = re.sub(r'(^|\r?\n)([^ ]+:\d\d)(.\d[^ ]+)', r'\1\2', data)
                return data
        return None

    def getFileLocation(self, fileName):
        self.workspace.validate_read_access()
        res = os.path.join(self.workdir, fileName)
        if not (res.startswith(os.path.join(self.workdir, 'input')) or res.startswith(os.path.join(self.workdir, 'output'))):
            abort(403)
        return res


    def submitJob(self):
        self.workspace.validate_write_access()
        account.check_rate_limit_run()
        self.getRunner().submit(self)

    def cancelJob(self):
        self.workspace.validate_write_access()
        self.getRunner().cancel(self)

    def upload(self, file):
        self.workspace.validate_write_access()
        if self.meta.get('readonly'):
            abort(403)
        fileName = file.filename
        log.info("Upload file: %s" % fileName)
        targetDir = os.path.join(self.workdir, 'input')
        targetFile = os.path.join(targetDir, fileName)
        assert os.path.dirname(targetFile) == targetDir
        if os.path.exists(targetFile):
            os.unlink(targetFile)
        with open(targetFile, "wb") as f:
            shutil.copyfileobj(file, f)
        log.info("Upload file done: %s" % targetFile)
