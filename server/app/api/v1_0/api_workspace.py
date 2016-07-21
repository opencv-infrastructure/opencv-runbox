from flask.globals import request

from ..decorators import json, login_required
from . import api
from ...workspace import workspaces
from ...account import user_or_guest
from ...helpers import send_file_partial
from app.api.errors import bad_request
from app.code_template import templates

def register_workspace_api(prefix, workspaces):
    def route(rule, **options):
        def decorator(f):
            endpoint = options.pop("endpoint", prefix + '_' + f.__name__)
            api.add_url_rule(rule, endpoint, f, **options)
            return f
        return decorator

    @route('/%ss' % prefix, methods=['GET'])
    # @login_required
    @user_or_guest
    @json
    def get_workspaces():
        res = []
        for _, t in workspaces.getItems():
            with t as w:
                r = w.dump()
                r['url'] = '%s/%s' % (prefix, r['id'])
                res.append(r)
        return dict(entries=res)

    @route('/%s/<string:workspace>' % prefix, methods=['GET'])
    @user_or_guest
    @json
    def get_workspace(workspace):
        with workspaces.find_or_404(workspace) as w:
            res = w.dumpFull()
            return res

    @route('/%s/<string:workspace>/storage/<string:storage>' % prefix, methods=['GET'])
    @user_or_guest
    @json
    def get_workspace_storage(workspace, storage):
        with workspaces.find_or_404(workspace) as w:
            res = w.dumpStorage(storage)
            return res

    @route('/%s/<string:workspace>' % prefix, methods=['PUT'])
    @route('/%s/<string:workspace>/storage/<string:storage>' % prefix, methods=['PUT'])
    @login_required
    @json
    def update_workspace(workspace, storage=None):
        fields = request.get_json(silent=True) or {}
        for k in request.form.keys():
            fields[k] = request.form.get(k, type=str)
        if not 'code' in fields:
            file = request.files.get('code', None)
            if file:
                fields['code'] = file.read().decode("utf-8")
        if len(request.args) > 0:
            return bad_request('invalid update parameters')
        with workspaces.find_or_404(workspace) as w:
            if storage is None:
                w.update(**fields)
            else:
                s = w.storage[storage]
                with s as s:
                    s.update(**fields)
            return {'status': 200, 'message': 'updated' }

    @route('/%s/<string:workspace>' % prefix, methods=['DELETE'])
    @route('/%s/<string:workspace>/storage/<string:storage>' % prefix, methods=['DELETE'])
    @login_required
    @json
    def delete_workspace(workspace, storage=None):
        if storage is None or storage == 'current':
            workspaces.delete(workspace)
            next_url = None
        else:
            with workspaces.find_or_404(workspace) as w:
                w.deleteStorage(storage)
            next_url = w.url
        return {'status': 200, 'message': 'deleted', 'url': next_url }

    @route('/%s/<string:workspace>/commit' % prefix, methods=['POST'])
    @login_required
    @json
    def commit_workspace(workspace):
        with workspaces.find_or_404(workspace) as w:
            new_storage = w.commit()
            return ({'status': 201, 'message': 'commited', 'url': new_storage.url }, 201)

    @route('/%s/<string:workspace>/storage/<string:storage>/restore' % prefix, methods=['POST'])
    @login_required
    @json
    def restore_workspace_storage(workspace, storage=None):
        with workspaces.find_or_404(workspace) as w:
            new_storage = w.restore(storage)
            return ({'status': 201, 'message': 'commited', 'url': new_storage.url }, 201)

    @route('/%s/<string:workspace>/fork' % prefix, methods=['POST'])
    @route('/%s/<string:workspace>/storage/<string:storage>/fork' % prefix, methods=['POST'])
    @login_required
    @json
    def fork_workspace(workspace, storage=None):
        if storage is None:
            storage = 'current'
        base = workspaces.find_or_404(workspace)
        w = workspaces.fork(base, storage)
        with w as w:
            w.commit()
        return ({'status': 201, 'message': 'created', 'url': w.url }, 201)

    @route('/%s/<string:workspace>/publish' % prefix, methods=['POST'])
    @route('/%s/<string:workspace>/storage/<string:storage>/publish' % prefix, methods=['POST'])
    @login_required
    @json
    def publish_workspace(workspace, storage=None):
        w = workspaces.find_or_404(workspace)
        res = templates.publish(w)
        return ({'status': 201, 'message': 'published', 'url': res.url }, 201)

    @route('/%s/<string:workspace>/run' % prefix, methods=['POST'])
    @route('/%s/<string:workspace>/storage/<string:storage>/run' % prefix, methods=['POST'])
    @login_required
    @json
    def run_job(workspace, storage=None):
        if storage is None:
            storage = 'current'
        with workspaces.find_or_404(workspace) as w:
            if storage == 'current':
                s = w.commit()
            else:
                s = w.storage[storage]
            with s as s:
                s.submitJob()
                return ({'status': 200, 'message': 'submit', 'url': w.storage['current'].url }, 200)

    @route('/%s/<string:workspace>/storage/<string:storage>/stop' % prefix, methods=['POST'])
    @login_required
    @json
    def cancel_job(workspace, storage=None):
        with workspaces.find_or_404(workspace) as w:
            with w.storage[storage] as s:
                s.cancelJob()
                return ({'status': 200, 'message': 'submit' }, 200)

    @route('/%s/<string:workspace>/storage/<string:storage>/file/<path:fileName>' % prefix, methods=['GET'])
    # @user_or_guest
    def get_workspace_storage_file(workspace, storage, fileName):
        with workspaces.find_or_404(workspace) as w:
            s = w.storage[storage]
            with s as s:
                filePath = s.getFileLocation(fileName)
                return send_file_partial(filePath)

    @route('/%s/<string:workspace>/storage/<string:storage>/upload' % prefix, methods=['POST'])
    @login_required
    @json
    def workspace_upload_file(workspace, storage=None):
        if storage is None:
            storage = 'current'
        with workspaces.find_or_404(workspace) as w:
            with w.storage[storage] as s:
                for (_fileName, file) in request.files.items():
                    s.upload(file)
                return ({'status': 201, 'message': 'submit', 'url': s.url }, 201)

register_workspace_api('template', templates)
register_workspace_api('workspace', workspaces)
