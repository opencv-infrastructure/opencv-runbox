import json
import os
import subprocess

from werkzeug.exceptions import abort

from app import app
from app.helpers import executeProcess
from config import topdir
from . import executor
import traceback
import threading
import time

log = app.logger

job_disable_execution = False
job_limit_time = 45

g_instance = 0
def getNextInstanceId():
    global g_instance
    g_instance += 1
    return "%05d" % g_instance;

active_jobs = {}
active_jobs_lock = threading.Lock()

def isActiveJob(storage_workdir):
    with active_jobs_lock:
        return storage_workdir in active_jobs

def addActiveJob(storage_workdir):
    with active_jobs_lock:
        active_jobs[storage_workdir] = time.time()

def removeActiveJob(storage_workdir):
    with active_jobs_lock:
        t = active_jobs[storage_workdir]
        tdiff = time.time() - t
        del active_jobs[storage_workdir]
        log.info("Job processed in %s seconds" % tdiff)

class Runner(object):
    name = None
    workdir = None

    targets = None

    def __init__(self, name, workdir):
        self.name = name
        self.workdir = workdir
        self._load()
        self._cleanup()

    def _load(self):
        configFile = os.path.join(self.workdir, 'config.json')
        with open(configFile, 'r') as f:
            config = json.load(f)
            assert 'targets' in config
            self.targets = config['targets']

    def _cleanup(self):
        args = [os.path.join(self.workdir, 'runner_clear_all.sh')]
        (res, _stdout, stderr) = executeProcess(args=args, timeout=120, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if not res:
            print(stderr.decode("utf-8"))
            raise Exception("Can't clean runner: " + self.name)

    def getTarget(self, target):
        return self.targets[target]

    def dump(self):
        return dict(runner=self.name, targets=self.targets)

    # run: queue,submit,run,done,cancel,failed
    def submit(self, storage):
        assert not job_disable_execution
        addActiveJob(storage.workdir)
        with storage as s:
            if s.meta.get('job') is not None:
                abort(400)
            s.meta['job'] = 'queue'
            with open(os.path.join(s.workdir, 'src/command_args'), 'w') as f:
                f.write(s.meta.get('runArguments', ''))
            s.modified = True
        instance = getNextInstanceId()
        def job():
            log.info("Execute job for %s" % storage.workdir)
            try:
                with storage as s:
                    if s.meta.get('job', False) == 'cancel':
                        return
                    env = os.environ.copy()
                    env['RUNBOX_TARGET'] = s.meta.get('target', '')
                    s.meta['job'] = 'submit'
                    s.modified = True
                args = [os.path.join(self.workdir, 'runner_run.sh')]
                args += [storage.workdir]
                args += [instance]
                (res, _stdout, stderr) = executeProcess(args=args, timeout=120, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
                if not res:
                    print(stderr.decode("utf-8"))
                    raise Exception("Can't launch job: " + storage.workdir)
                with storage as s:
                    if s.meta['job'] == 'submit':
                        s.meta['job'] = 'run'
                        s.modified = True
                args = [os.path.join(self.workdir, 'runner_fetch.sh')]
                args += [storage.workdir]
                args += ['%s' % job_limit_time]
                (res, _stdout, stderr) = executeProcess(args=args, timeout=job_limit_time + 120, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if not res:
                    print(stderr.decode("utf-8"))
                    raise Exception("Job failed: " + storage.workdir)
                with storage as s:
                    if s.meta['job'] == 'run':
                        s.meta['job'] = 'done'
                        s.modified = True
            except:
                with storage as s:
                    s.meta['job'] = 'failed'
                    s.modified = True
                traceback.print_exc()
            finally:
                log.info("Completed job for %s" % storage.workdir)
                removeActiveJob(storage.workdir)
        executor.submitTask(job)

    def cancel(self, storage):
        log.info("Cancel job for %s" % storage.workdir)
        with storage as s:
            s.meta['job'] = 'cancel'
            s.modified = True
        args = [os.path.join(self.workdir, 'runner_cancel.sh')]
        args += [storage.workdir]
        (res, _stdout, stderr) = executeProcess(args=args, timeout=120, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if not res:
            print(stderr.decode("utf-8"))
            raise Exception("Can't cancel job: " + storage.workdir)

class Runners(object):
    runners = {}
    def __init__(self, basedir):
        runner_dir = os.path.join(basedir, 'runner')
        entries = os.listdir(path=runner_dir)
        for name in entries:
            workdir = os.path.join(runner_dir, name)
            if os.path.isdir(workdir):
                try:
                    self.runners[name] = Runner(name, workdir)
                except:
                    log.exception("Can't register runner: " + name)
        log.info("Runners: %s" % ', '.join(sorted(self.runners.keys())))
        pass

    def find_or_404(self, name):
        if not name in self.runners:
            abort(404)
        return self.runners[name]

    def getItems(self):
        return self.runners.items()

runners = Runners(topdir)
