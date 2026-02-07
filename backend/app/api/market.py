from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, Any
from app.services.vin_service import decode_vin
from app.services.pricing_service import estimate_price
import logging

# Set up logging to catch errors in production
logger = logging.getLogger(__name__)

router = APIRouter()

class MarketAnalysisResponse(BaseModel):
    vehicle: Dict[str, Any]
    market_price: float  # Changed to float to prevent validation errors
    difference: float
    rating: str
    depreciation_info: str
    # Added these to support the "Gauge" UI on your frontend
    suggested_range: Dict[str, float] 

@router.get("/market-info/{vin}", response_model=MarketAnalysisResponse)
async def get_market_analysis(
    vin: str, 
    contract_price: float = Query(0.0, description="The price listed on the lease contract")
):
    try:
        # 1. Fetch real vehicle data
        vehicle_data = await decode_vin(vin)
        
        if not vehicle_data or "error" in vehicle_data:
            raise HTTPException(status_code=404, detail=f"VIN {vin} not found or invalid.")

        # 2. Extract Year, Make, Model
        year = int(vehicle_data.get("year", 2024))
        make = vehicle_data.get("make", "Unknown")
        model = vehicle_data.get("model", "Unknown")

        # 3. Use shared pricing logic
        market_fair_price = float(estimate_price(
            year=year,
            make=make,
            model=model,
            credit_score=720 
        ))

        # 4. Refined Comparison Logic
        deal_rating = "N/A"
        price_difference = 0.0
        
        if contract_price > 0:
            price_difference = contract_price - market_fair_price
            diff_percent = (price_difference / market_fair_price) * 100
            
            if diff_percent <= -5:
                deal_rating = "Great Deal! Paying below market value."
            elif diff_percent <= 5:
                deal_rating = "Fair Deal. Price is competitive."
            elif diff_percent <= 15:
                deal_rating = "Standard Market Price."
            else:
                deal_rating = "Overpriced. Consider negotiation."

        # 5. Provide a range for the Frontend Gauge (±5%)
        suggested_range = {
            "low": round(market_fair_price * 0.95, 2),
            "high": round(market_fair_price * 1.05, 2)
        }

        return {
            "vehicle": vehicle_data,
            "market_price": market_fair_price,
            "difference": round(price_difference, 2),
            "rating": deal_rating,
            "depreciation_info": "Calculated using integrated LeaseIQ Engine.",
            "suggested_range": suggested_range
        }

    except Exception as e:
        logger.error(f"Market Analysis Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error during market analysis.")