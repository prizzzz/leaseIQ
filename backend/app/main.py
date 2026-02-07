import sys
import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# 1. Setup Pathing & Environment
# BASE_DIR points to 'backend/' folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load .env file explicitly from the backend root
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=env_path)

if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

# Add the 'app' directory itself for local module discovery
APP_DIR = os.path.dirname(os.path.abspath(__file__))
if APP_DIR not in sys.path:
    sys.path.append(APP_DIR)

# 2. Clean Imports
try:
    from api import upload, chat, market, contracts 
    from db.db_helper import init_db
except ImportError as e:
    logging.error(f"Import failed: {e}")
    # Fallback for alternative execution environments
    from app.api import upload, chat, market, contracts 
    from db.db_helper import init_db

app = FastAPI(title="LeaseIQ Integrated API")

# 3. Global Error Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"CRITICAL SERVER ERROR: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": "http://localhost:5173",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# 4. CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"], 
)

# 5. Router Management
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(market.router, prefix="/api", tags=["Market"])
app.include_router(contracts.router, prefix="/api", tags=["Negotiation"])

# 6. Basic Routes
@app.get("/")
def read_root():
    return {"status": "online", "message": "LeaseIQ API is fully integrated"}

@app.get("/health")
def health_check():
    # Check if Groq Key is loaded for debugging (don't reveal the key itself)
    groq_status = "Loaded" if os.getenv("GROQ_API_KEY") else "Missing"
    return {"status": "healthy", "groq_key": groq_status}

@app.on_event("startup")
async def startup_event():
    uploads_dir = os.path.join(BASE_DIR, "uploads")
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
    init_db()
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)







# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# # Ensure these imports point to the correct folder structure in your 'app' directory
# from app.api import upload, chat, market 
# from db.db_helper import init_db

# app = FastAPI(title="LeaseIQ Integrated API")
# init_db()
# # --- 1. CORS Configuration ---
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:5173", 
#         "http://localhost:3000", 
#         "http://127.0.0.1:5173", # Add this
#         "http://127.0.0.1:3000"  # Add this
#     ], 
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
#     expose_headers=["*"], # Simplify this to ensure all stream headers are seen
# )
# # --- 2. Integrated Router Management ---
# # Ensure your router files (upload.py, chat.py) do NOT also have 
# # prefix="/api" inside them, or the path will become /api/api/chat
# app.include_router(upload.router, prefix="/api", tags=["Upload"])
# app.include_router(chat.router, prefix="/api", tags=["Chat"])
# app.include_router(market.router, prefix="/api", tags=["Market"])

# # --- 3. Health Check Endpoints ---
# @app.get("/")
# def read_root():
#     return {
#         "status": "online",
#         "message": "LeaseIQ API is fully integrated",
#         "endpoints": ["/api/upload", "/api/chat", "/api/market-info"]
#     }

# @app.get("/health")
# def health_check():
#     return {"status": "healthy"}

# @app.on_event("startup")
# async def startup_event():
#     # Calling it here as well ensures it runs every time the server starts
#     init_db()

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="127.0.0.1", port=8000)