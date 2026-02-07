import sqlite3
import logging
import os
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Path to the SQLite database file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "ocr.db")

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  
    return conn

def init_db():
    """
    Initializes the database and automatically adds missing columns.
    This ensures Harshitha's Math Logic and the Chat Context always have data.
    """
    logger.info(f"Checking database at: {DB_PATH}")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Create tables if they don't exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT,
            contract_text TEXT,
            score INTEGER, 
            created_at TEXT
        )
    """)
    
    # 2. Define the REQUIRED columns for the Negotiation Page and Finance logic
    required_columns = {
        "make": "TEXT",
        "model": "TEXT",
        "year": "INTEGER",
        "vin": "TEXT",
        "aprPercent": "REAL",
        "leaseTermMonths": "INTEGER",
        "monthlyPaymentINR": "REAL",
        "downPaymentINR": "REAL",
        "residualValueINR": "REAL",
        "annualMileageKm": "INTEGER",
        "earlyTerminationLevel": "TEXT",
        "purchaseOptionStatus": "TEXT",
        "maintenanceType": "TEXT",
        "warrantyType": "TEXT",
        "penaltyLevel": "TEXT",
        "junk_fees": "TEXT" # Added to store identifying fees as a JSON string
    }
    
    # 3. Migration: Add missing columns one by one
    cursor.execute("PRAGMA table_info(contracts)")
    existing_columns = [row[1] for row in cursor.fetchall()]
    
    for col_name, col_type in required_columns.items():
        if col_name not in existing_columns:
            logger.info(f"MIGRATION: Adding missing column '{col_name}'")
            try:
                cursor.execute(f"ALTER TABLE contracts ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError as e:
                logger.error(f"Migration failed for {col_name}: {e}")

    conn.commit()
    conn.close()
    logger.info("✅ Database schema is up to date.")

def save_contract_to_db(file_name: str, contract_text: str, extraction_data: dict, score: int = 0):
    """Saves detailed contract data and returns the new row ID string."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # We convert junk_fees list to a string for SQLite storage
        junk_fees_str = ", ".join(extraction_data.get('junk_fees', []))

        cursor.execute("""
            INSERT INTO contracts (
                file_name, contract_text, make, model, year, vin, 
                aprPercent, leaseTermMonths, monthlyPaymentINR, 
                downPaymentINR, residualValueINR, annualMileageKm,
                earlyTerminationLevel, purchaseOptionStatus, 
                maintenanceType, warrantyType, penaltyLevel, junk_fees,
                score, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            file_name, 
            contract_text,
            extraction_data.get('make'),
            extraction_data.get('model'),
            extraction_data.get('year'),
            extraction_data.get('vin'),
            extraction_data.get('aprPercent'),
            extraction_data.get('leaseTermMonths'),
            extraction_data.get('monthlyPaymentINR'),
            extraction_data.get('downPaymentINR'),
            extraction_data.get('residualValueINR'),
            extraction_data.get('annualMileageKm'),
            extraction_data.get('earlyTerminationLevel'),
            extraction_data.get('purchaseOptionStatus'),
            extraction_data.get('maintenanceType'),
            extraction_data.get('warrantyType'),
            extraction_data.get('penaltyLevel'),
            junk_fees_str,
            score, 
            datetime.now().isoformat()
        ))

        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return str(new_id)

    except Exception as e:
        logger.error(f"❌ DATABASE SAVE ERROR: {e}")
        return None

def get_contract_context(identifier: str):
    """
    Fetches context by ID (if numeric) or Filename (if string).
    This prevents the 500 error when the frontend passes a filename.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if str(identifier).isdigit():
            cursor.execute("SELECT * FROM contracts WHERE id = ?", (identifier,))
        else:
            cursor.execute("SELECT * FROM contracts WHERE file_name = ? ORDER BY id DESC LIMIT 1", (identifier,))
            
        row = cursor.fetchone()
        conn.close()

        return dict(row) if row else None
    except Exception as e:
        logger.error(f"❌ DATABASE RETRIEVAL ERROR: {e}")
        return None

if __name__ == "__main__":
    init_db()



















# import sqlite3
# import logging
# import os
# import json
# from datetime import datetime

# # Configure logging
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# DB_PATH = os.path.join(BASE_DIR, "ocr.db")

# def get_db_connection():
#     """Establishes a connection to the SQLite database with Row factory."""
#     conn = sqlite3.connect(DB_PATH)
#     conn.row_factory = sqlite3.Row  
#     return conn

# def init_db():
#     """Initializes tables and migrates missing columns."""
#     logger.info(f"Checking database at: {DB_PATH}")
#     conn = get_db_connection()
#     cursor = conn.cursor()
    
#     cursor.execute("""
#         CREATE TABLE IF NOT EXISTS contracts (
#             id INTEGER PRIMARY KEY AUTOINCREMENT,
#             file_name TEXT,
#             contract_text TEXT,
#             score INTEGER, 
#             created_at TEXT
#         )
#     """)
    
#     required_columns = {
#         "extraction_data": "TEXT",
#         "junk_fees": "TEXT",
#         "make": "TEXT",
#         "model": "TEXT",
#         "year": "INTEGER",
#         "vin": "TEXT",
#         "aprPercent": "REAL",
#         "leaseTermMonths": "INTEGER",
#         "monthlyPaymentINR": "REAL",
#         "downPaymentINR": "REAL",
#         "residualValueINR": "REAL",
#         "annualMileageKm": "INTEGER",
#         "earlyTerminationLevel": "TEXT",
#         "purchaseOptionStatus": "TEXT",
#         "maintenanceType": "TEXT",
#         "warrantyType": "TEXT",
#         "penaltyLevel": "TEXT"
#     }
    
#     cursor.execute("PRAGMA table_info(contracts)")
#     existing_columns = [row[1] for row in cursor.fetchall()]
    
#     for col_name, col_type in required_columns.items():
#         if col_name not in existing_columns:
#             logger.info(f"MIGRATION: Adding missing column '{col_name}'")
#             try:
#                 cursor.execute(f"ALTER TABLE contracts ADD COLUMN {col_name} {col_type}")
#             except sqlite3.OperationalError as e:
#                 logger.error(f"Migration failed for {col_name}: {e}")

#     conn.commit()
#     conn.close()

# def save_contract_to_db(file_name: str, contract_text: str, extraction_data: dict, score: int = 0):
#     """Saves the contract and returns the numeric ID as a string."""
#     try:
#         conn = get_db_connection()
#         cursor = conn.cursor()

#         junk_fees_str = json.dumps(extraction_data.get('junk_fees', []))
#         full_json_str = json.dumps(extraction_data)

#         cursor.execute("""
#             INSERT INTO contracts (
#                 file_name, contract_text, extraction_data, junk_fees,
#                 make, model, year, vin, aprPercent, leaseTermMonths, 
#                 monthlyPaymentINR, downPaymentINR, residualValueINR, 
#                 annualMileageKm, earlyTerminationLevel, purchaseOptionStatus, 
#                 maintenanceType, warrantyType, penaltyLevel, score, created_at
#             )
#             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
#         """, (
#             file_name, contract_text, full_json_str, junk_fees_str,
#             extraction_data.get('make'), extraction_data.get('model'),
#             extraction_data.get('year'), extraction_data.get('vin'),
#             extraction_data.get('aprPercent'), extraction_data.get('leaseTermMonths'),
#             extraction_data.get('monthlyPaymentINR'), extraction_data.get('downPaymentINR'),
#             extraction_data.get('residualValueINR'), extraction_data.get('annualMileageKm'),
#             extraction_data.get('earlyTerminationLevel'), extraction_data.get('purchaseOptionStatus'),
#             extraction_data.get('maintenanceType'), extraction_data.get('warrantyType'),
#             extraction_data.get('penaltyLevel'), score, datetime.now().isoformat()
#         ))

#         new_id = cursor.lastrowid
#         conn.commit()
#         conn.close()
#         return str(new_id)
#     except Exception as e:
#         logger.error(f"DATABASE ERROR: {e}")
#         return None

# # 🔹 THIS IS THE FIXED FUNCTION NAME FOR YOUR CHAT.PY IMPORT
# def get_contract_context(file_id: str):
#     """Fetches a record by ID for the Chat Context."""
#     try:
#         if not file_id: return None
#         conn = get_db_connection()
#         row = conn.execute("SELECT * FROM contracts WHERE id = ?", (file_id,)).fetchone()
#         conn.close()
#         return dict(row) if row else None
#     except Exception as e:
#         logger.error(f"Fetch error: {e}")
#         return None

# if __name__ == "__main__":
#     init_db()
    





















    
# import sqlite3
# import logging
# import os
# from datetime import datetime
# from pathlib import Path


# # Configure logging to see migration status in the terminal
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # Path to the SQLite database file
# BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# DB_PATH = os.path.join(BASE_DIR, "ocr.db")

# def get_db_connection():
#     """Establishes a connection to the SQLite database."""
#     conn = sqlite3.connect(DB_PATH)
#     conn.row_factory = sqlite3.Row  
#     return conn

# def init_db():
#     """
#     Initializes the database tables and automatically adds 
#     any missing columns without deleting existing data.
#     """
#     logger.info(f"Checking database at: {DB_PATH}")
#     conn = get_db_connection()
#     cursor = conn.cursor()
    
#     # 1. Create tables if they don't exist
#     cursor.execute("""
#         CREATE TABLE IF NOT EXISTS ocr_results (
#             id INTEGER PRIMARY KEY AUTOINCREMENT,
#             file_name TEXT,
#             raw_text TEXT,
#             created_at TEXT
#         )
#     """)
    
#     cursor.execute("""
#         CREATE TABLE IF NOT EXISTS contracts (
#             id INTEGER PRIMARY KEY AUTOINCREMENT,
#             file_name TEXT,
#             contract_text TEXT,
#             score INTEGER, 
#             created_at TEXT
#         )
#     """)
    
#     # 2. Define the Full Comparison Schema
#     required_columns = {
#         "score": "INTEGER",
#         "make": "TEXT",
#         "model": "TEXT",
#         "year": "INTEGER",
#         "vin": "TEXT",
#         "aprPercent": "REAL",
#         "leaseTermMonths": "INTEGER",
#         "monthlyPaymentINR": "REAL",
#         "downPaymentINR": "REAL",
#         "residualValueINR": "REAL",
#         "annualMileageKm": "INTEGER",
#         "earlyTerminationLevel": "TEXT",
#         "purchaseOptionStatus": "TEXT",
#         "maintenanceType": "TEXT",
#         "warrantyType": "TEXT",
#         "penaltyLevel": "TEXT"
#     }
    
#     # 3. Perform Migration (Add missing columns one by one)
#     cursor.execute("PRAGMA table_info(contracts)")
#     existing_columns = [row[1] for row in cursor.fetchall()]
    
#     for col_name, col_type in required_columns.items():
#         if col_name not in existing_columns:
#             logger.info(f"MIGRATION: Adding missing column '{col_name}' to 'contracts' table.")
#             try:
#                 cursor.execute(f"ALTER TABLE contracts ADD COLUMN {col_name} {col_type}")
#             except sqlite3.OperationalError as e:
#                 logger.error(f"Migration failed for {col_name}: {e}")

#     conn.commit()
#     conn.close()
#     logger.info("Database initialization and migration complete.")

# def save_contract_to_db(file_name: str, contract_text: str, extraction_data: dict, score: int = 0):
#     """Saves detailed contract data and returns the new row ID."""
#     try:
#         conn = get_db_connection()
#         cursor = conn.cursor()

#         cursor.execute("""
#             INSERT INTO contracts (
#                 file_name, contract_text, make, model, year, vin, 
#                 aprPercent, leaseTermMonths, monthlyPaymentINR, 
#                 downPaymentINR, residualValueINR, annualMileageKm,
#                 earlyTerminationLevel, purchaseOptionStatus, 
#                 maintenanceType, warrantyType, penaltyLevel,
#                 score, created_at
#             )
#             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
#         """, (
#             file_name, 
#             contract_text,
#             extraction_data.get('make'),
#             extraction_data.get('model'),
#             extraction_data.get('year'),
#             extraction_data.get('vin'),
#             extraction_data.get('aprPercent'),
#             extraction_data.get('leaseTermMonths'),
#             extraction_data.get('monthlyPaymentINR'),
#             extraction_data.get('downPaymentINR'),
#             extraction_data.get('residualValueINR'),
#             extraction_data.get('annualMileageKm'),
#             extraction_data.get('earlyTerminationLevel'),
#             extraction_data.get('purchaseOptionStatus'),
#             extraction_data.get('maintenanceType'),
#             extraction_data.get('warrantyType'),
#             extraction_data.get('penaltyLevel'),
#             score, 
#             datetime.now().isoformat()
#         ))

#         # --- CRITICAL CHANGE START ---
#         new_id = cursor.lastrowid  # Get the auto-incremented ID
#         conn.commit()
#         conn.close()
        
#         logger.info(f"SUCCESS: Saved record for {file_name} with ID: {new_id}.")
#         return str(new_id)  # Return the ID as a string for the frontend
#         # --- CRITICAL CHANGE END ---

#     except Exception as e:
#         logger.error(f"DATABASE ERROR: Failed to save contract: {e}")
#         return None

# def get_contract_context(filename: str):
#     """Fetches the most recent record for a filename to provide AI context."""
#     try:
#         conn = get_db_connection()
#         cursor = conn.cursor()
        
#         cursor.execute(
#             "SELECT * FROM contracts WHERE file_name = ? ORDER BY id DESC LIMIT 1", 
#             (filename,)
#         )
#         row = cursor.fetchone()
#         conn.close()

#         if row:
#             return dict(row) 
#         return None
#     except Exception as e:
#         logger.error(f"DATABASE ERROR: Retrieval failed: {e}")
#         return None

# # --- Run this block to fix your database immediately ---
# if __name__ == "__main__":
#     init_db()








# import sqlite3
# import logging
# from datetime import datetime
# from pathlib import Path

# logger = logging.getLogger(__name__)

# # Path to the SQLite database file
# DB_PATH = Path(__file__).parent / "ocr.db"

# def get_db_connection():
#     conn = sqlite3.connect(DB_PATH)
#     conn.row_factory = sqlite3.Row  
#     return conn

# def init_db():
#     """Initializes the database and ensures all required columns exist."""
#     conn = get_db_connection()
#     cursor = conn.cursor()
    
#     cursor.execute("""
#         CREATE TABLE IF NOT EXISTS ocr_results (
#             id INTEGER PRIMARY KEY AUTOINCREMENT,
#             file_name TEXT,
#             raw_text TEXT,
#             created_at TEXT
#         )
#     """)
    
#     # 🔥 UPDATED SCHEMA: Added make, model, year, vin, price, apr
#     cursor.execute("""
#         CREATE TABLE IF NOT EXISTS contracts (
#             id INTEGER PRIMARY KEY AUTOINCREMENT,
#             file_name TEXT,
#             contract_text TEXT,
#             make TEXT,
#             model TEXT,
#             year TEXT,
#             vin TEXT,
#             price TEXT,
#             apr TEXT,
#             score INTEGER, 
#             created_at TEXT
#         )
#     """)
#     conn.commit()
#     conn.close()
#     logger.info("Database initialized with full contract schema.")

# def save_contract_to_db(file_name: str, contract_text: str, extraction_data: dict, score: int = 0):
#     """Saves the extracted text and specific car/financial details to the database."""
#     try:
#         conn = get_db_connection()
#         cursor = conn.cursor()

#         cursor.execute("""
#             INSERT INTO contracts (
#                 file_name, contract_text, make, model, year, vin, price, apr, score, created_at
#             )
#             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
#         """, (
#             file_name, 
#             contract_text,
#             extraction_data.get('make'),
#             extraction_data.get('model'),
#             extraction_data.get('year'),
#             extraction_data.get('vin'),
#             extraction_data.get('price'),
#             extraction_data.get('apr'),
#             score, 
#             datetime.now().isoformat()
#         ))

#         conn.commit()
#         conn.close()
#         logger.info(f"Successfully saved detailed record for {file_name}.")
#     except Exception as e:
#         logger.error(f"Failed to save contract to DB: {e}")

# def get_contract_context(filename: str):
#     """Fetches all context fields for the AI Chat."""
#     try:
#         conn = get_db_connection()
#         cursor = conn.cursor()
        
#         # Select all relevant columns that chat.py expects
#         cursor.execute(
#             "SELECT * FROM contracts WHERE file_name = ? ORDER BY id DESC LIMIT 1", 
#             (filename,)
#         )
#         row = cursor.fetchone()
#         conn.close()

#         if row:
#             # We return a dictionary that matches the .get() calls in chat.py
#             return dict(row) 
#         return None
#     except Exception as e:
#         logger.error(f"Database retrieval error: {e}")
#         return None