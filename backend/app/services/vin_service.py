from functools import lru_cache
import httpx

@lru_cache(maxsize=100)
def _fetch_vin_data(vin: str) -> dict:
    # Use the public NHTSA API
    url = f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin}?format=json"

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url)
            response.raise_for_status()
            data = response.json()
    except Exception:
        return {}

    results = data.get("Results", [])
    car_info = {"vin": vin}
    
    mapping = {
        "Make": "make",
        "Model": "model",
        "Model Year": "year",
        "Trim": "trim"
    }

    for item in results:
        variable = item.get("Variable")
        value = item.get("Value")
        if variable in mapping and value and value.strip():
            car_info[mapping[variable]] = value

    return car_info

async def decode_vin(vin: str) -> dict:
    return _fetch_vin_data(vin)

def get_vehicle_details(vin: str) -> dict:
    return _fetch_vin_data(vin)


# ✅ SINGLE PUBLIC FUNCTION (use everywhere)
async def decode_vin(vin: str) -> dict:
    return _fetch_vin_data(vin)


# ✅ BACKWARD COMPATIBILITY (important for pricing_service)
def get_vehicle_details(vin: str) -> dict:
    return _fetch_vin_data(vin)
