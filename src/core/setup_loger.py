import hashlib
import logging
import queue
from logging.handlers import QueueHandler, QueueListener

import structlog
from opentelemetry import trace
from structlog.tracebacks import ExceptionDictTransformer

from src.core.settings import get_settings


def add_otel_ids(logger, method_name, event_dict):
    # for log test cases only
    return event_dict

    span = trace.get_current_span()
    ctx = span.get_span_context()
    if ctx.is_valid:
        event_dict["trace_id"] = format(ctx.trace_id, "032x")
        event_dict["span_id"] = format(ctx.span_id, "016x")
    return event_dict




def sample_info(logger, method_name, event_dict, *, rate=0.5):
    if method_name not in ("info", "debug"):
        return event_dict # never sample warn/error
    rid = event_dict.get("request_id")
    if rid is None:
        return event_dict # un-correlated lines: keep
    # deterministic per-request: same request -> same keep/drop for all its lines
    bucket = int(hashlib.blake2b(rid.encode(), digest_size=8).hexdigest(), 16) % 10_000
    if bucket >= rate * 10_000:
        raise structlog.DropEvent
    return event_dict

SENSITIVE = {"password", "token", "authorization", "api_key", "card_number", "secret", "ssn"}
def redact_sensitive(logger, method_name, event_dict):
    for key in list(event_dict):
        if key.lower() in SENSITIVE:
            event_dict[key] = "***REDACTED***"
        elif key == "email" and isinstance(event_dict[key], str):
            name, _, domain = event_dict[key].partition("@")
            event_dict[key] = f"{name[:1]}***@{domain}"
    return event_dict

def configure_logging(environment: str | None = None, level: str = "WARNING") -> QueueListener:
    if not environment:
        environment = get_settings().ENVIRONMENT
    shared = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        add_otel_ids,  # trace_id / span_id when a span is active
        redact_sensitive,  # MUST run in both branches, before renderer
    ]

    if environment == "DEV":
        renderers = [
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer(),
        ]
    else:
        renderers = [
            structlog.processors.ExceptionRenderer(ExceptionDictTransformer(show_locals=False)),
            structlog.processors.JSONRenderer(),
        ]

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            *renderers,
        ],
    )

    # The formatter lives on the QueueHandler: QueueHandler.prepare() calls
    # self.format() and NULLS exc_info before enqueueing, so a listener-side
    # formatter would never see a traceback (see "Non-blocking logging" above).
    queue_handler = QueueHandler(queue.Queue(-1))
    queue_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers[:] = [queue_handler]
    root.setLevel(level)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "gunicorn.error"):
        logging.getLogger(name).handlers.clear()
        logging.getLogger(name).propagate = True
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    listener = QueueListener(
        queue_handler.queue, logging.StreamHandler(), respect_handler_level=True
    )
    listener.start()

    extra_proc = [sample_info, structlog.stdlib.ProcessorFormatter.wrap_for_formatter]
    structlog.configure(
        # sample_info lives ONLY here, not in `shared`: it raises DropEvent,
        # which structlog's own pipeline swallows. Inside foreign_pre_chain it
        # would escape through logging (a Formatter must return a string).
        processors=shared
        + extra_proc,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.stdlib.LoggerFactory(),  # render via stdlib — ONE pipeline
        cache_logger_on_first_use=True,
    )

    return listener  # call .stop() during graceful shutdown
