# AI Visual Builder 10.18 - the hosted service as a container (Azure App Service for Containers, Azure Container Apps).
# Build from the repository root:   docker build -f deploy/Dockerfile -t aivb-pilot .
# Configuration comes only from the environment (deploy/app-settings.example.json); no key is ever in the image.
FROM python:3.12-slim
WORKDIR /app
COPY deploy/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
# the panel, its packs and the service (the Windows helper scripts and tests are not needed in the service)
COPY local-ai/*.py local-ai/*.js local-ai/*.html local-ai/config.json /app/local-ai/
COPY local-ai/packs /app/local-ai/packs
COPY local-ai/assets /app/local-ai/assets
RUN useradd --create-home aivb && mkdir -p /data && chown aivb /data
USER aivb
ENV AIVB_HOSTED=1 AIVB_DATA_DIR=/data PORT=8000 PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "/app/local-ai/server.py"]
