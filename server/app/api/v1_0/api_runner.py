from ..decorators import json
from . import api
from app.runner import runners

@api.route('/runners', methods=['GET'])
@json
def get_runners():
    res = []
    for _, runner in runners.getItems():
        r = runner.dump()
        res.append(r)
    return dict(entries=res)
