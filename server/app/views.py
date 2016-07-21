from app import app

@app.after_request
def after_request(response):
    return response


@app.errorhandler(404)
def not_found_error(error):
    return "Not found 404", 404


@app.errorhandler(500)
def internal_error(error):
    return "Server error 500", 500


@app.route('/', methods=['GET'], defaults={'url':'index.html'})
@app.route('/<path:url>', methods=['GET'])
def frontend_files(url):
    return app.send_static_file(url)
