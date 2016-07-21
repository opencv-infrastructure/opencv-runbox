# Based on public domain code: http://flask.pocoo.org/snippets/109/
import os
import pickle

import base64
import hmac
import hashlib

import datetime
from uuid import uuid4
from collections import OrderedDict

from werkzeug.datastructures import CallbackDict
from flask.sessions import SessionInterface, SessionMixin
from base64 import b64encode
import logging

log = logging.getLogger('session')

def _generate_sid():
    return str(uuid4())


def _calc_hmac(body, secret):
    return base64.b64encode(hmac.new(secret, body.encode('utf-8'), hashlib.sha1).digest()).decode('utf-8')


class ManagedSession(CallbackDict, SessionMixin):
    def __init__(self, initial=None, sid=None, new=False, randval=None, hmac_digest=None):
        def on_update(self):
            self.modified = True

        CallbackDict.__init__(self, initial, on_update)
        self.sid = sid
        self.new = new
        self.modified = False
        self.randval = randval
        self.hmac_digest = hmac_digest

    def sign(self, secret):
        if not self.hmac_digest:
            random_bytes = os.urandom(12)
            token = b64encode(random_bytes).decode('utf-8')
            self.randval = token
            self.hmac_digest = _calc_hmac('%s:%s' % (self.sid, self.randval), secret)


class SessionManager(object):
    def new_session(self):
        'Create a new session'
        raise NotImplementedError

    def exists(self, sid):
        'Does the given session-id exist?'
        raise NotImplementedError

    def remove(self, sid):
        'Remove the session'
        raise NotImplementedError

    def get(self, sid, digest):
        'Retrieve a managed session by session-id, checking the HMAC digest'
        raise NotImplementedError

    def put(self, session):
        'Store a managed session'
        raise NotImplementedError


class CachingSessionManager(SessionManager):
    def __init__(self, parent, num_to_store):
        self.parent = parent
        self.num_to_store = num_to_store
        self._cache = OrderedDict()

    def _normalize(self):
        if len(self._cache) > self.num_to_store:
            while len(self._cache) > (self.num_to_store * 0.8):  # flush 20% of the cache
                self._cache.popitem(False)
            log.info("Session cache size: %s" % len(self._cache))

    def new_session(self):
        return self.parent.new_session()

    def remove(self, sid):
        if sid is None:
            return
        self.parent.remove(sid)
        if sid in self._cache:
            del self._cache[sid]

    def exists(self, sid):
        if sid in self._cache:
            return True
        return self.parent.exists(sid)

    def get(self, sid, digest):
        session = None
        if sid in self._cache:
            session = self._cache[sid]
            if session.hmac_digest != digest:
                session = None

            # reset order in OrderedDict
            del self._cache[sid]

        if not session:
            session = self.parent.get(sid, digest)

        self._cache[sid] = session
        self._normalize()
        return session

    def put(self, session):
        self.parent.put(session)
        if session.sid in self._cache:
            del self._cache[session.sid]
        self._cache[session.sid] = session
        self._normalize()


class FileBackedSessionManager(SessionManager):
    def __init__(self, path, secret):
        self.path = path
        self.secret = secret
        if not os.path.exists(self.path):
            os.makedirs(self.path)

    def exists(self, sid):
        fname = os.path.join(self.path, sid)
        return os.path.exists(fname)

    def remove(self, sid):
        log.info('Removing session: %s' % sid)
        fname = os.path.join(self.path, sid)
        if os.path.exists(fname):
            os.unlink(fname)

    def new_session(self):
        # log.info("Created new empty session")
        return ManagedSession()

    def get(self, sid, digest):
        'Retrieve a managed session by session-id, checking the HMAC digest'

        log.info("Looking for session: %s" % sid)

        fname = os.path.join(self.path, sid)
        data = None
        hmac_digest = None
        randval = None

        if os.path.exists(fname):
            try:
                with open(fname, 'rb') as f:
                    randval, hmac_digest, data = pickle.load(f)
            except:
                log.exception("Error loading session file")

        if not data:
            log.error("Missing data?")
            return self.new_session()

        # This assumes the file is correct, if you really want to
        # make sure the session is good from the server side, you
        # can re-calculate the hmac

        if hmac_digest != digest:
            log.error("Invalid HMAC for session")
            return self.new_session()

        return ManagedSession(data, sid=sid, randval=randval, hmac_digest=hmac_digest)

    def put(self, session):
        'Store a managed session'

        if session.sid is None:
            while True:
                sid = _generate_sid()
                fname = os.path.join(self.path, sid)
                if not os.path.exists(fname):
                    break
            session.sid = sid
            # touch the file
            with open(fname, 'w'):
                pass
            log.info("Generate new session: %s" % session.sid)

        log.info("Storing session: %s" % session.sid)

        if not session.hmac_digest:
            session.sign(self.secret)

        fname = os.path.join(self.path, session.sid)
        with open(fname, 'wb') as f:
            pickle.dump((session.randval, session.hmac_digest, dict(session)), f)


class ManagedSessionInterface(SessionInterface):
    def __init__(self, manager, skip_paths):
        self.manager = manager
        self.skip_paths = skip_paths

    def get_expiration_time(self, app, session):
        if session.permanent:
            return datetime.datetime.utcnow() + app.permanent_session_lifetime
        return None

    def open_session(self, app, request):
        cookie_val = request.cookies.get(app.session_cookie_name)

        if not cookie_val or not '!' in cookie_val:
            # Don't bother creating a cookie for static resources
            for sp in self.skip_paths:
                if request.path.startswith(sp):
                    return None

            # log.info('Missing cookie')
            return self.manager.new_session()

        sid, digest = cookie_val.split('!', 1)

        if self.manager.exists(sid):
            return self.manager.get(sid, digest)

        return self.manager.new_session()

    def save_session(self, app, session, response):
        domain = self.get_cookie_domain(app)
        if not session:
            self.manager.remove(session.sid)
            if session.modified:
                response.delete_cookie(app.session_cookie_name, domain=domain)
            return

        expires = self.get_expiration_time(app, session)

        if expires is not None:
            update = False
            if session.modified:
                update = True
            elif '_expires' in session and expires - session['_expires'] > datetime.timedelta(minutes=60):
                update = True
            if update:
                session['_expires'] = expires

        if session.modified:
            self.manager.put(session)
            session.modified = False
        else:
            return

        response.set_cookie(app.session_cookie_name,
                            '%s!%s' % (session.sid, session.hmac_digest),
                            expires=expires, httponly=True, domain=domain)

def register(app):
    global log
    log = app.logger
    app.session_interface = \
        ManagedSessionInterface(
            CachingSessionManager(
                FileBackedSessionManager(app.config['SESSION_PATH'],
                                         app.config['SECRET_KEY']
                ),
                256
            ),
            []
        )
