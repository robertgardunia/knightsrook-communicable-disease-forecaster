# Fly-mediated exposure kernel layer
# Convolution of breeding-site intensity (sewage/open-defecation density,
# livestock concentration) with 5-7 mile distance-decay dispersal kernel,
# oriented by prevailing wind direction.
# Identifies settled villages within fly-transport range of contamination sources.
# TODO: scipy.ndimage convolution over rasterized breeding-site density

async def get_layer_data() -> dict:
    return {"type": "stub", "layer": "fly_kernel", "features": []}
