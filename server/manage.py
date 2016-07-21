#!/usr/bin/env python
import os

from flask import Flask

from app import app
from flask.ext.script import Manager


manager = Manager(app)

@manager.command
def test():
    from subprocess import call
    call(['nosetests', '-v',
          '--with-coverage', '--cover-package=app', '--cover-branches',
          '--cover-erase', '--cover-html', '--cover-html-dir=cover'])


if __name__ == '__main__':
    manager.run()
