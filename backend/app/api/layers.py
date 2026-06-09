from fastapi import APIRouter, Query
from app.subsystems import idm_baseline, hydrogeology, transhumance, fly_kernel, cross_border, surveillance

router = APIRouter(prefix="/layers")

LAYERS = {
    "idm_baseline": idm_baseline,
    "hydrogeology":  hydrogeology,
    "transhumance":  transhumance,
    "fly_kernel":    fly_kernel,
    "cross_border":  cross_border,
    "surveillance":  surveillance,
}


@router.get("")
async def list_layers():
    return {"success": True, "data": list(LAYERS.keys()), "error": None}


@router.get("/{layer_id}")
async def get_layer(layer_id: str, date: str | None = Query(default=None)):
    if layer_id not in LAYERS:
        return {"success": False, "data": None, "error": f"Unknown layer: {layer_id}"}
    data = await LAYERS[layer_id].get_layer_data(reference_date=date)
    return {"success": True, "data": data, "error": None}
