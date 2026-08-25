FROM python:3.12-slim
WORKDIR /app

# Prisma Client Python downloads a Node binary that needs libatomic.
RUN apt-get update && apt-get install -y --no-install-recommends libatomic1 && rm -rf /var/lib/apt/lists/*

# Install backend dependencies.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the Prisma schema and generate the sync client before the full source.
COPY backend/prisma/schema.prisma backend/prisma/schema.prisma
RUN python -m prisma generate --schema backend/prisma/schema.prisma

# Copy application source.
COPY backend ./backend

EXPOSE 8000 8001

# Apply the schema on startup (dev convenience) then launch the API.
CMD ["sh", "-c", "python -m prisma db push --schema backend/prisma/schema.prisma --accept-data-loss && python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000"]
