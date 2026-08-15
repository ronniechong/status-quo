"""Langfuse Cloud tracing for interpretation calls.

Kept optional and injectable (see `interpret.interpret_incident`'s
`trace_fn` param) rather than a hard dependency baked into the call path —
tracing failing should never take down tagging.

`sample_rate` exists because a full back-catalogue re-interpretation run
can spike trace volume sharply in one go and risk the Langfuse Cloud
free-tier trace ceiling; normal per-cycle tagging runs at sample_rate=1.0.
"""

from __future__ import annotations

import logging
import os
import random

logger = logging.getLogger("status_quo.tracing")

LANGFUSE_SECRET_KEY = os.environ.get("LANGFUSE_SECRET_KEY")
LANGFUSE_PUBLIC_KEY = os.environ.get("LANGFUSE_PUBLIC_KEY")
LANGFUSE_BASE_URL = os.environ.get("LANGFUSE_BASE_URL")


def _langfuse_client():
    if not (LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY):
        return None
    try:
        from langfuse import Langfuse
    except ImportError:
        logger.warning("langfuse package not installed — tracing disabled")
        return None
    return Langfuse(
        secret_key=LANGFUSE_SECRET_KEY,
        public_key=LANGFUSE_PUBLIC_KEY,
        host=LANGFUSE_BASE_URL,
    )


def make_trace_fn(prompt_version: str, sample_rate: float = 1.0):
    """Returns (trace_fn, flush_fn). trace_fn is passed to
    `interpret.interpret_incident`; flush_fn should be called once at the
    end of a batch to force delivery before a short-lived process exits,
    rather than relying on the SDK's atexit handler alone. Both are no-ops
    if Langfuse isn't configured.
    """
    client = _langfuse_client()
    if client is None:
        return None, lambda: None

    def trace_fn(model_used: str, user_content: str, parsed: dict) -> None:
        if sample_rate < 1.0 and random.random() > sample_rate:
            return
        try:
            client.start_observation(
                name="interpret_incident",
                as_type="generation",
                model=model_used,
                input=user_content,
                output=parsed,
                metadata={"prompt_version": prompt_version},
            ).end()
        except Exception as exc:  # tracing must never break tagging
            logger.warning("langfuse trace failed: %s", exc)

    def flush_fn() -> None:
        try:
            client.flush()
        except Exception as exc:
            logger.warning("langfuse flush failed: %s", exc)

    return trace_fn, flush_fn
