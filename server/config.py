# -*- coding: utf8 -*-
import os
basedir = os.path.abspath(os.path.dirname(__file__))
topdir = os.path.abspath(os.path.join(basedir, '..'))
datadir = os.path.abspath(os.environ.get('RUNBOX_DATA_DIR', os.path.join(topdir, 'data')))
logdir = os.path.abspath(os.environ.get('RUNBOX_LOG_DIR', os.path.join(topdir, 'log')))

SESSION_PATH = os.path.join(datadir, 'sessions')
SECRET_KEY = os.environ.get('RUNBOX_SECRET_KEY', os.urandom(32))

#TRAP_HTTP_EXCEPTIONS = True

