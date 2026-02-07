


import os
import json
import logging
from typing import Any, Dict, List

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from groq import Groq, APIStatusError
from ..api import schemas

# -------------------------------
# Logging & Client Setup
# -------------------------------
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY is not set. Groq calls will fail.")

client = Groq(api_key=GROQ_API_KEY)
MODEL_NAME = "llama-3.1-8b-instant"

# -------------------------------
# Step 1: Extract Structured Data
# -------------------------------
def analyze_contract_text(raw_text: str) -> Dict[str, Any]:
    """
    Extracts structured lease data with strict accuracy and retry logic.
    """
    system_prompt = """
You are a Senior Automotive Lease Auditor. 
Extract structured data ONLY from the provided lease text. 
STRICT JSON OUTPUT:
{
  "risk_factors": [{"name": "Clause Name", "severity": 0, "description": "Explain risk"}],
  "price_factors": {
      "vehicle_name": "",
      "base_price": 0.0,
      "total_monthly_payment": 0.0,
      "total_due_at_signing": 0.0,
      "balloon_payment": 0.0,
      "apr": 0.0,
      "currency": "INR",
      "estimated_total_cost": 0.0
  },
  "hidden_fees": [{"name": "", "amount": 0.0, "currency": "INR", "clause_excerpt": ""}],
  "junk_fees": [],
  "fairness": {"score": 0, "rating": "Unfair", "explanation": ""}
}
RULES:
1. Capture vague or suspicious fees in 'junk_fees'.
2. Use 0 or empty lists if information is missing.
3. If text is scrambled OCR noise (e.g., 'E,x,c,e,s,s'), IGNORE IT.
"""

    MAX_CHARS = 10000 
    truncated_text = raw_text[:MAX_CHARS]

    def _call_llm(text_to_process: str) -> str:
        chat_completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": f"Analyze this contract:\n\n{text_to_process}"},
            ],
            temperature=0.0, # Strict deterministic extraction
            
        )
        return chat_completion.choices[0].message.content.strip()

    try:
        response_text = _call_llm(raw_text)
    except APIStatusError as e:
        # Retry with truncation if the file is too large
        if e.status_code == 413 or "Request too large" in str(e):
            logger.info("Retrying with truncated text.")
            response_text = _call_llm(truncated_text)
        else:
            raise e

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        logger.error(f"JSON parsing failed. Raw response: {response_text}")
        return {"price_factors": {"currency": "INR"}, "risk_factors": [], "hidden_fees": [], "junk_fees": []}

# -------------------------------
# Step 2: Generate Negotiation Response
# -------------------------------
def generate_chat_reply(
    analysis: schemas.ContractAnalysisPayload,
    request: schemas.ChatRequest,
) -> Dict[str, str]:
    """
    Generates a professional negotiation email draft.
    Ensures counter_email_draft is always the full ready-to-send email.
    """

    # 1️⃣ Financial context
    pf = analysis.price_factors
    v_name = getattr(pf, "vehicle_name", "the vehicle")
    monthly = getattr(pf, "total_monthly_payment", "Not specified")
    down_payment = getattr(pf, "total_due_at_signing", "Not specified")
    balloon = getattr(pf, "balloon_payment", "Not specified")
    apr = getattr(pf, "apr", "Not specified")
    currency = getattr(pf, "currency", "INR")

    financial_context = f"""
Vehicle: {v_name}
Monthly Payment: {monthly}
Down Payment: {down_payment}
Balloon / Residual: {balloon}
APR: {apr}
Currency: {currency}
"""

    # 2️⃣ Fees cleanup
    junk_list = [f.name for f in analysis.hidden_fees if f.name] if analysis.hidden_fees else []
    if isinstance(analysis.junk_fees, list):
        junk_list += [str(f) for f in analysis.junk_fees]
    fees_text = ", ".join(set(junk_list)) if junk_list else "the overall pricing structure and high APR"

    # 3️⃣ History context
    history_text = ""
    if request.history:
        for msg in request.history:
            prefix = "User" if msg.role == "user" else "Assistant"
            history_text += f"{prefix}: {msg.content}\n"

    # 4️⃣ System prompt — very strict
    system_prompt = f"""
You are a Senior Automotive Lease Negotiator.
Your task is to draft a professional negotiation email based on the analysis.
Output ONLY a JSON object. Do NOT include headers like 'JSON Response' or 'Negotiation Email Draft'.
STRICT JSON STRUCTURE:
{{
  "assistant_message": "A 1-sentence summary of your advice.",
  "counter_email_draft": "The full, ready-to-send email starting with 'Subject:' and ending with 'Best regards'."
}}
RULES:
- The email must be ready-to-send.
- Include only the fees or terms detected: {fees_text}.
- Email structure (MANDATORY):
    Subject: Clear and professional
    Greeting: Dear Sales Manager,
    Body: 2 paragraphs max, calm, professional
    Close: Best regards, [Your Name]

"""

    user_prompt = f"""
FINANCIAL CONTEXT:
{financial_context}

HISTORY:
{history_text}

USER MESSAGE:
{request.message}

INTENT: email
"""

    try:
        chat_completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": user_prompt.strip()},
            ],
            temperature=0.0,  # Low temp to reduce hallucinations
            max_tokens=1200,
            response_format={"type": "json_object"}
        )

        raw_res = chat_completion.choices[0].message.content.strip()

        # Remove code fences if present
        if "```json" in raw_res:
            raw_res = raw_res.split("```json")[1].split("```")[0].strip()

        # Parse JSON safely
        try:
            data = json.loads(raw_res)
        except json.JSONDecodeError:
            # Fallback: wrap raw text in counter_email_draft
            data = {"assistant_message": "Draft generated.", "counter_email_draft": raw_res}

        # Ensure counter_email_draft always exists
        return {
            "assistant_message": str(data.get("assistant_message", "Draft generated.")),
            "counter_email_draft": str(data.get("counter_email_draft", "")) if data.get("counter_email_draft") else None
        }

    except Exception as e:
        logger.error(f"Failed to generate email: {e}")
        return {"assistant_message": "An error occurred. Please try again.", "counter_email_draft": None}

    










# import os
# import json
# import logging
# from typing import Any, Dict, Optional

# from dotenv import load_dotenv
# load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# from groq import Groq, APIStatusError
# from ..api import schemas

# logger = logging.getLogger(__name__)
# GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# if not GROQ_API_KEY:
#     logger.warning("GROQ_API_KEY is not set. Groq calls will fail.")

# client = Groq(api_key=GROQ_API_KEY)
# MODEL_NAME = "llama-3.1-8b-instant"

# def analyze_contract_text(raw_text: str) -> Dict[str, Any]:
    
#     """
#     Call Groq Llama 3 to extract structured contract data.
#     """
#     system_prompt = """
#     You are an expert financial auditor. Analyze the car lease for consumer fairness.
#     You MUST output ONLY a single valid JSON object. 

#     STRICT JSON STRUCTURE:
#     {
#       "risk_factors": [
#         {
#           "name": "Clause Name",
#           "severity": 4,
#           "description": "Explanation of risk"
#         }
#       ],
#       "price_factors": {
#         "base_price": 0.0,
#         "total_monthly_payment": 0.0,
#         "total_due_at_signing": 0.0,
#         "estimated_total_cost": 0.0,
#         "currency": "INR"
#       },
#       "hidden_fees": [
#         {
#           "name": "Fee Name",
#           "amount": 0.0,
#           "currency": "INR",
#           "frequency": "one-time",
#           "clause_excerpt": "Text from contract"
#         }
#       ],
#       "junk_fees": ["List of any other suspicious charges found"],
#       "fairness": {
#         "score": 0,
#         "rating": "Unfair",
#         "explanation": "Brief summary"
#       }
#     }

#     RULES:
#     1. Capture any vague charges (like 'Excess Km fees') in the 'junk_fees' array.
#     2. If a value is missing, use 0 or [].
#     """

#     MAX_CHARS = 12000 
#     truncated_text = raw_text[:MAX_CHARS]

#     try:
#         user_prompt = f"Analyze this contract text:\n\n\"\"\"{truncated_text}\"\"\""
#         chat_completion = client.chat.completions.create(
#             model=MODEL_NAME,
#             messages=[
#                 {"role": "system", "content": system_prompt.strip()},
#                 {"role": "user", "content": user_prompt.strip()},
#             ],
#             temperature=0.1,
#             max_tokens=2048,
#         )
#         response_text = chat_completion.choices[0].message.content.strip()
        
#         if "```json" in response_text:
#             response_text = response_text.split("```json")[1].split("```")[0].strip()
#         elif "```" in response_text:
#             response_text = response_text.split("```")[1].split("```")[0].strip()

#         return json.loads(response_text)
#     except Exception as e:
#         logger.error(f"AI Extraction failed: {e}")
#         return {
#             "risk_factors": [],
#             "price_factors": {"currency": "INR"},
#             "hidden_fees": [],
#             "junk_fees": [],
#             "fairness": {"score": 0, "rating": "Unfair", "explanation": "Error in processing."}
#         }

# def generate_chat_reply(
#     analysis: schemas.ContractAnalysisPayload,
#     request: schemas.ChatRequest,
# ) -> Dict[str, str]:
#     """
#     Generates professional, high-stakes negotiation emails.
#     Strictly filters out character-splitting and hallucinations.
#     """
    
#     # 1. STRICT DATA CLEANING
#     # This prevents single letters from being treated as fees
#     junk_list = []
#     if isinstance(analysis.junk_fees, str):
#         # Splits DB string and keeps only real words (length > 3)
#         junk_list = [f.strip() for f in analysis.junk_fees.split(",") if len(f.strip()) > 3]
#     elif isinstance(analysis.junk_fees, list):
#         junk_list = [str(f).strip() for f in analysis.junk_fees if len(str(f).strip()) > 3]

#     # Clean the structured hidden fees list
#     hidden_fee_names = [f.name for f in analysis.hidden_fees if f.name and len(f.name) > 3]

#     # Combine and Deduplicate
#     unique_fees = list(set(hidden_fee_names + junk_list))
#     fees_found_text = ", ".join(unique_fees) if unique_fees else "the overall pricing structure"

#     # 2. THE CORPORATE NEGOTIATOR PROMPT
#     system_prompt = """
#     You are a Senior Lease Negotiator. Your goal is to draft a SHORT, FORMAL, and FIRM counter-offer email.
    
#     STRICT EMAIL STRUCTURE:
#     - Subject Line: Professional and clear.
#     - Dear Sales Manager,
#     - Body: 2 paragraphs max. Address the specific fees provided below.
#     - Content: Mention ONLY the actual fees provided. Do NOT complain about typos or single characters.
#     - Tone: Corporate and brief.
#     - Sign-off: Best regards, [Your Name].

#     RESPONSE FORMAT:
#     [STRATEGY] Short summary of approach.
#     [EMAIL] Full email draft.
#     """

#     user_prompt = f"""
#     Lease Context: {analysis.price_factors.currency}
#     Fairness Score: {analysis.fairness.score}/100
#     ACTUAL FEES TO CHALLENGE: {fees_found_text}
#     """

#     try:
#         # 3. GROQ API CALL
#         chat_completion = client.chat.completions.create(
#             model=MODEL_NAME,
#             messages=[
#                 {"role": "system", "content": system_prompt.strip()},
#                 {"role": "user", "content": user_prompt.strip()},
#             ],
#             temperature=0.2, # Low temperature prevents the AI from inventing fees
#             max_tokens=800,
#         )
        
#         full_text = chat_completion.choices[0].message.content.strip()

#         # 4. TAG EXTRACTION
#         strategy = "I have prepared a formal negotiation draft focusing on the identified fees."
#         email_draft = full_text

#         if "[STRATEGY]" in full_text and "[EMAIL]" in full_text:
#             parts = full_text.split("[EMAIL]")
#             strategy = parts[0].replace("[STRATEGY]", "").strip()
#             email_draft = parts[1].strip()
#         elif "Subject:" in full_text:
#             # Fallback if tags are missing but email format is present
#             email_draft = full_text

#         return {
#             "assistant_message": strategy,
#             "counter_email_draft": email_draft
#         }

#     except Exception as e:
#         logger.error(f"Negotiation generation failed: {e}")
#         return {
#             "assistant_message": "I'm having trouble generating the email. Please try again.",
#             "counter_email_draft": None
#         }



# import os
# import json
# from typing import Any, Dict

# from dotenv import load_dotenv
# load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# from groq import Groq
# from ..api import schemas

# from groq import Groq, APIStatusError

# GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# if not GROQ_API_KEY:
#     print("WARNING: GROQ_API_KEY is not set. Groq calls will fail when used.")

# client = Groq(api_key=GROQ_API_KEY)

# # Use Llama 3 8B; fast and good enough for this use case.
# MODEL_NAME = "llama-3.1-8b-instant"



# def analyze_contract_text(raw_text: str) -> Dict[str, Any]:
#     """
#     Call Groq Llama 3 to extract risk factors, price factors, hidden fees.
#     If the contract is too large for the model, use only the first N characters.
#     """
#     system_prompt = """
# You are an expert assistant analyzing car lease or loan contracts for consumer fairness.

# You MUST output ONLY a single valid JSON object with this EXACT structure:

# {
#   "file_id": "",
#   "risk_factors": [
#     {
#       "name": "Early termination penalty",
#       "severity": 4,
#       "description": "Why this clause is risky for the consumer"
#     }
#   ],
#   "price_factors": {
#     "base_price": 0,
#     "total_monthly_payment": 0,
#     "total_due_at_signing": 0,
#     "estimated_total_cost": 0,
#     "currency": "USD"
#   },
#   "hidden_fees": [
#     {
#       "fee_name": "Documentation fee",
#       "amount": 500,
#       "currency": "USD",
#       "frequency": "one-time",
#       "clause_excerpt": "short excerpt mentioning the fee"
#     }
#   ],
#   "fairness": {
#     "score": 0,
#     "rating": "Moderate",
#     "explanation": "Short explanation of fairness; numeric score will be overridden by backend logic."
#   }
# }

# Rules:
# - severity is an integer from 1 (low risk) to 5 (very high risk).
# - Hidden or junk fees include any add-on, unclear, or not-obvious fees.
# - If a numeric value is not explicitly present, set it to 0.
# - Do NOT include any extra keys or commentary outside the JSON.
# """

#     # Simple truncation to avoid 413 errors for very long contracts
#     MAX_CHARS = 8000  # adjust if needed
#     truncated_text = raw_text[:MAX_CHARS]

#     def _call_llm(text: str) -> str:
#         user_prompt = f"""
# Here is the contract text to analyze (may be truncated if the original is very long):

# \"\"\"{text}\"\"\"
# """
#         chat_completion = client.chat.completions.create(
#             model=MODEL_NAME,
#             messages=[
#                 {"role": "system", "content": system_prompt.strip()},
#                 {"role": "user", "content": user_prompt.strip()},
#             ],
#             temperature=0.2,
#             max_tokens=2048,
#         )
#         return chat_completion.choices[0].message.content.strip()

#     try:
#         text = _call_llm(raw_text)
#     except APIStatusError as e:
#         # If request is too large, retry with truncated text
#         if e.status_code == 413 or "Request too large" in str(e):
#             text = _call_llm(truncated_text)
#         else:
#             raise

#     # Strip code fences if present
#     if text.startswith("```"):
#         text = text.strip("`")
#         lines = text.splitlines()
#         if lines and lines[0].lower().startswith("json"):
#             text = "\n".join(lines[1:])

#     import json
#     data = json.loads(text)
#     return data

# def generate_chat_reply(
#     analysis: schemas.ContractAnalysisPayload,
#     request: schemas.ChatRequest,
# ) -> Dict[str, str]:
#     """
#     Use Groq Llama 3 to generate chat or counter-offer email using existing analysis.
#     Returns dict with keys: assistant_message, counter_email_draft (optional).
#     """
#     analysis_summary = f"""
# Fairness score: {analysis.fairness.score} ({analysis.fairness.rating}).
# Explanation: {analysis.fairness.explanation}

# Number of risk factors: {len(analysis.risk_factors)}.
# Number of hidden fees: {len(analysis.hidden_fees)}.
# """

#     history_text = ""
#     if request.history:
#         for msg in request.history:
#             prefix = "User" if msg.role == "user" else "Assistant"
#             history_text += f"{prefix}: {msg.content}\n"

#     mode_instruction = ""
#     if request.intent == "email":
#         mode_instruction = """
# The user wants you to generate a polite but firm negotiation email to the dealer.
# Focus on asking to remove or reduce specific hidden or unfair fees, or to improve key terms.
# """

#     system_prompt = """
# You are a negotiation assistant helping a consumer negotiate a car lease/loan.
# Use the provided analysis and fairness score to answer questions and suggest negotiation points.

# Rules:

# 1) Normal chat (intent = "chat"):
#    - Respond as a helpful assistant in plain text.
#    - You MUST return JSON with this exact shape:
#      {
#        "assistant_message": "Your reply to the user.",
#        "counter_email_draft": null
#      }

# 2) Email generation (intent = "email" OR user clearly asks for an email / counter-offer):
#    - Write a professional email the user can send to the dealer.
#    - Email MUST include:
#        - A clear subject line starting with "Subject: ..."
#        - A greeting (e.g., "Dear [Dealer Name],")
#        - One or more short paragraphs referencing the unfair clauses / hidden fees.
#        - A polite but firm request to revise the offer.
#        - A closing and sign-off (e.g., "Sincerely," or "Best regards,").
#    - You MUST return JSON with this exact shape:
#      {
#        "assistant_message": "Short explanation of what you recommend.",
#        "counter_email_draft": "Full email text including Subject, greeting, body, and regards."
#      }

# 3) Output format:
#    - ALWAYS return a single valid JSON object.
#    - Do NOT include markdown, bullet points, or any text outside the JSON.
# """

#     user_prompt = f"""
# Contract analysis summary:
# {analysis_summary}

# Conversation so far:
# {history_text}

# User's latest message:
# {request.message}

# Intent: {request.intent}
# {mode_instruction}
# """

#     chat_completion = client.chat.completions.create(
#         model=MODEL_NAME,
#         messages=[
#             {"role": "system", "content": system_prompt.strip()},
#             {"role": "user", "content": user_prompt.strip()},
#         ],
#         temperature=0.5,
#         max_tokens=1536,
#     )

#     text = chat_completion.choices[0].message.content.strip()

#     # Strip possible ```json fences
#     if text.startswith("```"):
#         text = text.strip("`")
#         lines = text.splitlines()
#         if lines and lines[0].lower().startswith("json"):
#             text = "\n".join(lines[1:])

#     import json
#     try:
#         data = json.loads(text)
#     except json.JSONDecodeError:
#         # Fallback: wrap raw text so API never crashes
#         data = {
#             "assistant_message": text,
#             "counter_email_draft": None,
#         }

#     assistant_message = data.get("assistant_message", "")
#     counter_email_draft = data.get("counter_email_draft")

#     return {
#         "assistant_message": assistant_message,
#         "counter_email_draft": counter_email_draft,
#     }
