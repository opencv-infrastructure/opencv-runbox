import os

from flask import Flask
from flask.json import JSONEncoder

from config import basedir, topdir
from logging import INFO, DEBUG, Formatter, getLogRecordFactory, setLogRecordFactory

class App(Flask):
    initialized = False

    def init(self):
        if self.initialized:
            return self
        self.initialized = True

        old_factory = getLogRecordFactory()
        def record_factory(*args, **kwargs):
            record = old_factory(*args, **kwargs)
            if record.pathname.startswith(topdir):
                record.pathname = record.pathname[len(topdir) + 1:]
            if len(record.pathname) > 32:
                record.pathname = record.pathname[-32:]
            record.codelocation = "%s:%d" % (record.pathname, record.lineno)
            return record
        setLogRecordFactory(record_factory)

        if app.debug:
            formatter = Formatter("[%(asctime)s] %(codelocation)-32s %(levelname)s - %(message)s")
            for handler in app.logger.handlers:
                handler.setFormatter(formatter)
            app.logger.setLevel(DEBUG)
            app.logger.info('DEBUG mode')
        else:
            app.logger.setLevel(INFO)
            app.logger.info('PRODUCTION mode')

        if not app.debug:
            import logging
            from config import logdir
            from logging.handlers import RotatingFileHandler
            file_handler = RotatingFileHandler(os.path.join(logdir, 'server.log'), 'a',
                                               1 * 1024 * 1024, 10)
            file_handler.setLevel(logging.INFO)
            file_handler.setFormatter(logging.Formatter(
                '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'))
            app.logger.addHandler(file_handler)
            app.logger.setLevel(logging.INFO)
            app.logger.info('startup')

        from app import sessions

        sessions.register(self)

        from app import views
        from app import account, runner, workspace, code_template

        from .api.v1_0 import api as api_blueprint
        app.register_blueprint(api_blueprint, url_prefix='/api/v1.0')

        return self

    def get_send_file_max_age(self, name):
        if app.debug:
            return 0
        if name.lower().endswith('.css'):
            return 300
        if name.lower().endswith('.js'):
            return 300
        if name.lower().endswith('.html'):
            return 300
        return Flask.get_send_file_max_age(self, name)

    def run(self, *args, **kwargs):
        debug = kwargs.get('debug', None)
        if debug is not None:
            self.debug = bool(debug)
        self.init()
        Flask.run(self, *args, **kwargs)

app = App(__name__, static_folder=os.path.join(topdir, 'frontend/build'))
app.config.from_object(os.environ.get('FLASK_CONFIG', 'config'))
