import os
import logging
import json
from fastapi import APIRouter, HTTPException, Depends
from typing import List

# Internal Imports
from db.db_helper import get_db_connection
from app.services.groq_client import analyze_contract_text, generate_chat_reply
# We keep compute_fairness imported just in case, but prioritize DB score
from app.services.fairness import compute_fairness  
from .schemas import (
    AnalysisResponse, 
    ChatRequest, 
    ChatResponse, 
    ContractAnalysisPayload,
    RiskFactor,
    HiddenFee,
    PriceFactors,
    FairnessInfo
)

router = APIRouter()
logger = logging.getLogger(__name__)

def fetch_contract_by_id_or_name(file_id: str):
    """Helper to find contract even if the ID is a filename string."""
    conn = get_db_connection()
    conn.row_factory = lambda cursor, row: dict(zip([col[0] for col in cursor.description], row))
    cursor = conn.cursor()
    
    query = "SELECT * FROM contracts WHERE id = ? OR file_name = ?"
    cursor.execute(query, (file_id, file_id))
    row = cursor.fetchone()
    conn.close()
    return row

@router.post("/contracts/{file_id}/analyze", response_model=AnalysisResponse)
async def analyze_contract(file_id: str):
    """
    Fetches the LOCKED score from the DB to ensure matching results 
    between Summary Panel and Negotiation UI.
    """
    contract = fetch_contract_by_id_or_name(file_id)
    if not contract:
        raise HTTPException(status_code=404, detail=f"Contract {file_id} not found.")

    try:
        # 1. AI Extraction (Still needed for the Risk/Fee list UI)
        raw_ai_data = analyze_contract_text(contract.get("contract_text", ""))
        
        # 2. Get Data from DB
        db_score = int(contract.get("score") or 0)
        db_junk_fees = contract.get("junk_fees", "")
        junk_fees_list = [f.strip() for f in db_junk_fees.split(",")] if db_junk_fees else []

        # 3. Model Preparation
        risk_models = [RiskFactor(**r) for r in raw_ai_data.get("risk_factors", [])]
        fee_models = [HiddenFee(name=f.get("name"), amount=f.get("amount", 0)) for f in raw_ai_data.get("hidden_fees", [])]
        
        price_data = PriceFactors(
            base_price=float(contract.get("purchasePrice") or 0),
            total_monthly_payment=float(contract.get("monthlyPaymentINR") or 0),
            total_due_at_signing=float(contract.get("downPaymentINR") or 0),
            estimated_total_cost=(float(contract.get("monthlyPaymentINR") or 0) * int(contract.get("leaseTermMonths") or 1)) + float(contract.get("downPaymentINR") or 0),
            currency="INR"
        )

        # 4. Sync Fairness Object with DB Score
        # We don't call compute_fairness here to avoid mismatches.
        fairness_obj = FairnessInfo(
            score=db_score,
            rating="Unfair" if db_score < 40 else "Moderate" if db_score < 75 else "Fair",
            explanation=f"Analysis confirmed with a score of {db_score}/100 based on initial audit."
        )

        return AnalysisResponse(
            file_id=str(contract["id"]),
            risk_factors=risk_models,
            price_factors=price_data,
            hidden_fees=fee_models,
            fairness=fairness_obj,
            junk_fees=junk_fees_list
        )

    except Exception as e:
        logger.error(f"Analysis failed for {file_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Deep Analysis failed: {str(e)}")
@router.post("/contracts/{file_id}/chat", response_model=ChatResponse)
async def negotiation_chat(file_id: str, request: ChatRequest):
    contract = fetch_contract_by_id_or_name(file_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract context missing.")

    try:
        # 1. Pull the locked score and junk fees
        db_score = int(contract.get("score") or 0)
        db_junk_fees = contract.get("junk_fees", "")
        junk_fees_list = [f.strip() for f in db_junk_fees.split(",")] if db_junk_fees else []
        
        # 2. CRITICAL FIX: Include the Estimated Total Cost
        # Without this, the AI doesn't know if a $500 fee is a big deal or a small deal
        monthly = float(contract.get("monthlyPaymentINR") or 0)
        term = int(contract.get("leaseTermMonths") or 1)
        down = float(contract.get("downPaymentINR") or 0)
        total_cost = (monthly * term) + down

        price_data = PriceFactors(
            total_monthly_payment=monthly,
            estimated_total_cost=total_cost, # Added this!
            currency="INR"
        )
        
        # 3. Re-create FairnessInfo
        fairness_obj = FairnessInfo(
            score=db_score,
            rating="Unfair" if db_score < 40 else "Moderate" if db_score < 75 else "Fair",
            explanation=f"Deal carries a strict fairness rating of {db_score}/100."
        )

        # 4. Construct Payload
        analysis_payload = ContractAnalysisPayload(
            file_id=str(contract["id"]),
            risk_factors=[],  
            price_factors=price_data,
            hidden_fees=[HiddenFee(name=fee, amount=0) for fee in junk_fees_list],
            fairness=fairness_obj,
            junk_fees=junk_fees_list
        )

        # 5. Generate AI Draft
        ai_response = generate_chat_reply(analysis_payload, request)
        
        # Ensure counter_email_draft is actually returned to the frontend
        return ChatResponse(
            assistant_message=ai_response.get("assistant_message", ""),
            counter_email_draft=ai_response.get("counter_email_draft")
        )
        
    except Exception as e:
        logger.error(f"Negotiation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")
    
# import os
# import logging
# import json
# from fastapi import APIRouter, HTTPException, Body
# from typing import List

# # Internal Imports
# from db.db_helper import get_db_connection
# from app.services.groq_client import analyze_contract_text, generate_chat_reply
# from app.services.fairness import compute_fairness
# from .schemas import (
#     AnalysisResponse, 
#     ChatRequest, 
#     ChatResponse, 
#     ContractAnalysisPayload,
#     RiskFactor,
#     HiddenFee,
#     PriceFactors
# )

# router = APIRouter()
# logger = logging.getLogger(__name__)

# @router.post("/contracts/{file_id}/analyze", response_model=AnalysisResponse)
# async def analyze_contract(file_id: str):
#     """
#     FIXED: Added NoneType protection and smart ID/Filename lookup.
#     """
#     conn = get_db_connection()
#     try:
#         # 1. Smart Lookup: Handles numeric ID or Filename string
#         if file_id.isdigit():
#             row = conn.execute("SELECT * FROM contracts WHERE id = ?", (file_id,)).fetchone()
#         else:
#             row = conn.execute("SELECT * FROM contracts WHERE file_name = ?", (file_id,)).fetchone()
        
#         if not row:
#             raise HTTPException(status_code=404, detail="Contract not found in database.")

#         contract = dict(row)

#         # 2. AI Extraction (Groq Logic)
#         raw_ai_data = analyze_contract_text(contract.get("contract_text", ""))
        
#         # 3. Prepare data for the Scoring Engine with safety defaults
#         risk_models = [RiskFactor(**r) for r in raw_ai_data.get("risk_factors", [])]
#         fee_models = [HiddenFee(**f) for f in raw_ai_data.get("hidden_fees", [])]
        
#         # 🔹 SAFETY SHIM: float(x or 0) prevents NoneType errors
#         monthly = float(contract.get("monthlyPaymentINR") or 0)
#         down = float(contract.get("downPaymentINR") or 0)
#         term = int(contract.get("leaseTermMonths") or 0)
#         purchase_price = float(contract.get("purchasePrice") or 0)

#         price_data = PriceFactors(
#             base_price=purchase_price,
#             total_monthly_payment=monthly,
#             total_due_at_signing=down,
#             estimated_total_cost=(monthly * term) + down,
#             currency="INR"
#         )

#         # 4. MATH LOGIC: Compute fairness
#         fairness_obj = compute_fairness(
#             risk_factors=risk_models,
#             hidden_fees=fee_models,
#             price_factors=price_data
#         )

#         return AnalysisResponse(
#             file_id=str(contract["id"]),
#             risk_factors=risk_models,
#             price_factors=price_data,
#             hidden_fees=fee_models,
#             fairness=fairness_obj
#         )

#     except Exception as e:
#         logger.error(f"❌ Deep Analysis failed for {file_id}: {str(e)}", exc_info=True)
#         raise HTTPException(status_code=500, detail=f"Analysis Error: {str(e)}")
#     finally:
#         conn.close()

# @router.post("/contracts/{file_id}/chat", response_model=ChatResponse)
# async def negotiation_chat(file_id: str, request: ChatRequest):
#     """
#     FIXED: Now supports both numeric IDs and filenames to prevent 404 errors.
#     """
#     conn = get_db_connection()
#     try:
#         # 🔹 SMART LOOKUP: Handle ID or Filename
#         if file_id.isdigit():
#             row = conn.execute("SELECT * FROM contracts WHERE id = ?", (file_id,)).fetchone()
#         else:
#             row = conn.execute("SELECT * FROM contracts WHERE file_name = ?", (file_id,)).fetchone()

#         if not row:
#             logger.warning(f"⚠️ Chat context missing for identifier: {file_id}")
#             raise HTTPException(status_code=404, detail="Contract context missing. Please upload the file again.")

#         contract = dict(row)

#         # Safe data extraction for the AI payload
#         db_score = int(contract.get("score") or 50)
#         valid_rating = "Fair" if db_score >= 75 else "Moderate" if db_score >= 50 else "Unfair"
        
#         # Ensure payments are treated as floats to prevent math errors
#         monthly = float(contract.get("monthlyPaymentINR") or 0)

#         analysis_payload = ContractAnalysisPayload(
#             file_id=str(contract["id"]),
#             risk_factors=[],  
#             price_factors=PriceFactors(
#                 total_monthly_payment=monthly,
#                 currency="INR"
#             ),
#             hidden_fees=[],
#             fairness={
#                 "score": db_score, 
#                 "rating": valid_rating, 
#                 "explanation": "Context for negotiation."
#             }
#         )

#         # Harshitha's Groq Logic for professional replies
#         ai_response = generate_chat_reply(analysis_payload, request)
        
#         return ChatResponse(
#             assistant_message=ai_response.get("assistant_message", ""),
#             counter_email_draft=ai_response.get("counter_email_draft")
#         )
        
#     except Exception as e:
#         logger.error(f"❌ Negotiation Chat Error: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Negotiation generation failed: {str(e)}")
#     finally:
#         conn.close()




















# import os
# import logging
# import json
# from fastapi import APIRouter, HTTPException, Depends
# from typing import List

# # Internal Imports
# from db.db_helper import get_db_connection
# from app.services.groq_client import analyze_contract_text, generate_chat_reply
# from app.services.fairness import compute_fairness  # Harshitha's Math Logic
# from .schemas import (
#     AnalysisResponse, 
#     ChatRequest, 
#     ChatResponse, 
#     ContractAnalysisPayload,
#     RiskFactor,
#     HiddenFee,
#     PriceFactors
# )

# router = APIRouter()
# logger = logging.getLogger(__name__)

# def fetch_contract_by_id_or_name(file_id: str):
#     """Helper to find contract even if the ID is a filename string."""
#     conn = get_db_connection()
#     # Use DictRow-like access
#     conn.row_factory = lambda cursor, row: dict(zip([col[0] for col in cursor.description], row))
#     cursor = conn.cursor()
    
#     # Robust lookup: Checks both ID column and file_name column
#     query = "SELECT * FROM contracts WHERE id = ? OR file_name = ?"
#     cursor.execute(query, (file_id, file_id))
#     row = cursor.fetchone()
#     conn.close()
#     return row

# @router.post("/contracts/{file_id}/analyze", response_model=AnalysisResponse)
# async def analyze_contract(file_id: str):
#     """
#     Uses Groq Logic for extraction and Fairness Logic for scoring.
#     """
#     contract = fetch_contract_by_id_or_name(file_id)

#     if not contract:
#         raise HTTPException(status_code=404, detail=f"Contract {file_id} not found.")

#     try:
#         # 1. AI Extraction (Groq Logic)
#         raw_ai_data = analyze_contract_text(contract.get("contract_text", ""))
        
#         # 2. Prepare data for the Scoring Engine with Null Safety
#         risk_models = [RiskFactor(**r) for r in raw_ai_data.get("risk_factors", [])]
#         fee_models = [HiddenFee(**f) for f in raw_ai_data.get("hidden_fees", [])]
        
#         # Ensure we don't pass 'None' to float() which causes 500 errors
#         purchase_price = float(contract.get("purchasePrice") or 0)
#         monthly_payment = float(contract.get("monthlyPaymentINR") or 0)
#         down_payment = float(contract.get("downPaymentINR") or 0)
#         lease_term = int(contract.get("leaseTermMonths") or 1) # Prevent division by zero

#         price_data = PriceFactors(
#             base_price=purchase_price,
#             total_monthly_payment=monthly_payment,
#             total_due_at_signing=down_payment,
#             estimated_total_cost=(monthly_payment * lease_term) + down_payment,
#             currency="INR"
#         )

#         # 3. Compute the actual fairness score
#         fairness_obj = compute_fairness(
#             risk_factors=risk_models,
#             hidden_fees=fee_models,
#             price_factors=price_data
#         )

#         return AnalysisResponse(
#             file_id=str(contract["id"]),
#             risk_factors=risk_models,
#             price_factors=price_data,
#             hidden_fees=fee_models,
#             fairness=fairness_obj
#         )

#     except Exception as e:
#         logger.error(f"Analysis failed for {file_id}: {str(e)}", exc_info=True)
#         raise HTTPException(status_code=500, detail=f"Deep Analysis failed: {str(e)}")

# @router.post("/contracts/{file_id}/chat", response_model=ChatResponse)
# async def negotiation_chat(file_id: str, request: ChatRequest):
#     """
#     Generates negotiation replies/emails using Groq Logic.
#     """
#     contract = fetch_contract_by_id_or_name(file_id)

#     if not contract:
#         raise HTTPException(status_code=404, detail="Contract context missing.")

#     try:
#         # Handle cases where score might be missing in DB
#         db_score = int(contract.get("score") or 0)
#         valid_rating = "Fair" if db_score >= 75 else "Moderate" if db_score >= 50 else "Unfair"

#         # Construct payload for Groq
#         analysis_payload = ContractAnalysisPayload(
#             file_id=str(contract["id"]),
#             risk_factors=[],  
#             price_factors=PriceFactors(
#                 total_monthly_payment=float(contract.get("monthlyPaymentINR") or 0),
#                 currency="INR"
#             ),
#             hidden_fees=[],
#             fairness={
#                 "score": db_score, 
#                 "rating": valid_rating, 
#                 "explanation": "Context for negotiation."
#             }
#         )

#         # Harshitha's Groq Logic for professional email drafts
#         ai_response = generate_chat_reply(analysis_payload, request)
        
#         return ChatResponse(
#             assistant_message=ai_response.get("assistant_message", ""),
#             counter_email_draft=ai_response.get("counter_email_draft")
#         )
        
#     except Exception as e:
#         logger.error(f"Negotiation error for {file_id}: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Negotiation generation failed: {str(e)}")