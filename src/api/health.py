import structlog
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()
log = structlog.get_logger("health")

@router.get("/healthz")
async def health_controller():
    return JSONResponse(
        content={"status": "ok"},
        status_code=200
    )

@router.get("/readyz")
async def ready_controller(req: Request):
    errors = []
    checks = {
        "DB": [lambda : req.app.state.db_manager.healthy(), False],
        "cache": [lambda : req.app.state.redis.ping(), False]
    }
    for check, state in checks.items():
        is_ok = False
        try:
            is_ok = bool(await state[0]())
        except Exception:
            log.exception("readyz check failed", check=check)
        finally:
            state[1] = is_ok

    code = 200
    for check, state in checks.items():
        if state[1] is False:
            code = 503
            errors.append(check)

    return JSONResponse(status_code=code, content=errors)
