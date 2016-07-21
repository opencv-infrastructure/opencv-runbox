import os

from werkzeug.exceptions import abort

from app import app, account
from config import datadir

from .workspace import Workspace, workspaces
from app.helpers import gen_unique_id
import shutil

log = app.logger

class Templates(object):
    templates_dir = None
    templates = {}
    def __init__(self, basedir):
        self.templates_dir = template_dir = os.path.join(basedir, 'templates')
        entries = os.listdir(path=template_dir)
        for id_ in entries:
            workdir = os.path.join(template_dir, id_)
            if os.path.isdir(workdir):
                try:
                    self.templates[id_] = Workspace(workdir, 'template/' + id_, id_=id_)
                except:
                    log.exception("Can't register template: " + id_)
        log.info("Load templates: %d" % len(self.templates.keys()))

    def find_or_404(self, name):
        if not name in self.templates:
            workdir = os.path.join(self.templates_dir, name)
            if not os.path.exists(workdir) or not os.path.isdir(workdir):
                abort(404)
            try:
                self.templates[name] = Workspace(workdir, 'template/' + name, name=name)
            except:
                log.exception("Can't register template: " + name)
                abort(500)
        return self.templates[name]

    def fork(self, baseWorkspace, baseStorage):
        return workspaces.fork(baseWorkspace, baseStorage)

    def publish(self, baseWorkspace):
        assert account.is_admin()
        with baseWorkspace as base:  # check base workspace
            for new_id in gen_unique_id():
                workdir = os.path.join(self.templates_dir, new_id)
                if not os.path.exists(workdir):
                    break
            os.makedirs(workdir, exist_ok=True)
            storagedir = os.path.join(workdir, 'storage')
            storage = base.storage['current']
            with storage as s:
                shutil.copytree(s.workdir, storagedir, copy_function=os.link)
            shutil.copy(os.path.join(base.workdir, 'meta.json'), os.path.join(workdir, 'meta.json'))
            w = Workspace(workdir, 'template/' + new_id, new_id)
            with w as w:
                w.meta['base'] = None
                w.meta['public'] = True
                w.meta['owner'] = [account.get_user_id()]
                w.modified = True
        self.templates[new_id] = w
        return w

    def getItems(self):
        return [(k, w) for (k, w) in self.templates.items() if w.loadAndCall(lambda w: w.check_read_access())]

templates = Templates(datadir)
