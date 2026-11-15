from redis.asyncio import Redis
from redis.asyncio.cluster import RedisCluster

from src.core.settings import get_settings


def create_redis_client():
    s = get_settings()
    if s.REDIS.CLUSTER:
        return RedisCluster(
            host=s.REDIS.HOST,
            port=s.REDIS.PORT,
            username=s.REDIS.USERNAME,
            password=s.REDIS.PASSWORD,
            ssl=s.REDIS.SSL,
            decode_responses=s.REDIS.DECODE_RESPONSES,
            max_connections=s.REDIS.MAX_CONNECTIONS,
            health_check_interval=s.REDIS.HEALTH_CHECK_INTERVAL,
            socket_connect_timeout=2,
            socket_timeout=2
        )
    else:
        return Redis(
            host=s.REDIS.HOST,
            port=s.REDIS.PORT,
            username=s.REDIS.USERNAME,
            password=s.REDIS.PASSWORD,
            ssl=s.REDIS.SSL,
            decode_responses=s.REDIS.DECODE_RESPONSES,
            max_connections=s.REDIS.MAX_CONNECTIONS,
            health_check_interval=s.REDIS.HEALTH_CHECK_INTERVAL,
            socket_connect_timeout=2,
            socket_timeout=2
        )
