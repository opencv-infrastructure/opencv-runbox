import json
import os
import shutil
import time

from werkzeug.exceptions import abort

from config import datadir
from . import app
from .helpers import LoadableObject, gen_unique_id
from .storage import Storage
from .account import check_access, get_user_id
import app.account as account

log = app.logger

class Workspace(LoadableObject):
    id_ = None
    workdir = None
    url = None
    meta = None

    storage = None

    def __init__(self, workdir, url, id_=None):
        self.workdir = workdir
        self.url = url
        self.id_ = id_
        super(Workspace, self).__init__()

    def _reset(self):
        self.meta = None
        self.storage = None

    def _load(self):
        metaFile = os.path.join(self.workdir, 'meta.json')
        try:
            with open(metaFile, 'r') as f:
                self.meta = json.load(f)
        except:
            log.error("Can't read workspace meta: %s" % self.workdir)
            self.meta = {}
            self.modified = True
        if not 'timestamp' in self.meta:
            self.meta['timestamp'] = time.time()
            self.modified = True
        if not 'name' in self.meta:
            self.meta['name'] = self.id_
            self.modified = True
        if not 'owner' in self.meta:
            self.meta['owner'] = []
            self.modified = True

        self.storage = {}
        entries = os.listdir(path=self.workdir)
        next_commit_id = 0
        for name in entries:
            try:
                storagedir = os.path.join(self.workdir, name)
                if not os.path.isdir(storagedir):
                    continue
                if name.startswith('commit_'):
                    commit_id = int(name[len('commit_'):])
                    next_commit_id = max(next_commit_id, commit_id + 1)
                elif name == 'storage':
                    commit_id = 'current'
                else:
                    continue
                try:
                    entry = Storage(self, storagedir, self.url + '/storage/' + str(commit_id))
                    self.storage[str(commit_id)] = entry
                except:
                    log.exception("Can't add storage: '%s/%s' into %s" % (name, commit_id, self.workdir))
            except:
                log.error("Can't process storage: '%s' in %s" % (name, self.workdir))
        if self.meta.get('next_commit', None) != next_commit_id:
            self.meta['next_commit'] = next_commit_id
            self.modified = True

    def _save(self):
        self.meta['timestamp'] = time.time()

        metaFile = os.path.join(self.workdir, 'meta.json')
        metaFileNew = metaFile + ".new"
        with open(metaFileNew, 'w') as f:
            json.dump(self.meta, f, indent=2)
        os.renames(metaFileNew, metaFile)

    def check_read_access(self):
        if self.meta.get('public', None):
            return True
        owner_list = self.meta.get('owner', None)
        if not isinstance(owner_list, list):
            owner_list = [owner_list]
        return check_access(owner_list)

    def check_write_access(self):
        owner_list = self.meta.get('owner', None)
        return check_access(owner_list)

    def validate_read_access(self):
        if not self.check_read_access():
            abort(403)

    def validate_write_access(self):
        if not self.check_write_access():
            abort(403)

    def dump(self):
        assert self.meta is not None
        self.validate_read_access()
        res = self.meta.copy()
        del res['next_commit']
        if self.id_:
            res['id'] = self.id_
        res['url'] = self.url
        operations = []
        operations.append(dict(name='fork', description='Fork', glyphicon='glyphicon-plus'))
        if self.check_write_access():
            operations.append(dict(name='delete', description='Delete', glyphicon='glyphicon-remove', type='danger'))
        else:
            res['readonly'] = True
        res['operations'] = operations
        return res

    def dumpFull(self):
        self.validate_read_access()
        res = self.dump()
        storage = {}
        for (name, s) in self.storage.items():
            with s as s:
                r = s.dump()
                if not self.check_write_access():
                    r['readonly'] = True;
                storage[name] = r
        res['storage'] = storage
        return res

    def dumpStorage(self, storage):
        self.validate_read_access()
        s = self.storage[storage]
        with s as s:
            res = s.dumpFull()
        if storage == 'current':
            def getInt(v):
                try:
                    return int(v)
                except:
                    return -1
            commits = [int(c) for c in self.storage.keys() if c != 'current']
            commits = sorted(commits)
            if len(commits) > 0:
                lastcommit = str(commits[-1])
                if lastcommit in self.storage:
                    s = self.storage[lastcommit]
                    with s as s:
                        res_last = s.dumpFull()
                    for k in ['log', 'outputs']:
                        res[k] = res_last[k]
                    if res_last.get('job', None) in ['queue', 'submit', 'run']:
                        res['job'] = res_last['job']
                        res['operations'] = res_last['operations']
        return res

    def update(self, **fields):
        self.validate_write_access()
        log.info('Update "%s" in %s' % (','.join(fields.keys()), self.workdir))
        for (k, v) in fields.items():
            if k in ['name', 'description']:
                if len(v) > 0:
                    self.meta[k] = v
                else:
                    if k in self.meta:
                        del self.meta[k]
            else:
                abort(403)
        self.modified = True

    def commit(self):
        self.validate_write_access()
        account.check_rate_limit_commit()
        while True:
            commit_id = self.meta['next_commit'] or 0
            self.meta['next_commit'] = commit_id + 1

            storagedir = os.path.join(self.workdir, 'commit_%s' % commit_id)
            if os.path.isdir(storagedir):
                log.error("Commit already exists: %s" % storagedir)
                continue
            else:
                # shutil creates dir: os.makedirs(storagedir, exist_ok=True)
                break

        s = self.storage['current']
        shutil.copytree(s.workdir, storagedir, copy_function=os.link)

        storage = Storage(self, storagedir, url='%s/storage/%s' % (self.url, str(commit_id)))
        self.storage[commit_id] = storage
        with storage as s:
            s.meta['readonly'] = True
            s.modified = True
        log.info("Commit created: %s" % storage.workdir)
        self.modified = True
        return storage

    def restore(self, storage):
        self.validate_write_access()
        self.commit()
        with self.storage[storage] as src:
            with self.storage['current'] as dst:
                for (k, v) in src.meta.items():
                    if k in ['job', 'readonly']:
                        continue
                    dst.meta[k] = v
                dst.updateCode(src.getCode())
                dst.modified = True
        return self.storage['current']

    def deleteStorage(self, storage):
        self.validate_write_access()
        s = self.storage[storage]
        with s as s:
            if s.isJobLaunched():
                abort(403)
        del self.storage[storage];
        try:
            shutil.rmtree(s.workdir)
        except:
            log.exception("Can't delete workspace storage '%s': %s" + (storage, self.workdir))
            abort(500)

class Workspaces(object):
    workspaces_dir = None
    workspaces = None
    def __init__(self, basedir):
        self.workspaces_dir = workspace_dir = os.path.join(basedir, 'workspaces')
        entries = os.listdir(path=workspace_dir)
        self.workspaces = {}
        for id_ in entries:
            workdir = os.path.join(workspace_dir, id_)
            if os.path.isdir(workdir):
                try:
                    self.workspaces[id_] = Workspace(workdir, url='workspace/' + id_, id_=id_)
                except:
                    log.exception("Can't register workspace: " + id_)
        log.info("Load workspaces: %d" % len(self.workspaces.keys()))

    def find_or_404(self, id_):
        if not id_ in self.workspaces:
            workdir = os.path.join(self.workspaces_dir, id_)
            if not os.path.exists(workdir) or not os.path.isdir(workdir):
                abort(404)
            try:
                self.workspaces[id_] = Workspace(workdir, 'workspace/' + id_, id_)
            except:
                log.exception("Can't register workspace: " + id_)
                abort(500)
        return self.workspaces[id_]

    def fork(self, baseWorkspace, baseStorage):
        account.check_rate_limit_fork()
        with baseWorkspace as base:  # check base workspace
            for new_id in gen_unique_id():
                workdir = os.path.join(self.workspaces_dir, new_id)
                if not os.path.exists(workdir):
                    break
            os.makedirs(workdir, exist_ok=True)
            storagedir = os.path.join(workdir, 'storage')
            storage = base.storage[baseStorage]
            with storage as s:
                shutil.copytree(s.workdir, storagedir, copy_function=os.link)
            shutil.copy(os.path.join(base.workdir, 'meta.json'), os.path.join(workdir, 'meta.json'))
            w = Workspace(workdir, 'workspace/' + new_id, new_id)
            with w as w:
                w.meta['base'] = baseWorkspace.meta.get('name', None)
                w.meta['public'] = False
                w.meta['owner'] = [get_user_id()]
                w.modified = True
        self.workspaces[new_id] = w
        return w

    def delete(self, id_):
        w = self.find_or_404(id_)
        with w as w:
            w.validate_write_access()
        del self.workspaces[id_]
        try:
            shutil.rmtree(w.workdir)
        except:
            log.exception("Can't delete workspace: " + id_)
            abort(500)

    def getItems(self):
        return [(k, w) for (k, w) in self.workspaces.items() if w.loadAndCall(lambda w: w.check_read_access())]


workspaces = Workspaces(datadir)
