import functools
import time
from flask.globals import session, request
from flask import redirect
from werkzeug import abort
from uuid import uuid4
from .utils import RateLimiter
from collections import defaultdict
import json

from app import app
from flask.helpers import url_for

log = app.logger

if app.debug:
    rate_limit_registration_global = RateLimiter(3, timeUnit=60)
else:
    rate_limit_registration_global = RateLimiter(50, timeUnit=10)

rate_limit_run_per_uid = defaultdict(lambda: RateLimiter(5, 30))
rate_limit_fork_per_uid = defaultdict(lambda: RateLimiter(5, 60))
rate_limit_commit_per_uid = defaultdict(lambda: RateLimiter(5, 30))

def user_or_guest(f):
    @functools.wraps(f)
    def wrapped(*args, **kwargs):
        if not 'user' in session:
            if not rate_limit_registration_global():
                abort(403)
            session.permanent = True
            session['user'] = 'Guest'
            session['user_id'] = str(uuid4())
            session['create_info'] = _get_info()
            log.info('Create new guest accont:\n%s' % json.dumps(session['create_info'], indent=2))
            session['timestamp'] = time.time()
        rv = f(*args, **kwargs)
        return rv
    return wrapped

def login_required(forbiddenCallback=None):
    def decorator(f):
        @functools.wraps(f)
        def wrapped(*args, **kwargs):
            if not 'user' in session:
                if forbiddenCallback:
                    return forbiddenCallback()
                else:
                    abort(403)
            rv = f(*args, **kwargs)
            return rv
        return wrapped
    return decorator

def _get_info():
    return dict(remote_addr=list(request.access_route), user_agent=request.user_agent.string)

def get_user_id():
    return session.get('user_id', None)

def is_admin():
    return session.get('user_is_admin', False)

def check_access(owner_list):
    admin = is_admin()
    uid = get_user_id()
    if admin or (owner_list is not None and uid in owner_list):
        return True
    return False

def make_admin():
    session['user_is_admin'] = True

def drop_admin():
    if 'user_is_admin' in session:
        del session['user_is_admin']

def check_rate_limit_run():
    admin = is_admin()
    if admin:
        return;
    uid = get_user_id()
    if not rate_limit_run_per_uid[uid]():
        abort(403)

def check_rate_limit_fork():
    admin = is_admin()
    if admin:
        return;
    uid = get_user_id()
    if not rate_limit_fork_per_uid[uid]():
        abort(403)

def check_rate_limit_commit():
    admin = is_admin()
    if admin:
        return;
    uid = get_user_id()
    if not rate_limit_commit_per_uid[uid]():
        abort(403)

@app.route('/login/replace', methods=['GET'])
@user_or_guest
def login_replace():
    target_uid = request.args.get('uid', None)
    confirm = request.args.get('confirm', None)
    if target_uid:
        if confirm:
            set_user_id(target_uid)
            return redirect('/')
        else:
            uid = get_user_id()
            return 'Your current user ID is \'%s\'.<br/>Replace it to \'%s\'?<br/><a href="%s">Do it!</a>' % (uid, target_uid, url_for('login_replace', uid=uid, confirm=True))
    abort(403)

def set_user_id(uid):
    assert isinstance(uid, str) and len(uid) > 0
    log.warning("Change user ID from %s to %s" % (session.get('user_id', 'unknown'), uid))
    session['user_id'] = uid

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return redirect('/')

@app.route('/login', methods=['GET', 'POST'])
@user_or_guest
def login():
    if request.method == 'POST':
        return redirect("/")
    page = """
<a href="/">Home</a><br/>
<form action="/logout" method="post"><input type="submit" value="Logout (all access to workspaces will be lost)"></form>
"""
    if request.args.get('admin'):
        page += """
<form action="/login/admin" method="post">
 Admin password: <input type="password" name="password"><br>
 <input type="submit" value="Admin login">
</form>
"""
    if is_admin():
        page += """
<form action="/login/admin/logout" method="post">
 <input type="submit" value="Admin logout">
</form>
"""
    uid = get_user_id()
    page += '<a href="%s">Link to replace user ID to current (DANGER, keep in secret, use carefull)</a>' % url_for('login_replace', uid=uid)
    return page

@app.route('/login/admin', methods=['POST'])
@user_or_guest
def login_admin():
    pwd = request.form.get('password', None)
    if pwd is None or not isinstance(pwd, str):
        abort(403)
    import hashlib
    if hashlib.md5(pwd.encode()).hexdigest() == '52793b67f1e21817a15039f62f1041b9':
        make_admin()
        return redirect("/")
    return redirect(request.referrer)

@app.route('/login/admin/logout', methods=['POST'])
@user_or_guest
def logout_admin():
    drop_admin()
    return redirect(request.referrer)
