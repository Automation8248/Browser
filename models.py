from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    tabs_data = db.Column(db.Text, default='[{"id":"tab-1", "url":"https://www.bing.com", "title":"New Tab"}]')
    active_tab = db.Column(db.String(50), default='tab-1')
