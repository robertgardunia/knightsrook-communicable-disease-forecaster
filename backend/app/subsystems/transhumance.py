# Transhumance displacement vectors
# Sources: FAO transhumance baselines, IOM DTM, GRACE-derived pasture stress,
#          Sentinel-2 satellite-detected encampment locations (10m, 5-day revisit).
# Predicts where mobile populations will concentrate this season vs. historical baseline.
# TODO: integrate Clay/Prithvi foundation model for encampment detection

async def get_layer_data() -> dict:
    return {"type": "stub", "layer": "transhumance", "features": []}
