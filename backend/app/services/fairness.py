from typing import List, Optional
from app.api import schemas

def compute_fairness(
    risk_factors: List[schemas.RiskFactor],
    hidden_fees: List[schemas.HiddenFee],
    price_factors: schemas.PriceFactors,
    junk_fees_raw: Optional[List[str]] = None
) -> schemas.FairnessInfo:
    """
    Standardized Strict Fairness Logic:
    Calculates a score from 0-100. 
    A single junk fee or high-risk severity will tank the score below 40 (Unfair).
    """
    
    # 1. CONSOLIDATE HIDDEN FEES
    # Count both structured objects from AI and raw strings
    structured_fee_count = len(hidden_fees)
    raw_fee_count = len(junk_fees_raw) if junk_fees_raw else 0
    total_fee_count = structured_fee_count + raw_fee_count

    # 2. RISK SEVERITY LOGIC
    # Average severity (1–5). 
    # If junk fees exist but no specific risks are defined by AI, 
    # we assume a baseline penalty severity of 3.0.
    if risk_factors:
        avg_severity = sum(r.severity for r in risk_factors) / len(risk_factors)
    else:
        avg_severity = 3.0 if total_fee_count > 0 else 1.0

    # 3. FINANCIAL RATIO (Hidden Fees vs Total Cost)
    total_hidden_amount = sum(f.amount for f in hidden_fees if f.amount is not None)
    estimated_total = price_factors.estimated_total_cost or 0.0
    
    if estimated_total > 0:
        amount_ratio = total_hidden_amount / estimated_total
    else:
        amount_ratio = 0.0

    # 4. SUB-SCORE CALCULATIONS (0-100, higher is better)
    # --- NUCLEAR PENALTIES ---
    # Risk Score: Drops 35 points per severity level beyond 1.
    risk_score = max(0, 100 - ((avg_severity - 1) * 30))
    
    # Fee Score: Drops 60 points per fee. (1 fee = 40/100, 2 fees = 0/100).
    fee_score = max(0, 100 - min(total_fee_count * 45, 100))
    
    # Amount Score: Penalizes if hidden costs exceed 2% of total cost.
    amount_score = max(0, 100 - min(amount_ratio * 500, 100))

    # 5. FINAL WEIGHTED SCORE
    # Red Flags (Fees & Risks) take 90% priority.
    # Pricing math takes 10% priority.
    final_score = round(0.45 * risk_score + 0.45 * fee_score + 0.1 * amount_score)

    # 6. RATING & EXPLANATION
    if final_score >= 75:
        rating = "Fair"
    elif final_score >= 50:
        rating = "Moderate"
    else:
        rating = "Unfair"

    # Generate the explanation for the Negotiation Page
    reasons = []
    if total_fee_count > 0:
        reasons.append(f"{total_fee_count} junk fee(s) detected")
    if avg_severity >= 3:
        reasons.append("high-risk termination clauses")
    if amount_ratio > 0.03:
        reasons.append("significant hidden cost ratio")

    if not reasons:
        explanation = "The contract is transparent and follows market standards."
    else:
        explanation = f"Unfair items found: {', '.join(reasons)}. This makes the deal financially risky."

    return schemas.FairnessInfo(
        score=final_score,
        rating=rating,
        explanation=explanation,
    )






# from typing import List

# from app.api import schemas


# def compute_fairness(
#     risk_factors: List[schemas.RiskFactor],
#     hidden_fees: List[schemas.HiddenFee],
#     price_factors: schemas.PriceFactors,
# ) -> schemas.FairnessInfo:
#     # Average severity (1–5); if none, treat as low risk
#     if risk_factors:
#         avg_severity = sum(r.severity for r in risk_factors) / len(risk_factors)
#     else:
#         avg_severity = 1.0

#     hidden_fee_count = len(hidden_fees)

#     total_hidden = sum(f.amount for f in hidden_fees if f.amount is not None)
#     estimated_total = price_factors.estimated_total_cost or 0.0
#     if estimated_total > 0:
#         amount_ratio = total_hidden / estimated_total
#     else:
#         amount_ratio = 0.0

#     # Convert to sub-scores 0–100 (higher is better)
#     risk_score = max(0, 100 - avg_severity * 20)
#     fee_score = max(0, 100 - hidden_fee_count * 15)

#     #risk_score = max(0, 100 - avg_severity * 15)
#     #fee_score = max(0, 100 - hidden_fee_count * 10)
#     amount_score = max(0, 100 - min(amount_ratio * 200, 100))

#     final_score = round(0.4 * risk_score + 0.3 * fee_score + 0.3 * amount_score)

#     if final_score >= 75:
#         rating = "Fair"
#     elif final_score >= 50:
#         rating = "Moderate"
#     else:
#         rating = "Unfair"

#     explanation_parts = [
#         f"Average risk severity: {avg_severity:.1f}",
#         f"Hidden fee count: {hidden_fee_count}",
#         f"Estimated hidden-fee ratio: {amount_ratio:.2f}",
#     ]
#     explanation = "; ".join(explanation_parts)

#     return schemas.FairnessInfo(
#         score=final_score,
#         rating=rating,
#         explanation=explanation,
#     )
