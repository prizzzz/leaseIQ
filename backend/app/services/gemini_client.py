import logging
from google import genai
from google.genai import types
from app.core.config import get_settings

# Setup logging for production debugging
logger = logging.getLogger(__name__)
settings = get_settings()

# 1️⃣ Initialize the official Client
# It automatically picks up GEMINI_API_KEY from your environment variables
client = genai.Client(api_key=settings.GEMINI_API_KEY)

async def send_message_to_gemini(message: str, context: str = ""):
    """
    Updated: Uses the official SDK with dedicated system instructions
    and robust error handling.
    """
    if not message:
        return "Error: Message cannot be empty."

    # 2️⃣ Define System Instructions (The "Personality")
    # This keeps the role separate from user input for better security.
    config = types.GenerateContentConfig(
        system_instruction="You are LeaseIQ AI, an expert car lease negotiator. "
                           "Use the provided lease data to provide data-driven, concise advice.",
        temperature=0.7,  # Balanced between creative and factual
        max_output_tokens=1000,
    )

    # 3️⃣ Combine Context and User Query
    user_content = f"CONTEXT DATA:\n{context}\n\nUSER QUESTION: {message}"

    try:
        # 4️⃣ Generate Content (Supports 1.5 Flash for speed)
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=user_content,
            config=config
        )

        # 5️⃣ Robust response parsing
        if response.text:
            return response.text
        else:
            return "AI was unable to generate a text response. Check safety filters."

    except Exception as e:
        logger.error(f"Gemini API Error: {str(e)}")
        return f"Service Error: I'm having trouble connecting to my AI core."

# --- BONUS: Streaming Version (Better UX) ---
async def stream_message_to_gemini(message: str, context: str = ""):
    """
    Streams the response word-by-word (perfect for Chat interfaces).
    """
    user_content = f"CONTEXT DATA:\n{context}\n\nUSER QUESTION: {message}"
    
    try:
        # Using generate_content_stream for real-time output
        stream = client.models.generate_content_stream(
            model="gemini-1.5-flash",
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction="You are LeaseIQ AI, an expert negotiator."
            )
        )
        for chunk in stream:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        logger.error(f"Streaming Error: {str(e)}")
        yield "Error: Connection lost."