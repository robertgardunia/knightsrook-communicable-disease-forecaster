from fastapi import APIRouter

router = APIRouter(prefix="/predictions")


@router.get("")
async def list_predictions():
    # TODO: fetch committed predictions from db
    return {"success": True, "data": [], "error": None}


@router.post("")
async def commit_prediction(prediction: dict):
    # TODO: persist date-stamped prediction to db; publish to event bus
    return {"success": True, "data": prediction, "error": None}
