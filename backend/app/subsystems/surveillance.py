# Surveillance / detection latency layer
# Historical campaign coverage by union council showing persistent NA/missed patterns.
# Indicates immunity gaps the transmission model doesn't see.
# Produces the detection-latency surface (separate from transmission risk surface).
# TODO: ingest GPEI coverage data; compute detection latency per district

async def get_layer_data() -> dict:
    return {"type": "stub", "layer": "surveillance", "features": []}
