import os
import json
import logging
from openai import AsyncOpenAI
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.OPENROUTER_API_KEY,
)

async def extract_contract_info(text_content: str):
    """
    Step 1: Universal Extraction Engine.
    Kept at temperature 0 for strict accuracy during JSON extraction.
    """
    if not text_content:
        raise ValueError("No text content provided.")

    clean_text = " ".join(text_content.split())[:12000] 

    prompt = f"""
    You are a financial data extractor. Output ONLY raw JSON.
    RULES:
    1. Map 'Vehicle Price', 'Agreed Value', or 'Sale Price' to "purchasePrice".
    2. Map 'Interest Rate' or 'APR' to "aprPercent".
    3. Identify legitimate hidden or 'junk' fees (e.g., Nitrogen Air, VIN Etching, Prep Fees).
   - IMPORTANT: If the text appears to be broken characters, OCR noise, or scrambled 
     formatting (e.g., 'E,x,c,e,s,s' or 'k,i,l,o'), IGNORE it. 
   - DO NOT include standard lease terms like 'Excess Kilometer Charge' in this list 
     unless they include an unusual hidden cost..
    
    TEXT TO ANALYZE:
    {clean_text}

    JSON SCHEMA:
    {{
        "make": "string", "model": "string", "year": number, "vin": "string",
        "aprPercent": number, "purchasePrice": number, "monthlyPaymentINR": number,
        "leaseTermMonths": number, "downPaymentINR": number, "residualValueINR": number,
        "annualMileageKm": number, "junk_fees": ["string"],
        "earlyTerminationLevel": "Low" | "Medium" | "High",
        "purchaseOptionStatus": "Available" | "Not Available",
        "maintenanceType": "Dealer" | "Customer" | "Shared",
        "warrantyType": "Included" | "Partial" | "Not Included",
        "penaltyLevel": "Low" | "Medium" | "High"
    }}
    """

    try:
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": "Specialized financial parser. Output ONLY JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0 
        )
        data = json.loads(response.choices[0].message.content)

        if isinstance(data, list):
            data = data[0] if len(data) > 0 else {}
        elif isinstance(data, dict) and "data" in data:
            data = data["data"]
            
        return data
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise e

async def get_chat_response_stream(query: str, context: str = "", system_prompt: str = ""):
    """
    Step 2: Context-Locked Streamer.
    UPDATED: Advanced persona for detailed, ChatGPT-style conversational analysis.
    """
    base_instruction = (
        "You are **LeaseIQ**, a world-class automotive financial intelligence assistant and "
        "consumer-protection expert. Your role is to help users understand, evaluate, and "
        "negotiate vehicle lease agreements with clarity, accuracy, and confidence.\n\n"

        "CORE IDENTITY:\n"
        "- Act like a premium financial consultant, not a chatbot.\n"
        "- Prioritize the user's financial interest at all times.\n"
        "- Be transparent, practical, and authoritative.\n\n"

        "GREETING & ACTIVATION RULE:\n"
        "- If the user says 'hello', 'hi', or sends a casual greeting, respond with a short, "
        "friendly, professional greeting ONLY.\n"
        "- Do NOT perform any analysis unless:\n"
        "  a) A specific question is asked, OR\n"
        "  b) Lease / contract context is provided.\n\n"
        "ACKNOWLEDGMENT RULE (CRITICAL UX RULE):\n"
        "- If the user says 'thank you', 'thanks', 'ok', 'okay', 'got it', or similar acknowledgments:\n"
        "  • Respond briefly and politely.\n"
        "  • Do NOT reintroduce yourself.\n"
        "  • Do NOT trigger analysis.\n"
        "  • Do NOT ask follow-up questions unless the user asks for more help.\n"
        "  • Example responses:\n"
        "    - 'You're welcome! Glad I could help.'\n"
        "    - 'Happy to help anytime.'\n"
        "    - 'Anytime!'\n\n"

        "INTENT-FIRST RULE (CRITICAL):\n"
        "- Always identify the user's PRIMARY intent before responding.\n"
        "- If the user asks about a specific topic (e.g., junk fees, APR, mileage, buyout, "
        "end-of-lease, down payment), focus the response mainly on THAT topic.\n"
        "- Do NOT provide a full lease review unless the user explicitly asks for it.\n\n"

        "SIMPLE QUESTION / DIRECT ANSWER RULE (CRITICAL PERFORMANCE RULE):\n"
        "- If the user's question is short, factual, or numeric (e.g., 'purchase cost', "
        "'vehicle price', 'monthly payment', 'APR', 'balloon payment'):\n"
        "  • Provide a DIRECT answer in the first 1–2 lines.\n"
        "  • Do NOT perform full analysis unless the user explicitly asks for explanation.\n"
        "  • Optional: Add a brief clarification section if helpful.\n\n"

        "ANSWER-FIRST RULE:\n"
        "- Always place the direct answer at the very top of the response.\n"
        "- Explanations, breakdowns, or guidance must come AFTER the answer.\n\n"

        "TOPIC-SPECIFIC RESPONSE FRAMEWORK (MANDATORY):\n"
        "When responding to any specific leasing topic:\n"
        "1. Explain the concept clearly in general terms.\n"
        "2. Apply the concept strictly to the provided lease context.\n"
        "3. Identify:\n"
        "   - Standard / legitimate terms\n"
        "   - High-risk, costly, or negotiable terms\n"
        "4. Explain real-world financial impact (who pays, when, and how much it could cost).\n"
        "5. End with practical negotiation or decision-making guidance.\n\n"

        "FULL LEASE ANALYSIS RULE (ONLY WHEN REQUESTED):\n"
        "If the user asks for a full review, structure the response as:\n"
        "- Professional greeting\n"
        "- Lease Summary (key numbers only)\n"
        "- Cost & Risk Analysis (APR, payments, mileage, down payment, residual value)\n"
        "- Hidden / Junk Fee Review\n"
        "- End-of-Lease Risks\n"
        "- Negotiation Tips\n"
        "- LeaseIQ Verdict (Short, clear recommendation)\n\n"

        "DEPTH & QUALITY RULES:\n"
        "- Avoid shallow answers EXCEPT when the user asks a direct factual question.\n"
        "- Explain whether each term is good or bad and WHY.\n"
        "- Quantify impact whenever possible (cost over time, penalties, exposure).\n\n"

        "CONTEXT SAFETY RULE:\n"
        "- Use ONLY the provided 'EXTRACTED CONTEXT' for vehicle-specific numbers, fees, "
        "rates, and terms.\n"
        "- Do NOT invent fees, prices, or clauses.\n"
        "- If information is missing or unclear, explicitly state assumptions or limitations.\n\n"

        "TERM INTERPRETATION RULE:\n"
        "- Interpret common user phrases intelligently:\n"
        "  • 'purchase cost' → total amount paid to own the vehicle\n"
        "  • 'buyout price' → balloon payment / GFV\n"
        "  • 'car price' → agreed vehicle price before interest\n"
        "  • 'total cost' → all payments + down payment + buyout\n\n"
        
        "FORMATTING & READABILITY:\n"
        "- Use Markdown extensively.\n"
        "- Use ## headers, **bold emphasis**, bullet points, and spacing for clarity.\n"
        "- Responses should feel scannable, premium, and user-friendly.\n\n"

        "TONE & TRUST:\n"
        "- Be calm, confident, and consumer-protective.\n"
        "- Never shame the user for bad deals.\n"
        "- Avoid legal disclaimers unless absolutely necessary.\n\n"

        "GOAL:\n"
        "Help the user avoid costly mistakes, negotiate better terms, and make informed "
        "leasing decisions with confidence."


    )

    
    combined_system = f"{base_instruction}\n\n{system_prompt}" if system_prompt else base_instruction
    
    messages = [{"role": "system", "content": combined_system}]
    
    if context:
        messages.append({
            "role": "system", 
            "content": f"### EXTRACTED CONTEXT (MANDATORY DATA) ###\n{context}\n\nTask: Provide a thorough breakdown of this specific document."
        })
    
    messages.append({"role": "user", "content": query})

    try:
        stream = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=messages,
            stream=True,
            temperature=0.7, # Increased for more natural, detailed flow
            max_tokens=1500  # Ensures the response isn't cut short
        )
        
        yield '{"assistant_message": "'
        
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                # Escape characters to maintain valid JSON streaming for ChatWindow.jsx
                clean_chunk = (
                    chunk.choices[0].delta.content
                    .replace('\\', '\\\\')
                    .replace('"', '\\"')
                    .replace('\n', '\\n')
                    .replace('\r', '\\r')
                    .replace('\t', '\\t')
                )
                yield clean_chunk
        
        yield '"}'
        
    except Exception as e:
        logger.error(f"Streaming failed: {e}")
        yield '{"assistant_message": "Analysis service error. Please try again."}'

async def get_simulator_response(query: str, contract_data: dict, persona: str = "aggressive"):
    """Step 3: The Dealer Simulator (Improved for better dialogue)."""
    persona_desc = "Tough, no-nonsense Sales Manager" if persona == "aggressive" else "Friendly but firm Salesperson"
    system_instruction = (
        f"ACT AS: {persona_desc} at a dealership. You are selling the {contract_data.get('make')} {contract_data.get('model')}. "
        f"Current APR: {contract_data.get('aprPercent')}%. \n"
        "RULES: Be persuasive. Defend the contract terms. Use sales tactics. "
        "Do NOT reveal you are an AI. Keep responses conversational and engaging."
    )
    
    messages = [{"role": "system", "content": system_instruction}, {"role": "user", "content": query}]

    try:
        stream = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=messages,
            stream=True,
            temperature=0.8,
            max_tokens=1000
        )
        yield '{"assistant_message": "'
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                clean_chunk = (
                    chunk.choices[0].delta.content
                    .replace('\\', '\\\\')
                    .replace('"', '\\"')
                    .replace('\n', '\\n')
                    .replace('\r', '\\r')
                )
                yield clean_chunk
        yield '"}'
    except Exception as e:
        yield '{"assistant_message": "The dealer is currently on another call."}'


# import os
# import json
# import logging
# from openai import AsyncOpenAI
# from app.core.config import get_settings

# logger = logging.getLogger(__name__)
# settings = get_settings()

# # Initialize Async client for non-blocking I/O
# client = AsyncOpenAI(
#     base_url="https://openrouter.ai/api/v1",
#     api_key=settings.OPENROUTER_API_KEY,
# )

# async def extract_contract_info(text_content: str):
#     """
#     Analyzes PDF text and extracts 11 core fields required for 
#     the Dynamic Comparison Lab and Rating Engine.
#     """
#     if not text_content:
#         raise ValueError("No text content provided for extraction.")

#     # 1. Clean the text to optimize token usage
#     clean_text = " ".join(text_content.split())[:12000] # Increased limit for complex contracts

#     prompt = f"""
#     Analyze the car lease/loan contract text and extract data into a strict JSON format.
    
#     ### RAW CONTRACT TEXT ###
#     {clean_text} 

#     ### EXTRACTION RULES ###
#     1. VIN: Standardize to a 17-character alphanumeric string.
#     2. NUMERIC DATA: Extract values as numbers (float/int). Do not include currency symbols.
#     3. ENUM CATEGORIES: You MUST strictly use the following strings for categorical fields:
#        - earlyTerminationLevel: "Low", "Medium", or "High"
#        - purchaseOptionStatus: "Available" or "Not Available"
#        - maintenanceType: "Dealer", "Customer", or "Shared"
#        - warrantyType: "Included", "Partial", or "Not Included"
#        - penaltyLevel: "Low", "Medium", or "High"
#     4. MISSING DATA: Use null for strings and 0 for numbers if not found.

#     ### TARGET JSON SCHEMA ###
#     {{
#         "make": "string",
#         "model": "string",
#         "year": number,
#         "vin": "string",
#         "aprPercent": number,
#         "purchasePrice": number,
#         "monthlyPaymentINR": number,
#         "leaseTermMonths": number,
#         "downPaymentINR": number,
#         "residualValueINR": number,
#         "annualMileageKm": number,
#         "earlyTerminationLevel": "Low" | "Medium" | "High",
#         "purchaseOptionStatus": "Available" | "Not Available",
#         "maintenanceType": "Dealer" | "Customer" | "Shared",
#         "warrantyType": "Included" | "Partial" | "Not Included",
#         "penaltyLevel": "Low" | "Medium" | "High"
#     }}
#     """

#     try:
#         response = await client.chat.completions.create(
#             model=settings.AI_MODEL,
#             messages=[
#                 {"role": "system", "content": "You are a specialized legal and financial document parser. Output only JSON."},
#                 {"role": "user", "content": prompt}
#             ],
#             response_format={"type": "json_object"},
#             temperature=0 
#         )
        
#         raw_content = response.choices[0].message.content
#         data = json.loads(raw_content)

#         # FIX: Handle cases where the AI returns a list instead of an object
#         if isinstance(data, list):
#             data = data[0] if len(data) > 0 else {}

#         # 2. POST-PROCESSING: Safety checks
#         defaults = {
#             "make": "Unknown",
#             "model": "Car",
#             "vin": "N/A",
#             "earlyTerminationLevel": "Medium",
#             "purchaseOptionStatus": "Not Available",
#             "maintenanceType": "Customer",
#             "warrantyType": "Not Included",
#             "penaltyLevel": "Medium"
#         }
        
#         for key, value in defaults.items():
#             if not data.get(key) or data[key] == "null":
#                 data[key] = value
            
#         return data

#     except Exception as e:
#         logger.error(f"AI Extraction failed: {str(e)}")
#         raise e

# async def get_chat_response_stream(query: str, context: str = "", system_prompt: str = ""):
#     """
#     Generator for real-time chat responses with strict context adherence.
#     """
#     messages = []
    
#     base_instruction = (
#         "You are LeaseIQ Expert, a friendly and helpful lease consultant. "
#         "Your goal is to explain complex car lease terms in simple, everyday language. "
#         "When you analyze data, don't just list numbers; explain what they MEAN for the user's wallet. "
#         "Structure your response with clear headings, use bullet points for readability, "
#         "and provide a supportive summary or next steps. "
#         "If a deal looks bad (like a low fairness score), explain WHY in a helpful way."
#     )
    
#     combined_system = f"{base_instruction}\n\n{system_prompt}" if system_prompt else base_instruction
#     messages.append({"role": "system", "content": combined_system})
    
#     if context:
#         messages.append({
#             "role": "system", 
#             "content": f"### EXTRACTED LEASE CONTEXT ###\n{context}\n\nUse the data above to answer the following query."
#         })
    
#     messages.append({"role": "user", "content": query})

#     try:
#         stream = await client.chat.completions.create(
#             model=settings.AI_MODEL,
#             messages=messages,
#             stream=True 
#         )

#         async for chunk in stream:
#             if chunk.choices and chunk.choices[0].delta.content:
#                 yield chunk.choices[0].delta.content
                
#     except Exception as e:
#         logger.error(f"Streaming failed: {str(e)}")
#         yield "Error: The AI analysis service is currently unavailable. Please try again in a few moments."













