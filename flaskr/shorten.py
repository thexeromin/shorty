import functools
import uuid

from flask import (
    Blueprint, flash, g, request, redirect
)
from flaskr.db import get_db

bp = Blueprint('shorten', __name__)


@bp.route('/', methods=['POST'])
def shorten_url():
    url = request.form['url']
    key = str(uuid.uuid4())[:4]
    db = get_db()
    error = None

    if not url:
        error = 'url is required.'
    
    if error is None:
        try:
            db.execute(
                "INSERT INTO data (url, key) VALUES (?, ?)",
                (url, key),
            )
            db.commit()
        except db.IntegrityError:
            error = f"{url} is already exists."
        else:
            return f"{request.url_root}{key}"
    
    flash(error)


@bp.route('/<key>', methods=['GET'])
def get_url(key):
    db = get_db()
    error = None
    data = db.execute(
        'SELECT * FROM data WHERE key = ?', (key,)
    ).fetchone()

    if data is None:
        error = 'No url found.'
    
    if error is None:
        return redirect(data['url'])
    
    flash(error)