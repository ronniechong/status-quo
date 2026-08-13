FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
COPY src/ src/

RUN pip install --no-cache-dir .

# Entrypoint intentionally left undefined here — the scheduling mechanism
# (cron vs. systemd timer) is decided at the collection milestone, not here.
