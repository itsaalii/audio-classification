import time
import sklearn
from fastapi import APIRouter, Request
from backend.app.schemas import HealthResult

router = APIRouter(prefix="/api", tags=["Health"])

_START_TIME = time.time()

@router.get("/health", response_model=HealthResult)
async def check_health(request: Request):
    """Mengecek status kesehatan server dan kesiapan model."""
    predictor = getattr(request.app.state, "predictor", None)
    model_loaded = predictor is not None and predictor.model is not None
    scaler_loaded = predictor is not None and predictor.scaler is not None

    return HealthResult(
        status="healthy" if (model_loaded and scaler_loaded) else "degraded",
        model_loaded=model_loaded,
        scaler_loaded=scaler_loaded,
        sklearn_version=sklearn.__version__,
        uptime_s=round(time.time() - _START_TIME, 2)
    )

