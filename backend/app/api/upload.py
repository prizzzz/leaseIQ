import os
import logging
import aiofiles
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.core.config import get_settings

# 🔹 Services & DB Helpers
from app.services.ocr_service import extract_text_from_pdf
from app.services.openrouter_service import extract_contract_info 
from app.services.pricing_service import calculate_fairness
from db.db_helper import save_contract_to_db

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/upload")
async def handle_upload(
    file: UploadFile = File(...),
    settings=Depends(get_settings)
):
    # 1. Validate File Type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)

    try:
        # 2. Save File Asynchronously
        logger.info(f"Saving file to: {file_path}")
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)

        # 3. Perform OCR
        logger.info(f"Step 1: Starting OCR for {file.filename}...")
        extracted_text = extract_text_from_pdf(file_path)
        
        if not extracted_text or len(extracted_text.strip()) < 20:
            raise ValueError("OCR failed to read the document. Ensure the PDF contains text.")

        # 4. AI Data Extraction
        logger.info(f"Step 2: AI Extracting detailed data for {file.filename}...")
        contract_data = await extract_contract_info(extracted_text)

        # 4.5 Data Sanitization (CRITICAL for Database Stability & Scoring)
        # We ensure all fields expected by fairness.py and the DB are present.
        sanitized_data = {
            "purchasePrice": float(contract_data.get("purchasePrice") or 0),
            "aprPercent": float(contract_data.get("aprPercent") or 0),
            "leaseTermMonths": int(contract_data.get("leaseTermMonths") or 0),
            "monthlyPaymentINR": float(contract_data.get("monthlyPaymentINR") or 0),
            "downPaymentINR": float(contract_data.get("downPaymentINR") or 0),
            "residualValueINR": float(contract_data.get("residualValueINR") or 0),
            "earlyTerminationLevel": contract_data.get("earlyTerminationLevel") or "Medium",
            "maintenanceType": contract_data.get("maintenanceType") or "Customer",
            "warrantyType": contract_data.get("warrantyType") or "Not Included",
            "penaltyLevel": contract_data.get("penaltyLevel") or "Medium",
            "make": contract_data.get("make") or "Unknown",
            "model": contract_data.get("model") or "Vehicle",
            "year": contract_data.get("year") or "N/A",
            "vin": contract_data.get("vin") or "N/A",
            "junk_fees": contract_data.get("junk_fees") or []
        }
        # Update the main contract_data with sanitized values
        contract_data.update(sanitized_data)

        # 5. Calculate Fairness Score (Using your strict fairness.py logic)
        logger.info(f"Step 3: Calculating fairness score...")
        analysis = calculate_fairness(contract_data) 
        final_score = analysis.get("fairness_score", 0)
        
        # 6. Save to Database
        # 🔹 IMPORTANT: Convert junk_fees list to a string for DB storage
        junk_fees_list = contract_data.get("junk_fees", [])
        junk_fees_string = ", ".join(junk_fees_list) if isinstance(junk_fees_list, list) else str(junk_fees_list)

        file_id = None
        try:
            # save_contract_to_db returns the integer ID from SQL
            # We pass the score and the sanitized data to ensure consistency.
            db_id = save_contract_to_db(
                file_name=file.filename,
                contract_text=extracted_text, 
                extraction_data={
                    **contract_data,
                    "junk_fees": junk_fees_string # Store as comma-separated string
                },
                score=final_score # Lock the score here!
            )
            
            if db_id:
                file_id = str(db_id)
                logger.info(f"✅ SUCCESS: Saved with DB ID: {file_id} and Score: {final_score}")
            else:
                file_id = file.filename
            
        except Exception as db_err:
            logger.error(f"❌ DATABASE ERROR: {db_err}")
            file_id = file.filename

        # 7. Final Response
# 7. Final Response - Updated to match React's "summary.fairness.score" path
        return {
            "status": "success",
            "file_id": file_id,
            "filename": file.filename,
            "data": {
                **contract_data,
                "fairness": {
                    "score": final_score,
                    "rating": "Unfair" if final_score < 40 else "Moderate" if final_score < 75 else "Fair",
                    "explanation": "Initial audit complete."
                }
            }
        }

    except ValueError as ve:
        logger.warning(f"Validation Error: {str(ve)}")
        raise HTTPException(status_code=422, detail=str(ve))
        
    except Exception as e:
        logger.error(f"Critical Pipeline Failure: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal processing error: {str(e)}"
        )


















# import os
# import logging
# import aiofiles
# from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
# from app.core.config import get_settings

# # 🔹 Services & DB Helpers
# from app.services.ocr_service import extract_text_from_pdf
# from app.services.openrouter_service import extract_contract_info 
# from app.services.pricing_service import calculate_fairness
# from db.db_helper import save_contract_to_db

# router = APIRouter()
# logger = logging.getLogger(__name__)

# @router.post("/upload")
# async def handle_upload(
#     file: UploadFile = File(...),
#     settings=Depends(get_settings)
# ):
    
    
#     # 1. Validate File Type
#     if not file.filename.lower().endswith(".pdf"):
#         raise HTTPException(status_code=400, detail="Only PDF files are supported.")

#     # Ensure upload directory exists
#     os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
#     file_path = os.path.join(settings.UPLOAD_DIR, file.filename)

#     try:
#         # 2. Save File Asynchronously
#         logger.info(f"Saving file to: {file_path}")
#         async with aiofiles.open(file_path, 'wb') as out_file:
#             content = await file.read()
#             await out_file.write(content)

#         # 3. Perform OCR
#         logger.info(f"Step 1: Starting OCR for {file.filename}...")
#         extracted_text = extract_text_from_pdf(file_path)
        
#         if not extracted_text or len(extracted_text.strip()) < 20:
#             raise ValueError("OCR failed to read the document. Ensure the PDF contains text or clear images.")

#         # 4. AI Data Extraction
#         logger.info(f"Step 2: AI Extracting detailed data for {file.filename}...")
#         contract_data = await extract_contract_info(extracted_text)

#         # 5. Calculate Fairness Score
#         logger.info(f"Step 3: Calculating fairness score...")
#         analysis = calculate_fairness(contract_data) 
#         final_score = analysis.get("fairness_score", 0)
        
#         # 6. Save to Database & Capture generated ID
#         file_id = None
#         try:
#             # save_contract_to_db now returns the cursor.lastrowid
#             db_id = save_contract_to_db(
#                 file_name=file.filename,
#                 contract_text=extracted_text, 
#                 extraction_data=contract_data,
#                 score=final_score
#             )
            
#             # Ensure file_id is a string (React components prefer string IDs)
#             file_id = str(db_id) if db_id else file.filename
#             logger.info(f"✅ SUCCESS: {file.filename} saved with ID: {file_id}")
            
#         except Exception as db_err:
#             logger.error(f"❌ DATABASE ERROR: {db_err}")
#             # Fallback to filename as ID so the frontend doesn't crash
#             file_id = file.filename

#         # 7. Final Response (Formatted for frontend components)
#         return {
#             "status": "success",
#             "file_id": file_id, # Top-level key required by NegotiationPage.jsx
#             "filename": file.filename,
#             "data": {
#                 "purchasePrice": contract_data.get("purchasePrice", 0),
#                 "junk_fees": contract_data.get("junk_fees", []),
#                 # Financials (Matching fieldMapping.js)
#                 "aprPercent": contract_data.get("aprPercent", 0),
#                 "leaseTermMonths": contract_data.get("leaseTermMonths", 0),
#                 "monthlyPaymentINR": contract_data.get("monthlyPaymentINR", 0),
#                 "downPaymentINR": contract_data.get("downPaymentINR", 0),
#                 "residualValueINR": contract_data.get("residualValueINR", 0),
#                 "annualMileageKm": contract_data.get("annualMileageKm", 0),
                
#                 # Risk Levels & Types
#                 "earlyTerminationLevel": contract_data.get("earlyTerminationLevel", "Medium"),
#                 "purchaseOptionStatus": contract_data.get("purchaseOptionStatus", "Not Available"),
#                 "maintenanceType": contract_data.get("maintenanceType", "Customer"),
#                 "warrantyType": contract_data.get("warrantyType", "Not Included"),
#                 "penaltyLevel": contract_data.get("penaltyLevel", "Medium"),
                
#                 # Metadata
#                 "make": contract_data.get("make", "Unknown"),
#                 "model": contract_data.get("model", "Vehicle"),
#                 "year": contract_data.get("year", "N/A"),
#                 "vin": contract_data.get("vin", "N/A"),
#                 "fairness_score": final_score
#             }
#         }

#     except ValueError as ve:
#         logger.warning(f"Validation Error: {str(ve)}")
#         raise HTTPException(status_code=422, detail=str(ve))
        
#     except Exception as e:
#         logger.error(f"Critical Pipeline Failure: {str(e)}", exc_info=True)
#         raise HTTPException(
#             status_code=500,
#             detail=f"Internal processing error: {str(e)}"
#         )