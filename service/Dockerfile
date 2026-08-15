FROM python:3.11-slim

WORKDIR /app

# supercronic: long-running in-container scheduler (not a host-level timer,
# not an ephemeral per-run container — see the collection milestone's
# decision record for why).
ARG SUPERCRONIC_VERSION=v0.2.33
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
    && curl -fsSL -o /usr/local/bin/supercronic \
       "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${TARGETARCH}" \
    && chmod +x /usr/local/bin/supercronic \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
COPY src/ src/
RUN pip install --no-cache-dir .

COPY crontab /app/crontab

# tini is PID 1, not supercronic — supercronic's own zombie-reaping races
# with its fork/exec of cron jobs when it runs as PID 1 directly.
ENTRYPOINT ["/usr/bin/tini", "--", "supercronic", "/app/crontab"]
