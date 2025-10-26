import sqlite3
import csv
import pandas as pd
import json

DATABASE_NAME='gradetrack.db'

def create_tables():
    with sqlite3.connect(DATABASE_NAME) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        cursor = conn.cursor()

        # login table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS login(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            register_no TEXT UNIQUE NULL);
        """)

        # prediction table (FIX: Replaced final_predicted_mark with 9 multi-outputs)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions(
            id INTEGER PRIMARY KEY AUTOINCREMENT ,
            register_No TEXT,
            student_name TEXT,
            class_id TEXT,
            semester TEXT,
            model TEXT,
            -- Subject Performance Levels
            Sub1_Level TEXT,
            Sub2_Level TEXT,
            Sub3_Level TEXT,
            Sub4_Level TEXT,
            -- Overall Result
            Overall_Result TEXT,
            -- Subject Attendance Levels
            Sub1_Attn_Level TEXT,
            Sub2_Attn_Level TEXT,
            Sub3_Attn_Level TEXT,
            Sub4_Attn_Level TEXT
            );
        """)
        
        # store subject wise raw data (remains the same)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS subject_predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prediction_id INTEGER,
            subject TEXT NOT NULL,
            subject_mark REAL,
            attendence INTEGER NOT NULL,
            FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE);
        """)
        conn.commit()
    print("table created")

def insert_user(name, email, password, role, register_no=None):
    """
    Inserts a new user (student or teacher) into the login table.
    register_no is optional (defaults to None).
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    # Ensure register_no is included in the INSERT statement
    if role == 'student' and register_no:
        cursor.execute("SELECT id FROM login WHERE register_no = ?", (register_no,))
        if cursor.fetchone():
            conn.close()
            # Raise an error that can be caught by app.py
            raise sqlite3.IntegrityError("Register Number already exists.")

    try:
        # Use the Register No. value (it will be NULL for teachers)
        cursor.execute(
            'INSERT INTO login (name, email, password, role, register_no) VALUES (?, ?, ?, ?, ?)',
            (name, email, password, role, register_no)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        # This handles the email UNIQUE constraint
        conn.close()
        raise sqlite3.IntegrityError("Email address already exists.")
    finally:
        conn.close()


def get_user_by_email(email):
    """
    Retrieves a user's details, including the register_no, for login.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    # Ensure register_no is selected
    cursor.execute('SELECT id, name, email, password, role, register_no FROM login WHERE email = ?', (email,))
    user = cursor.fetchone()
    conn.close()
    return user


def insert_prediction_from_csv(class_id, semester, model_name, csv_file_object, ml_model, ml_features, ml_scaler, ml_output_cols):
    conn = sqlite3.connect(DATABASE_NAME)
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()

    df = None
    predictions_df = None # New DataFrame for predictions only

    try:
        # Read the entire CSV into a DataFrame for easier processing
        csv_file_object.seek(0)
        df = pd.read_csv(csv_file_object)

        # --- ML PREDICTION BLOCK ---
        if ml_model and ml_features and ml_scaler and len(ml_features) > 0 and len(ml_output_cols) > 0:
            try:
                input_data = df[ml_features]
                input_scaled = ml_scaler.transform(input_data)
                predictions_array = ml_model.predict(input_scaled)

                # 4. Convert predictions back to a DataFrame using ml_output_cols
                predictions_df = pd.DataFrame(predictions_array, columns=ml_output_cols)
                    
                # 5. Combine raw data and predictions
                # Use df_raw for raw data and predictions_df for the results
                df = pd.concat([df, predictions_df], axis=1)

                print("ML Prediction successful (MultiOutput).")

            except Exception as e:
                print(f"Error during ML prediction: {e}. Raw data will be inserted.")
                # predictions_df remains None, signaling no predictions were made
        else:
            print("ML model components incomplete or unavailable. Skipping prediction and inserting raw data.")
        
        # --- DATABASE INSERTION BLOCK ---
        
        if df is not None:
            
            cursor.execute("BEGIN TRANSACTION;")
            
            # Identify subject prefixes based on headers in the DataFrame (for subject_predictions table)
            subject_prefixes = set()
            for col in df.columns:
                if col.endswith('_Attn'):
                    subject_prefixes.add(col.replace('_Attn', ''))
                elif col.endswith('_Series'):
                    subject_prefixes.add(col.replace('_Series', ''))

            # Prepare columns for the main predictions table insert (14 columns total)
            prediction_insert_cols = ['register_No', 'student_name', 'class_id', 'semester', 'model'] + ml_output_cols
            
            # Create the placeholder string for the INSERT statement
            placeholders = ', '.join(['?'] * len(prediction_insert_cols))
            col_names = ', '.join(prediction_insert_cols)
            
            for index, row in df.iterrows():
                register_no = row.get('Register_No')
                student_name = row.get('Student_Name')
                
                if not register_no or not student_name:
                    continue

                # Prepare values for the main predictions table
                prediction_values = [
                    register_no, student_name, class_id, semester, model_name
                ]
                
                # Append the 9 prediction values (or None if predictions failed)
                for col in ml_output_cols:
                    # Get the predicted value from the combined DataFrame 'df'
                    prediction_values.append(row.get(col))

                # Insert into the parent 'predictions' table
                cursor.execute(f"""
                    INSERT INTO predictions ({col_names})
                    VALUES ({placeholders})
                """, prediction_values)
                
                prediction_id = cursor.lastrowid
                subject_data_to_insert = []
                
                # Insert subject details (raw data) into the child 'subject_predictions' table
                for subject_name in subject_prefixes:
                    attendance_str = row.get(f'{subject_name}_Attn')
                    mark_str = row.get(f'{subject_name}_Series')
                    
                    if attendance_str and mark_str and prediction_id:
                        try:
                            attendance = int(float(attendance_str))
                            mark = float(mark_str)
                            
                            subject_data_to_insert.append((
                                prediction_id,
                                subject_name,
                                attendance,
                                mark # Raw Series mark is stored here
                            ))
                        except ValueError:
                            pass

                if subject_data_to_insert:
                    cursor.executemany("""
                        INSERT INTO subject_predictions (prediction_id, subject, attendence, subject_mark)
                        VALUES (?, ?, ?, ?)
                    """, subject_data_to_insert)
                    
            # Commit the transaction
            conn.commit()
            print("Data inserted and predicted successfully.")

        else:
            print("Data insertion failed because DataFrame could not be created/processed.")
            conn.rollback()


    except Exception as e:
        # General catch for any errors not caught above
        print(f"A critical error occurred during data processing: {e}")
        conn.rollback()

    finally:
        conn.close()


def _fetch_predictions(query, params=()):
    """
    Helper function to fetch and structure data based on a query.
    It efficiently maps the subject and attendance prediction levels
    from the main 'predictions' table to the corresponding subject data.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # 1. Fetch the student-level predictions (p) and subject-level raw data (s)
        cursor.execute(query, params)
        raw_data = cursor.fetchall()

        if not raw_data:
            return []

        # 2. Data Restructuring
        predictions_map = {}
        for row in raw_data:
            record = dict(row)
            prediction_id = record['id']
            
            # Use register_No as the main key
            if prediction_id not in predictions_map:
                # Initialize the student's entry
                predictions_map[prediction_id] = {
                    'id':prediction_id,
                    'register_No': record['register_No'],
                    'student_name': record['student_name'],
                    'class_id': record['class_id'],
                    'semester': record['semester'],
                    'model': record['model'],
                    'Overall_Result': record['Overall_Result'],
                    # Store all prediction levels in the parent dict for easy lookup
                    'prediction_levels': {
                        'Sub1_Level': record['Sub1_Level'], 'Sub2_Level': record['Sub2_Level'],
                        'Sub3_Level': record['Sub3_Level'], 'Sub4_Level': record['Sub4_Level'],
                        'Sub1_Attn_Level': record['Sub1_Attn_Level'], 'Sub2_Attn_Level': record['Sub2_Attn_Level'],
                        'Sub3_Attn_Level': record['Sub3_Attn_Level'], 'Sub4_Attn_Level': record['Sub4_Attn_Level']
                    },
                    'subject_details': [] # List to hold individual subject data
                }
            
            # 3. Append the subject data to the student's entry
            subject_name = record['subject'] # e.g., 'Sub1'
            subject_level_col = f'{subject_name}_Level' # e.g., 'Sub1_Level'
            attn_level_col = f'{subject_name}_Attn_Level' # e.g., 'Sub1_Attn_Level'

            subject_data = {
                'subject': subject_name,
                'subject_mark': record['subject_mark'],
                'attendance': record['attendence'],
                # Retrieve the predicted levels from the cached parent dict
                'Sub_Mark_Level': predictions_map[prediction_id]['prediction_levels'].get(subject_level_col),
                'Sub_Attn_Level': predictions_map[prediction_id]['prediction_levels'].get(attn_level_col)
            }
            predictions_map[prediction_id]['subject_details'].append(subject_data)

        # 4. Final Cleanup and return
        final_list = list(predictions_map.values())
        # Remove the temporary key 'prediction_levels' from each student object
        for student in final_list:
            del student['prediction_levels']

        return final_list

    finally:
        conn.close()


def get_all_predictions():
    """
    Fetches all prediction data and groups it by student for a cleaner display.
    """
    query = """
    SELECT
        p.*, -- Select all columns from predictions table
        s.subject,
        s.attendence,
        s.subject_mark
    FROM predictions p
    JOIN subject_predictions s ON p.id = s.prediction_id
    ORDER BY p.register_No, s.subject;
    """
    return _fetch_predictions(query)


def get_predictions_by_class(class_id):
    """
    Fetches prediction data for a specific class.
    """
    query = """
    SELECT
        p.*, -- Select all columns from predictions table
        s.subject,
        s.attendence,
        s.subject_mark
    FROM predictions p
    JOIN subject_predictions s ON p.id = s.prediction_id
    WHERE p.class_id = ?
    ORDER BY p.register_No, s.subject;
    """
    return _fetch_predictions(query, (class_id,))


def get_predictions_by_regno(register_no):
    """
    Fetches a student's performance from the predictions table 
    based on their Register Number, by leveraging the robust _fetch_predictions helper.
    """
    # Using the standardized _fetch_predictions query structure
    query = """
    SELECT
        p.*, -- Select all columns from predictions table (including all levels)
        s.subject,
        s.attendence,
        s.subject_mark
    FROM predictions p
    JOIN subject_predictions s ON p.id = s.prediction_id
    WHERE p.register_No = ?
    ORDER BY p.id, s.subject; 
    """
    # The _fetch_predictions function handles the grouping and restructuring.
    return _fetch_predictions(query, (register_no,))

def get_all_users():
    """
    Retrieves a list of all users (Admin, Teacher, Student) from the login table, 
    excluding their password for security.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Selecting all relevant columns except the sensitive 'password'
    cursor.execute('SELECT id, name, email, role, register_no FROM login ORDER BY role, name')
    users = cursor.fetchall()
    conn.close()
    
    # Convert Row objects to dictionaries
    return [dict(user) for user in users]

if __name__ == '__main__':
    create_tables()