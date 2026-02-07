import logging
import json
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# 🔹 Import service and db helpers
from app.services.openrouter_service import get_chat_response_stream
from db.db_helper import get_contract_context

logger = logging.getLogger(__name__)
router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    filename: Optional[str] = None 
    intent: Optional[Literal["chat", "email"]] = "chat"

@router.post("/chat")
async def chat_with_lease_expert(request: ChatRequest):
    """
    Standard Chat: Retrieves context using the filename/ID and streams the response.
    """
    context_text = ""
    
    # 1. Handle JavaScript null/undefined strings
    actual_id_or_filename = request.filename
    if actual_id_or_filename in [None, "null", "undefined", ""]:
        actual_id_or_filename = None

    # 2. Fetch context from DB
    if actual_id_or_filename:
        try:
            # FIX: get_contract_context should be able to handle both numeric IDs and filenames
            db_data = get_contract_context(actual_id_or_filename)
            
            if db_data:
                logger.info(f"✅ Context Loaded for: {actual_id_or_filename}")
                
                # Build a detailed Knowledge Block for the AI
                # This ensures the AI has all the fields it needs for negotiation
                context_text = (
                    f"### DOCUMENT CONTEXT ###\n"
                    f"Vehicle: {db_data.get('year', 'N/A')} {db_data.get('make', 'N/A')} {db_data.get('model', 'N/A')}\n"
                    f"VIN: {db_data.get('vin', 'N/A')}\n"
                    f"Purchase Price: {db_data.get('purchasePrice', 'N/A')}\n"
                    f"APR: {db_data.get('aprPercent', 'N/A')}%\n" 
                    f"Lease Term: {db_data.get('leaseTermMonths', 'N/A')} months\n"
                    f"Monthly Payment: {db_data.get('monthlyPaymentINR', 'N/A')} INR\n" 
                    f"Fairness Score: {db_data.get('score', 'N/A')}/100\n"
                    f"Junk Fees Identified: {', '.join(db_data.get('junk_fees', [])) if db_data.get('junk_fees') else 'None'}\n"
                    f"Full OCR Text Snippet: {db_data.get('contract_text', '')[:3000]}\n"
                    f"### END CONTEXT ###"
                )
            else:
                logger.warning(f"⚠️ Contract ID/Filename '{actual_id_or_filename}' not found.")
        except Exception as e:
            logger.error(f"❌ Database Retrieval Error: {e}")

    # 3. Streaming Logic
    async def stream_generator():
        try:
            # Enhanced Personas for ChatGPT-style responses
            if request.intent == "email":
                system_instruction = (
                    "You are a Senior Automotive Negotiation Expert. "
                    "Draft a professional, firm, and persuasive email to a car dealership. "
                    "Use the provided context to point out specific discrepancies, high interest rates, "
                    "or unnecessary 'junk fees'. Use a professional email format with placeholders like [Your Name]."
                )
            elif context_text:
                system_instruction = (
                    "You are LeaseIQ Expert. You have access to the user's uploaded lease contract. "
                    "Provide a detailed, helpful, and analytical response based on the document. "
                    "Use Markdown (bolding, lists) to highlight key financial terms."
                )
            else:
                system_instruction = (
                    "You are LeaseIQ Expert. No document has been uploaded yet. "
                    "Explain that you need a lease PDF to provide a full analysis, but you can "
                    "still answer general questions about leasing, APR, or residual values."
                )
            
            # Stream response from OpenRouter/Gemini
            async for chunk in get_chat_response_stream(
                request.message, 
                context=context_text, 
                system_prompt=system_instruction
            ):
                if chunk:
                    yield chunk
                    
        except Exception as e:
            logger.error(f"❌ Chat stream error: {e}")
            # Ensure we yield a valid JSON-like string if that's what your frontend expects
            yield '{"assistant_message": "I encountered an error processing the chat. Please try again."}'

    return StreamingResponse(
        stream_generator(), 
        media_type="text/event-stream",
        headers={
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no" 
        }
    )
















# import logging
# import json
# from typing import Optional, Literal
# from fastapi import APIRouter, HTTPException, Body
# from fastapi.responses import StreamingResponse
# from pydantic import BaseModel

# # 🔹 Import service and db helpers
# from app.services.openrouter_service import get_chat_response_stream
# from db.db_helper import get_contract_context

# logger = logging.getLogger(__name__)
# router = APIRouter()

# class ChatRequest(BaseModel):
#     message: str
#     filename: Optional[str] = None 
#     intent: Optional[Literal["chat", "email"]] = "chat"

# @router.post("/chat")
# async def chat_with_lease_expert(request: ChatRequest):
#     """
#     Standard Chat: Retrieves context using the filename and streams the response.
#     """
#     context_text = ""
    
#     # 1. Handle JavaScript null/undefined strings
#     actual_filename = request.filename
#     if actual_filename in [None, "null", "undefined", ""]:
#         actual_filename = None

#     # 2. Fetch context from DB if a filename is provided
#     if actual_filename:
#         try:
#             # Note: Ensure get_contract_context in db_helper.py supports filename lookup
#             db_data = get_contract_context(actual_filename)
            
#             if db_data:
#                 logger.info(f"✅ Context Loaded for: {actual_filename}")
                
#                 # Build a clear "Knowledge Block" for the AI
#                 context_text = (
#                     f"### DOCUMENT CONTEXT: {actual_filename} ###\n"
#                     f"Vehicle: {db_data.get('make', 'N/A')} {db_data.get('model', 'N/A')} ({db_data.get('year', 'N/A')})\n"
#                     f"VIN: {db_data.get('vin', 'N/A')}\n"
#                     f"APR: {db_data.get('aprPercent', 'N/A')}%\n" 
#                     f"Monthly Payment: {db_data.get('monthlyPaymentINR', 'N/A')} INR\n" 
#                     f"Fairness Score: {db_data.get('score', 'N/A')}/100\n"
#                     f"Full OCR Text: {db_data.get('contract_text', '')[:3500]}\n"
#                     f"### END CONTEXT ###"
#                 )
#             else:
#                 logger.warning(f"⚠️ Filename '{actual_filename}' not found in database.")
#         except Exception as e:
#             logger.error(f"❌ Database Retrieval Error: {e}")

#     # 3. Streaming Logic
#     async def stream_generator():
#         try:
#             # Decide the System Persona
#             if request.intent == "email":
#                 system_instruction = (
#                     "You are a Car Lease Negotiation Expert. Draft a professional, firm negotiation email "
#                     "to a dealer using the context provided. Highlight high APRs or junk fees."
#                 )
#             elif context_text:
#                 system_instruction = (
#                     "You are LeaseIQ Expert. Use the provided document data to answer questions "
#                     "accurately. Mention specific figures like VIN, APR, and Monthly Payments."
#                 )
#             else:
#                 system_instruction = (
#                     "You are LeaseIQ Expert. No document is uploaded. Greet the user and "
#                     "ask them to upload a PDF lease for a detailed financial analysis."
#                 )
            
#             # Stream response from OpenRouter/Gemini
#             async for chunk in get_chat_response_stream(
#                 request.message, 
#                 context=context_text, 
#                 system_prompt=system_instruction
#             ):
#                 if chunk:
#                     yield chunk
                    
#         except Exception as e:
#             logger.error(f"❌ Chat stream error: {e}")
#             yield "I encountered an error processing the chat. Please try again."

#     return StreamingResponse(
#         stream_generator(), 
#         media_type="text/event-stream",
#         headers={
#             "Content-Type": "text/event-stream",
#             "Cache-Control": "no-cache",
#             "Connection": "keep-alive",
#             "X-Accel-Buffering": "no" 
#         }
#     )

# import logging
# import json
# from typing import Optional, Literal
# from fastapi import APIRouter, HTTPException
# from fastapi.responses import StreamingResponse
# from pydantic import BaseModel

# # 🔹 Import service and db helpers
# from app.services.openrouter_service import get_chat_response_stream
# from db.db_helper import get_contract_context

# logger = logging.getLogger(__name__)
# router = APIRouter()

# class ChatRequest(BaseModel):
#     message: str
#     filename: Optional[str] = None 
#     # Distinguishes between normal chat and formal email drafting
#     intent: Optional[Literal["chat", "email"]] = "chat"

# @router.post("/chat")
# async def chat_with_lease_expert(request: ChatRequest):
#     """
#     Handles AI chat or negotiation email drafting by retrieving contract context 
#     and streaming an adaptive response based on the requested intent.
#     """
#     context_text = ""
    
#     # 1. Clean filename from JavaScript (handles "null" or "undefined" strings)
#     actual_filename = request.filename
#     if actual_filename in [None, "null", "undefined", ""]:
#         actual_filename = None

#     # 2. Fetch context from DB if a filename is provided
#     if actual_filename:
#         try:
#             # Fetches 'make', 'model', 'aprPercent', etc. from sqlite3
#             db_data = get_contract_context(actual_filename)
            
#             if db_data:
#                 logger.info(f"✅ Context Loaded successfully for: {actual_filename}")
                
#                 # Build context using exact keys returned by db_helper.py
#                 context_text = (
#                     f"### DOCUMENT CONTEXT: {actual_filename} ###\n"
#                     f"Vehicle: {db_data.get('make', 'N/A')} {db_data.get('model', 'N/A')} ({db_data.get('year', 'N/A')})\n"
#                     f"VIN: {db_data.get('vin', 'N/A')}\n"
#                     f"APR: {db_data.get('aprPercent', 'N/A')}%\n" 
#                     f"Monthly Payment: {db_data.get('monthlyPaymentINR', 'N/A')} INR\n" 
#                     f"Fairness Score: {db_data.get('score', 'N/A')}/100\n"
#                     f"Contract Content: {db_data.get('contract_text', '')[:3500]}\n"
#                     f"### END CONTEXT ###"
#                 )
#             else:
#                 logger.warning(f"⚠️ Filename '{actual_filename}' provided but NOT found in DB.")
#         except Exception as e:
#             logger.error(f"❌ Database Retrieval Error: {e}")

#     # 3. Generator logic for Real-time Streaming
#     async def stream_generator():
#         try:
#             # Step 1: Decide the System Instruction
#             if request.intent == "email":
#                 system_instruction = (
#                     "You are a Car Lease Negotiation Expert. Your goal is to draft a professional, "
#                     "polite, yet firm negotiation email to a car dealer. Use the provided context to "
#                     "point out high APRs, junk fees, or poor fairness scores. Do not include placeholders; "
#                     "write a ready-to-use email draft."
#                 )
#             elif context_text:
#                 system_instruction = (
#                     "You are LeaseIQ Expert. You have access to the lease data provided above. "
#                     "Analyze the context to answer the user's questions about this specific car. "
#                     "Be professional, highlight financial risks, and pull specific numbers like VIN or APR."
#                 )
#             else:
#                 system_instruction = (
#                     "You are LeaseIQ Expert. No document has been uploaded yet. "
#                     "Greet the user and explain that you can provide a detailed financial "
#                     "and legal analysis once they upload a PDF lease agreement."
#                 )
            
#             # Step 2: Stream response from OpenRouter/Gemini
#             async for chunk in get_chat_response_stream(
#                 request.message, 
#                 context=context_text, 
#                 system_prompt=system_instruction
#             ):
#                 if chunk:
#                     yield chunk
                    
#         except Exception as e:
#             logger.error(f"❌ Chat stream error: {e}")
#             yield "I'm sorry, I encountered an error while processing the chat stream."

#     # 4. Return the response with necessary streaming headers
#     return StreamingResponse(
#         stream_generator(), 
#         media_type="text/event-stream",
#         headers={
#             "Content-Type": "text/event-stream",
#             "Cache-Control": "no-cache",
#             "Connection": "keep-alive",
#             "X-Accel-Buffering": "no" 
#         }
#     )











