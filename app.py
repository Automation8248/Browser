from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from models import db, User

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secure_secret_key_here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///browser.db'
db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        action = request.form.get('action')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if action == 'register':
            first_name = request.form.get('first_name')
            last_name = request.form.get('last_name')
            user = User.query.filter_by(email=email).first()
            if user:
                flash('Email already exists')
                return redirect(url_for('login'))
            
            new_user = User(
                first_name=first_name, 
                last_name=last_name, 
                email=email, 
                password=generate_password_hash(password, method='pbkdf2:sha256')
            )
            db.session.add(new_user)
            db.session.commit()
            login_user(new_user)
            return redirect(url_for('browser'))
            
        elif action == 'login':
            user = User.query.filter_by(email=email).first()
            if user and check_password_hash(user.password, password):
                login_user(user)
                return redirect(url_for('browser'))
            flash('Invalid credentials')
    return render_template('login.html')

@app.route('/')
@login_required
def browser():
    return render_template('browser.html', tabs_data=current_user.tabs_data, active_tab=current_user.active_tab)

@app.route('/save_state', methods=['POST'])
@login_required
def save_state():
    data = request.json
    current_user.tabs_data = data.get('tabs_data')
    current_user.active_tab = data.get('active_tab')
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=8080)
