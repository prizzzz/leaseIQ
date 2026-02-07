from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Literal

# --- Base Configuration ---
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class UploadResponse(BaseSchema):
    file_id: str
    filename: str

class OCRResponse(BaseSchema):
    file_id: str
    text_extracted: bool
    full_text: str

# ---------- Milestone 4: Analysis & Fairness ----------

class RiskFactor(BaseSchema):
    name: str
    severity: int = 1  # 1 (Low) to 5 (High)
    description: str

class HiddenFee(BaseSchema):
    # FIXED: Renamed to 'name' to match your contracts.py usage 
    # and improved defaults for flexibility.
    name: str 
    amount: Optional[float] = 0.0
    currency: Optional[str] = "INR"
    frequency: Optional[str] = "one-time"
    clause_excerpt: Optional[str] = None

class PriceFactors(BaseSchema):
    base_price: Optional[float] = 0.0
    total_monthly_payment: Optional[float] = 0.0
    total_due_at_signing: Optional[float] = 0.0
    estimated_total_cost: Optional[float] = 0.0
    currency: Optional[str] = "INR"

class FairnessInfo(BaseSchema):
    score: int = 0
    rating: Literal["Fair", "Moderate", "Unfair"] = "Moderate"
    explanation: str

class ContractAnalysisPayload(BaseSchema):
    file_id: str
    risk_factors: List[RiskFactor] = Field(default_factory=list)
    price_factors: PriceFactors
    hidden_fees: List[HiddenFee] = Field(default_factory=list)
    fairness: FairnessInfo
    # ADDED: To track the raw strings extracted by the AI
    junk_fees: List[str] = Field(default_factory=list) 

class AnalysisResponse(ContractAnalysisPayload):
    """
    Final response model for the /analyze endpoint.
    """
    pass

# ---------- Milestone 4: Chatbot ----------

class ChatMessage(BaseSchema):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseSchema):
    message: str
    file_id: Optional[str] = None
    filename: Optional[str] = None
    history: Optional[List[ChatMessage]] = Field(default_factory=list)
    intent: Optional[Literal["chat", "email"]] = "chat"

class ChatResponse(BaseSchema):
    assistant_message: str
    counter_email_draft: Optional[str] = None








# from pydantic import BaseModel, ConfigDict, Field
# from typing import Optional, List, Literal

# # --- Base Configuration ---
# # ConfigDict(from_attributes=True) is the Pydantic V2 way to allow 
# # the model to read data from SQLAlchemy ORM objects and dictionaries.
# class BaseSchema(BaseModel):
#     model_config = ConfigDict(from_attributes=True)

# class UploadResponse(BaseSchema):
#     file_id: str
#     filename: str

# class OCRResponse(BaseSchema):
#     file_id: str
#     text_extracted: bool
#     full_text: str

# # ---------- Milestone 4: Analysis & Fairness ----------

# class RiskFactor(BaseSchema):
#     name: str
#     severity: int = 1  # Default to low risk if not found
#     description: str

# class HiddenFee(BaseSchema):
#     fee_name: str
#     amount: Optional[float] = 0.0
#     currency: Optional[str] = "USD"
#     frequency: Optional[str] = "one-time"
#     clause_excerpt: Optional[str] = None

# class PriceFactors(BaseSchema):
#     base_price: Optional[float] = 0.0
#     total_monthly_payment: Optional[float] = 0.0
#     total_due_at_signing: Optional[float] = 0.0
#     estimated_total_cost: Optional[float] = 0.0
#     currency: Optional[str] = "USD"

# class FairnessInfo(BaseSchema):
#     score: int = 5
#     rating: Literal["Fair", "Moderate", "Unfair"] = "Moderate"
#     explanation: str

# class ContractAnalysisPayload(BaseSchema):
#     file_id: str
#     # Using Field(default_factory=list) ensures if the AI finds 0 risks, 
#     # the code receives [] instead of crashing on None.
#     risk_factors: List[RiskFactor] = Field(default_factory=list)
#     price_factors: PriceFactors
#     hidden_fees: List[HiddenFee] = Field(default_factory=list)
#     fairness: FairnessInfo

# class AnalysisResponse(ContractAnalysisPayload):
#     pass

# # ---------- Milestone 4: Chatbot ----------

# class ChatMessage(BaseSchema):
#     role: Literal["user", "assistant"]
#     content: str

# class ChatRequest(BaseSchema):
#     message: str
#     file_id: Optional[str] = None
#     filename: Optional[str] = None
#     history: Optional[List[ChatMessage]] = Field(default_factory=list)
#     intent: Optional[Literal["chat", "email"]] = "chat"

# class ChatResponse(BaseSchema):
#     assistant_message: str
#     counter_email_draft: Optional[str] = None