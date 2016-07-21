from app import app
from concurrent.futures.thread import ThreadPoolExecutor

log = app.logger

executor = ThreadPoolExecutor(max_workers=3)

def submitTask(taskFn):
    log.debug("Submit task %r" % taskFn)
    executor.submit(taskFn)
