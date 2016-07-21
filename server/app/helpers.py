import os
import threading
import sys
import subprocess
from builtins import Exception
import base64
from flask.globals import request
from flask.helpers import send_file
from werkzeug.http import parse_range_header
from werkzeug import abort
from flask.wrappers import Response
import mimetypes
from . import app
import time



class BackgroundProcess(threading.Thread):
    """
    Usage example:

        with BackgroundProcess(args=launch_args, cwd=rundir) as bp:
            bp.join(timeout)
            if bp.is_alive():
                sys.stderr.write('\n#TIMEOUT. TERMINATING\n')
                sys.stderr.flush()
                try:
                    bp.process.terminate()
                except:
                    pass
                bp.join()
                return 100

            if bp.rc is not 0:
                return 1 if bp.rc is None else bp.rc
    """

    exception = None
    stdout = None
    stderr = None
    rc = None

    def __init__(self, **args):
        self.args = args
        self.process = None

        threading.Thread.__init__(self)

    def run(self):
        try:
            sys.stdout.flush()
            sys.stderr.flush()
            if not 'stdout' in self.args:
                self.args['stdout'] = subprocess.PIPE
            if not 'stderr' in self.args:
                self.args['stderr'] = subprocess.PIPE
            self.process = subprocess.Popen(**self.args)
            self.stdout, self.stderr = self.process.communicate()
            self.rc = self.process.returncode
        except Exception as e:
            self.exception = e

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, _type, value, tb):
        if self.is_alive():
            print('Terminate subprocess on exit')
            try:
                self.process.terminate()
            except:
                pass

class TimoutException(Exception):
    pass

def executeProcess(**kwargs):
    timeout = kwargs.pop('timeout', 60)
    with BackgroundProcess(**kwargs) as bp:
        bp.join(timeout)
        if bp.is_alive():
            sys.stderr.write('\n#TIMEOUT. TERMINATE child process %r\n' % kwargs['args'])
            sys.stderr.flush()
            try:
                bp.process.terminate()
            except:
                pass
            bp.join()
            raise TimoutException

        return (bp.rc is 0, bp.stdout, bp.stderr)



class LoadableObject(object):
    modified = None

    def __init__(self):
        self.lock = threading.RLock()
        self.lockCount = 0
        self.modified = None
        self._reset()

    def __enter__(self):
        if not self.lock.acquire(blocking=False):
            app.logger.debug("Wait for lock: %r" % self)
            start_time = time.time()
            self.lock.acquire()
            elapsed_time = time.time() - start_time
            app.logger.debug("Lock acquired in %.3f seconds: %r" % (elapsed_time, self))
        self.lockCount += 1
        if self.lockCount > 1:
            return self  # recursive
        self.modified = False
        try:
            self._load()
        except:
            self.lockCount -= 1
            assert self.lockCount == 0
            self.modified = None
            self._reset()
            self.lock.release()
            raise
        return self

    def __exit__(self, _type, value, tb):
        self.lockCount -= 1
        assert self.lockCount >= 0
        if self.lockCount == 0:
            if self.modified:
                self.modified = None
                self._save()
            self._reset()
        else:
            pass  # recursive unload
        self.lock.release()

    def _reset(self):
        raise NotImplementedError()

    def _load(self):
        raise NotImplementedError()

    def _save(self):
        raise NotImplementedError()

    def loadAndCall(self, fn):
        with self as o:
            return fn(o)


def gen_unique_id(min_length=3, num_try=20):
    id_len = min_length
    while True:
        for _ in range(num_try):
            bytes_ = bytearray(os.urandom(id_len))
            generated_id = base64.urlsafe_b64encode(bytes_).decode('utf-8')[:id_len]
            yield generated_id
        id_len += 1

def get_unique_id(uniqueValidatorFn=None, min_length=3, num_try=20):
    for generated_id in gen_unique_id(min_length=min_length, num_try=num_try):
        if uniqueValidatorFn is None or uniqueValidatorFn(generated_id):
            return generated_id

def send_file_partial(filePath):
    range_header = request.range
    if not range_header: return send_file(filePath)

    if range_header.units != 'bytes' or len(range_header.ranges) != 1:
        abort(400)

    size = os.path.getsize(filePath)
    content_range = range_header.make_content_range(size)

    app.logger.debug("Send file %s: %s" % (content_range, filePath))

    length = content_range.stop - content_range.start

    def data_generator(length=length):
        buffer_size = 8192
        with open(filePath, 'rb') as fp:
            fp.seek(content_range.start)
            while length > 0:
                data = fp.read(min(length, buffer_size))
                length -= len(data)
                yield data

    rv = Response(data_generator(),
        206,
        mimetype=mimetypes.guess_type(filePath)[0],
        direct_passthrough=True)

    rv.headers.add('Content-Range', content_range.to_header())

    return rv
