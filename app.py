from flask import Flask, flash,render_template, session,request,redirect,url_for, jsonify
import sqlite3
import joblib
from werkzeug.security import generate_password_hash, check_password_hash
from database import DATABASE_NAME,get_all_users,insert_user,get_user_by_email,get_all_predictions,insert_prediction_from_csv, get_predictions_by_class,get_predictions_by_regno # <-- ADDED get_predictions_by_class

#Load ML components
try:
    MODEL = joblib.load('models/performance_model.pkl')
    FEATURES = joblib.load('models/model_features.joblib')
    SCALER = joblib.load('models/model_scaler.joblib')
    OUTPUT_COLS = joblib.load('models/output_columns.joblib')
    print("ML Model components loaded successfully.")
except FileNotFoundError as e:
    print(f"Warning: ML component not found: {e}. Prediction functionality will be disabled.")
    # Set placeholders if files are missing, just in case
    MODEL, FEATURES, SCALER, OUTPUT_COLS = None, [], None, []
except Exception as e:
    print(f"Error loading ML components: {e}")
    MODEL, FEATURES, SCALER, OUTPUT_COLS = None, [], None, []

app=Flask(__name__)

app.secret_key='secret_key' # for session encryption

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login',methods=['GET','POST'])
def login():
    if request.method == 'POST':
        email=request.form['username']
        password=request.form['password']

        if email == 'admin@gmail.com' and password == 'admin':
         session['logged_in'] = True
         session['name'] = 'System Admin'
         session['email'] = email
         session['role'] = 'admin'
         flash('Admin Login successful!', 'success')
         return redirect(url_for('admin_dashboard'))
        
        user=get_user_by_email(email)

        if user is None:
            flash('Username does not exist')
            return render_template('login.html')
        
        if check_password_hash(user['password'], password):
            session['user_id']=user['id']
            session['name']=user['name']
            session['username']=user['email']
            session['role']=user['role']
            session['register_no'] = user['register_no']
            flash(f"Logged in successfully as {user['role']}.", 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Incorrect password')
            return render_template('login.html')

    return render_template('login.html')

@app.route('/register', methods=['GET','POST'])
def registration():
    if request.method == 'POST':
        name=request.form['name']
        email=request.form['email']
        password=request.form['password']
        role=request.form['role']
        register_no = request.form.get('register_no')

        hashed_password = generate_password_hash(password)
        
        try:
            insert_user(name, email, hashed_password, role, register_no)
            flash('Registration successful!', 'success')
            return redirect(url_for('login'))
        except sqlite3.IntegrityError as e:
             flash('Email or Register Number already exists.', 'danger')
        except Exception as e:
            flash(f'An error occurred: {e}', 'danger')

    return render_template('registration.html')

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
      return redirect(url_for('login'))
    name=session.get('name')
    email=session.get('username')
    role=session.get('role')
    if role == 'teacher':
        return render_template('teacher_dashboard.html',name=name,email=email,role=role)
    else:
        return render_template('student_dashboard.html',name=name,email=email)

@app.route('/upload_data',methods=['POST'])
def upload_data():
    if 'csv_file' not in request.files:
        return jsonify({"message":"No file part"}), 400
    csv_file=request.files['csv_file']
    class_id = request.form.get('class_id')
    semester = request.form.get('semester')
    model = request.form.get('model')
    
    if not all([class_id, semester, model, csv_file]):
        return jsonify({"message": "Missing form fields or file"}), 400
                        
    #Save file temperorily or read directly
    import io

    csv_content = io.StringIO(csv_file.stream.read().decode("UTF8"), newline=None)

    try:
        # CORRECTED CALL: Pass the ML components as arguments
        insert_prediction_from_csv(
            class_id,
            semester,
            model,
            csv_content,
            MODEL,  # <-- Added
            FEATURES,  # <-- Added
            SCALER,  # <-- Added
            OUTPUT_COLS  # <-- Added
        )
        return jsonify({"message": "Data inserted and predicted successfully"})
    except Exception as e:
        # Note: If this general catch block triggers, it will show the full traceback in the terminal
        # and send the error message to the client. This is good for debugging.
        print(f"Error during data insertion/prediction: {e}")
        return jsonify({"message": str(e)}), 500

@app.route('/api/predictions',methods=['GET'])
def api_get_predictions():
    """
    API endpoint to fetch all prediction data.
    """
    if 'user_id' not in session or session.get('role') != 'teacher':
        return jsonify({"message": "Unauthorized"}), 401
    
    predictions = get_all_predictions()
    return jsonify(predictions)

@app.route('/api/class_performance/<class_id>', methods=['GET'])
def api_class_performance(class_id):
    """
    API endpoint to fetch predictions for a specific class ID.
    """
    if 'user_id' not in session or session.get('role') != 'teacher':
        return jsonify({"message": "Unauthorized"}), 401
    
    predictions = get_predictions_by_class(class_id)
    
    if not predictions:
        # Return 404 if no data is found
        return jsonify({"message": f"No data found for Class ID: {class_id}"}), 404
        
    return jsonify(predictions)
    
        
@app.route('/api/my_performance', methods=['GET'])
def api_my_performance():
    """
    API endpoint to fetch the logged-in student's performance data.
    """
    # 1. Check if logged in and if user is a student
    if 'user_id' not in session or session.get('role') != 'student': 
        return jsonify({"message": "Unauthorized or not a student"}), 401
    
    # 2. Get the Student Name from the session
    register_no = session.get('register_no') # This is assumed to be the Register No.
    
    if not register_no:
        # A student should always have a register_no in the session.
        print("DEBUG: ERROR - Student Register Number not found in session.") 
        return jsonify({"message": "Could not identify student Register Number from session."}), 400

    # 3. Fetch data using the existing database function
    predictions = get_predictions_by_regno(register_no) 
    
    if not predictions:
        return jsonify({"message": f"No performance data found for student {register_no}."}), 404
        
    return jsonify(predictions)


# ⚠️ Modify the old student route to redirect or remove it, as it's no longer needed:
@app.route('/api/student_performance/<register_no>', methods=['GET'])
def api_student_performance(register_no):
    # Use the existing implementation for teacher lookups if desired
    if session.get('role') == 'teacher':
        predictions = get_predictions_by_regno(register_no)
        if not predictions:
            return jsonify({"message": f"Student with Register No. {register_no} not found."}), 404
        return jsonify(predictions)
    
    return jsonify({"message": "Unauthorized"}), 401

@app.route('/admin_dashboard')
def admin_dashboard():
    # Enforce role check for access
    if 'role' not in session or session.get('role') != 'admin':
        flash('Unauthorized access.', 'error')
        return redirect(url_for('home'))

    admin_name = session.get('name')
    admin_email = session.get('email')
    
    # ⭐ NEW: Fetch the list of all users
    users = get_all_users() 

    # Render the admin dashboard template
    return render_template(
        'admin_dashboard.html',
        name=admin_name,
        email=admin_email,
        users=users # ⭐ Pass the user list to the template
    )

@app.route('/logout')
def logout():
    """Clears the session and logs the user out."""
    session.clear()
    flash('You have been logged out successfully.', 'success')
    return redirect(url_for('home'))

if __name__ =='__main__':
    app.run(debug=True)