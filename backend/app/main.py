from fastapi import FastAPI

app = FastAPI(
    title="AMR Clinical Decision Support API",
    version="0.1.0",
    description="Backend for the AMR Stewardship mobile app — "
                "Makerere College of Health Sciences.",
)


@app.get("/")
def root():
    return {
        "name": "AMR Clinical Decision Support API",
        "docs": "/docs",
        "api": "/api/v1",
    }


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}