FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci
COPY frontend ./frontend
RUN npm run build:frontend

FROM golang:1.26-bookworm AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY backend ./backend
RUN CGO_ENABLED=0 go build -trimpath -o /clinic-api ./backend

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=backend /clinic-api ./clinic-api
COPY --from=frontend /app/frontend/dist ./frontend/dist
USER 65532:65532
ENV PORT=8080
EXPOSE 8080
CMD ["./clinic-api"]
