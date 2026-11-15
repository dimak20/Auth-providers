import asyncio
import json
import math
import random
import time
from collections.abc import Awaitable, Callable

from redis.asyncio import Redis
from redis.exceptions import LockError


def jittered_ttl(base: int, spread: float = 0.1) -> int:
    return int(base * (1 + random.uniform(-spread, spread)))

async def get_with_redis_lock(redis: Redis, key: str, ttl: int, loader: Callable[[], Awaitable]):
    cached = await redis.get(key)
    if cached is not None:
        return json.loads(cached)

    async def fill():
        try:
            async with redis.lock(f"lock:{key}", timeout=10, blocking_timeout=0.2):
                cached = await redis.get(key)
                if cached is not None:
                    return json.loads(cached)

                data = await loader()
                await redis.set(key, json.dumps(data, default=str), jittered_ttl(ttl))

                return data
        except LockError:
            return await loader()

    # (c) in-process coalescer in FRONT of the distributed lock: only one
    # coroutine per worker ever reaches redis.lock() for a given key.
    return await _sf.do(key, fill)

async def get_xfetch(
        redis: Redis, key: str, ttl: int, loader: Callable[[], Awaitable],
        encode, decode,
        beta: float = 1.0
    ):
    raw = await redis.get(key)
    if raw is not None:
        env = json.loads(raw)
        delta, expiry = env["delta"], env["expiry"]
        # Serve branch: not yet due for early recompute.
        # Equivalent to NOT (now - delta*beta*ln(rand) >= expiry).
        if time.time() - delta * beta * math.log(random.random()) < expiry:
            return decode(env["value"])
    # else: fall through and recompute *early*, while the old value is
    # still logically valid (we stored it to ex=ttl+60, so `raw` can and
    # often does exist past `expiry` — that is the whole point).
    start = time.monotonic()
    value = await loader()
    delta = time.monotonic() - start # how long recompute took
    expiry = time.time() + ttl

    await redis.set(
    key,
    json.dumps({"value": encode(value), "delta": delta, "expiry": expiry}, default=str),
    ex=ttl + 60, # store slightly past logical expiry
    )
    return value

class SingleFlight:
    """Coalesce concurrent calls for the same key into one in-process execution."""
    def __init__(self) -> None:
        self._inflight: dict[str, asyncio.Future] = {}
        self._lock = asyncio.Lock()
    async def do(self, key: str, fn: Callable[[], Awaitable]):
        async with self._lock:
            fut = self._inflight.get(key)
            if fut is None:
                fut = asyncio.get_running_loop().create_future()
                self._inflight[key] = fut
                leader = True
            else:
                leader = False
        if not leader:
            return await fut # follower: ride the leader's result
        try:
            result = await fn()
            fut.set_result(result)
            return result
        except Exception as exc:
            fut.set_exception(exc)
            raise
        finally:
            async with self._lock:
                self._inflight.pop(key, None)
_sf = SingleFlight()
