from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

router = APIRouter()

@router.get("/healthz")
async def health_controller():
    return JSONResponse(
        content={"status": "ok"},
        status_code=200
    )

@router.get("/readyz")
async def ready_controller(req: Request):
    code = 200 if await req.app.state.db_manager.healthy() else 503
    return Response(status_code=code)
