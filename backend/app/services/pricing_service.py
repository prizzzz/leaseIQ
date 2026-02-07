import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def calculate_fairness(contract_data: dict) -> dict:
    """
    Analyzes car contract financials and returns a fairness score (0-100).
    Logic based on Price-to-Market ratio (60%) and APR Impact (40%).
    """
    # 1. Extract Financials with safety defaults
    purchase_amount = float(contract_data.get("purchasePrice") or 0)
    monthly = float(contract_data.get("monthlyPaymentINR") or 0)
    term = int(contract_data.get("leaseTermMonths") or 0)
    down = float(contract_data.get("downPaymentINR") or 0)
    residual = float(contract_data.get("residualValueINR") or 0)
    apr = float(contract_data.get("aprPercent") or 0)

    # 2. Total Finance Cost Calculation
    total_finance_cost = (monthly * term) + down + residual
    
    # If Sticker Price is missing, estimate it from finance cost (assuming 10% markup)
    if purchase_amount == 0:
        purchase_amount = total_finance_cost * 0.90 

    # 3. Market Price Estimation
    car_year = contract_data.get("year") or 2024
    make = str(contract_data.get("make") or "Unknown")
    model = str(contract_data.get("model") or "Unknown")

    # We assume a base credit score of 720 for market estimation
    market_fair_price = estimate_price(car_year, make, model, 720)

    # 4. Scoring Logic (Weighted)
    # Price Weight: 60% of the score
    # Safeguard against 0 market price to avoid division by zero
    effective_market_price = max(market_fair_price, 1) 
    price_ratio = purchase_amount / effective_market_price
    
    if price_ratio <= 1.0:
        price_score = 100
    else:
        # Lose 5 points for every 1% over market price
        price_score = max(0, 100 - ((price_ratio - 1) * 100 * 5))

    # Interest Weight: 40% of the score
    if apr == 0:
        interest_score = 75  # Fair default if unknown
    elif apr <= 3.5:
        interest_score = 100 # Excellent (Incentivized rates)
    elif apr <= 7.0:
        interest_score = 85  # Standard/Good
    else:
        # Penalize heavily for double-digit APR
        interest_score = max(0, 100 - (apr * 6))

    # Final Combined Weighted Score
    fairness_score = int((price_score * 0.6) + (interest_score * 0.4))

    # 5. Deal Quality Assignment
    if fairness_score >= 85:
        deal_rating = "Excellent Deal"
    elif fairness_score >= 70:
        deal_rating = "Fair Deal"
    else:
        deal_rating = "Bad Deal (Check Interest/Price)"

    return {
        "fairness_score": fairness_score,
        "deal_rating": deal_rating,
        "purchase_amount": int(purchase_amount),
        "market_estimate": int(market_fair_price),
        "total_finance_cost": int(total_finance_cost),
        "apr_impact": "Positive" if apr < 5 else "Negative",
        "price_score": int(price_score),
        "interest_score": int(interest_score)
    }

def estimate_price(year, make, model, credit_score):
    """
    Estimates fair market value based on brand segment and depreciation.
    """
    make_upper = str(make).upper()
    
    # Segment-based Pricing
    luxury_brands = ["BMW", "MERCEDES-BENZ", "AUDI", "LEXUS", "PORSCHE", "LAND ROVER"]
    mid_range_brands = ["TOYOTA", "HONDA", "FORD", "CHEVROLET", "VOLKSWAGEN", "TESLA"]
    
    if make_upper in luxury_brands:
        base_price = 65000
    elif make_upper in mid_range_brands:
        base_price = 38000
    else:
        base_price = 28000 # Economy/Budget default

    # Depreciation Calculation
    try:
        current_year = datetime.now().year
        car_year = int(year) if str(year).isdigit() else current_year
        age = max(0, current_year - car_year)
        
        # Car value drops ~12% - 15% per year
        # Standard compound depreciation formula: P(1 - r)^t
        market_value = base_price * (0.86 ** age)
    except Exception as e:
        logger.warning(f"Price estimation year error: {e}")
        market_value = base_price * 0.85 # Default 15% drop

    # Credit Adjustment (Simulating purchase power)
    interest_factor = 1.0
    if credit_score >= 750: 
        interest_factor = 0.95 # Prime buyers get better vehicle pricing
    elif credit_score < 640: 
        interest_factor = 1.10 # Subprime often carries higher vehicle markups

    return int(market_value * interest_factor)






# import logging
# from app.services.vin_service import get_vehicle_details

# logger = logging.getLogger(__name__)

# def calculate_fairness(contract_data: dict) -> dict:
#     # 1. Extract Financials
#     purchase_amount = contract_data.get("purchasePrice") or 0
#     monthly = contract_data.get("monthlyPaymentINR") or 0
#     term = contract_data.get("leaseTermMonths") or 0
#     down = contract_data.get("downPaymentINR") or 0
#     residual = contract_data.get("residualValueINR") or 0
#     apr = contract_data.get("aprPercent") or 0  # <--- IMPORTANT

#     # 2. Total Finance Cost
#     total_finance_cost = (monthly * term) + down + residual
    
#     # If Sticker Price is missing, we use a more realistic estimate:
#     # We subtract a rough 10% from finance cost to estimate the actual car value
#     if purchase_amount == 0:
#         purchase_amount = total_finance_cost * 0.90 

#     # 3. Market Estimation
#     car_year = contract_data.get("year") or 2023
#     make = contract_data.get("make", "Unknown")
#     model = contract_data.get("model", "Unknown")

#     market_fair_price = estimate_price(car_year, make, model, 720)

#     # 4. Scoring Logic (Weighted)
#     # Price Weight: 60% of the score
#     price_ratio = purchase_amount / market_fair_price
#     if price_ratio <= 1.0:
#         price_score = 100
#     else:
#         # Lose 5 points for every 1% over market
#         price_score = max(0, 100 - ((price_ratio - 1) * 100 * 5))

#     # Interest Weight: 40% of the score (This is where 1.02% APR shines!)
#     # A "Good" APR is under 5%. A "Bad" APR is over 10%.
#     if apr == 0:
#         interest_score = 70 # Neutral if unknown
#     elif apr <= 3:
#         interest_score = 100 # Excellent!
#     elif apr <= 6:
#         interest_score = 85
#     else:
#         interest_score = max(0, 100 - (apr * 6))

#     # Final Combined Score
#     fairness_score = int((price_score * 0.6) + (interest_score * 0.4))

#     # 5. Deal Quality
#     if fairness_score >= 85:
#         deal_rating = "Excellent Deal"
#     elif fairness_score >= 70:
#         deal_rating = "Fair Deal"
#     else:
#         deal_rating = "Bad Deal (Check Interest/Price)"

#     return {
#         "fairness_score": fairness_score,
#         "deal_rating": deal_rating,
#         "purchase_amount": int(purchase_amount),
#         "market_estimate": market_fair_price,
#         "total_finance_cost": int(total_finance_cost),
#         "apr_impact": "Positive" if apr < 4 else "Negative"
#     }

# def estimate_price(year, make, model, credit_score):
#     """
#     Estimates fair market value based on brand and depreciation.
#     """
#     # Dynamic Base Price for Luxury vs Economy
#     base_price = 35000
#     if make.upper() == "BMW":
#         base_price = 72000 # Realistic for an X3
#     elif make.upper() in ["MERCEDES-BENZ", "AUDI"]:
#         base_price = 68000
        
#     try:
#         current_year = 2026
#         car_year = int(year) if str(year).isdigit() else 2023
#         age = max(0, current_year - car_year)
        
#         # Standard Depreciation: ~12% per year
#         market_value = base_price * (0.88 ** age)
#     except Exception:
#         market_value = base_price * 0.80 # Default 20% drop

#     # Credit Adjustment (Simulating interest impact on value)
#     interest_factor = 1.05
#     if credit_score >= 750: interest_factor = 0.95
#     elif credit_score >= 650: interest_factor = 1.00

#     return int(market_value * interest_factor)