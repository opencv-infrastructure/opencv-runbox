from collections import deque
import time
from threading import RLock

class RateLimiter:
    def __init__(self, maxRate=5, timeUnit=1):
        self.lock = RLock()
        self.timeUnit = timeUnit
        self.deque = deque(maxlen=maxRate)

    def __call__(self):
        with self.lock:
            if self.deque.maxlen == len(self.deque):
                cTime = time.time()
                if cTime - self.deque[0] > self.timeUnit:
                    self.deque.append(cTime)
                    return True
                else:
                    return False
            self.deque.append(time.time())
            return True
