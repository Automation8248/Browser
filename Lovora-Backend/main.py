from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright
import os
import uuid
import asyncio

app = FastAPI(title="Lovora Cloud Browser API")

# CORS setup so GitHub Pages frontend can access this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Production mein isko apne github.io URL se replace karein
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory DB
USERS = {"admin": {"password": "password123", "api_key": "lovora_key_789"}}
ACTIVE_SESSIONS = {}
USER_DATA_DIR = "./browser_profiles"
os.makedirs(USER_DATA_DIR, exist_ok=True)

class LoginRequest(BaseModel):
    username: str
    password: str

class TabRequest(BaseModel):
    url: str

def verify_api_key(x_api_key: str = Header(...)):
    for username, data in USERS.items():
        if data["api_key"] == x_api_key:
            return username
    raise HTTPException(status_code=401, detail="Invalid API Key")

@app.post("/api/login")
async def login(req: LoginRequest):
    user = USERS.get(req.username)
    if not user or user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"api_key": user["api_key"]}

@app.post("/api/browser/start")
async def start_browser(username: str = Depends(verify_api_key)):
    session_id = str(uuid.uuid4())
    profile_path = os.path.join(USER_DATA_DIR, username)
    
    playwright = await async_playwright().start()
    browser_context = await playwright.chromium.launch_persistent_context(
        user_data_dir=profile_path, headless=True
    )
    
    ACTIVE_SESSIONS[session_id] = {"context": browser_context, "playwright": playwright, "tabs": {}}
    return {"session_id": session_id}

@app.post("/api/browser/{session_id}/goto")
async def goto_url(session_id: str, req: TabRequest, username: str = Depends(verify_api_key)):
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    
    context = ACTIVE_SESSIONS[session_id]["context"]
    page = await context.new_page()
    await page.goto(req.url, wait_until="networkidle")
    
    tab_id = str(uuid.uuid4())
    ACTIVE_SESSIONS[session_id]["tabs"][tab_id] = page
    
    # Take screenshot immediately to show in frontend
    screenshot_bytes = await page.screenshot()
    import base64
    b64_image = base64.b64encode(screenshot_bytes).decode('utf-8')
    
    return {"tab_id": tab_id, "screenshot": f"data:image/png;base64,{b64_image}"}

@app.post("/api/browser/close/{session_id}")
async def close_browser(session_id: str, username: str = Depends(verify_api_key)):
    if session_id in ACTIVE_SESSIONS:
        await ACTIVE_SESSIONS[session_id]["context"].close()
        await ACTIVE_SESSIONS[session_id]["playwright"].stop()
        del ACTIVE_SESSIONS[session_id]
        return {"status": "closed"}
    return {"status": "not found"}
