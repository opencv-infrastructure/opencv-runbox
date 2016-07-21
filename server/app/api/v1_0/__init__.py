from flask import Blueprint, g
from ..errors import ValidationError, bad_request, not_found

api = Blueprint('api', __name__)


@api.errorhandler(ValidationError)
def validation_error(e):
    return bad_request(e.args[0])


@api.errorhandler(400)
def bad_request_error(e):
    return bad_request('invalid request')


@api.errorhandler(404)
def not_found_error(e):
    return not_found('item not found')


@api.before_request
def before_request():
    pass


@api.after_request
def after_request(response):
    if hasattr(g, 'headers'):
        response.headers.extend(g.headers)
    return response


from . import api_workspace
from . import api_runner

@api.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'])
def invalid_path(path):
    return not_found('invalid path')
