from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright
import os
import uuid
import base64

app = FastAPI(title="Lovora Cloud Browser API")

# CORS setup for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage (For production, you can use PostgreSQL later)
USER_DATA_DIR = "./browser_profiles"
os.makedirs(USER_DATA_DIR, exist_ok=True)

ACTIVE_SESSIONS = {}
VALID_API_KEYS = {"lovora@855524558248": "admin"}

class LoginRequest(BaseModel):
    username: str
    password: str

class UrlRequest(BaseModel):
    url: str

def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key not in VALID_API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return VALID_API_KEYS[x_api_key]

async def capture_screenshot(page):
    try:
        # Taking screenshot
        screenshot_bytes = await page.screenshot(timeout=10000)
        b64_image = base64.b64encode(screenshot_bytes).decode('utf-8')
        return f"data:image/png;base64,{b64_image}"
    except Exception as e:
        return ""

@app.post("/api/login")
async def login(req: LoginRequest):
    if req.username == "admin" and req.password == "password123":
        return {"api_key": "lovora_admin_key_123"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

# --- Browser & Tab Operations ---
@app.post("/api/browser/start")
async def start_browser(username: str = Depends(verify_api_key)):
    session_id = str(uuid.uuid4())
    profile_path = os.path.join(USER_DATA_DIR, username)
    
    playwright = await async_playwright().start()
    
    # LOW RAM MODE: Added arguments to prevent crash on Render free tier
    context = await playwright.chromium.launch_persistent_context(
        user_data_dir=profile_path, 
        headless=True,
        args=[
            "--no-sandbox", 
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--single-process"
        ]
    )
    
    # Open first default tab
    page = await context.new_page()
    await page.goto("https://google.com", wait_until="domcontentloaded", timeout=60000)
    tab_id = str(uuid.uuid4())
    
    ACTIVE_SESSIONS[session_id] = {"context": context, "playwright": playwright, "tabs": {tab_id: page}}
    
    screenshot = await capture_screenshot(page)
    return {"session_id": session_id, "tab_id": tab_id, "url": "https://google.com", "screenshot": screenshot}

@app.post("/api/browser/{session_id}/tabs/new")
async def new_tab(session_id: str, username: str = Depends(verify_api_key)):
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404)
    
    context = ACTIVE_SESSIONS[session_id]["context"]
    page = await context.new_page()
    await page.goto("https://google.com", wait_until="domcontentloaded", timeout=60000)
    
    tab_id = str(uuid.uuid4())
    ACTIVE_SESSIONS[session_id]["tabs"][tab_id] = page
    
    screenshot = await capture_screenshot(page)
    return {"tab_id": tab_id, "url": "https://google.com", "screenshot": screenshot}

@app.post("/api/browser/{session_id}/tabs/{tab_id}/goto")
async def goto_url(session_id: str, tab_id: str, req: UrlRequest, username: str = Depends(verify_api_key)):
    page = ACTIVE_SESSIONS.get(session_id, {}).get("tabs", {}).get(tab_id)
    if not page:
        raise HTTPException(status_code=404, detail="Tab not found")
    
    await page.goto(req.url, wait_until="domcontentloaded", timeout=60000)
    screenshot = await capture_screenshot(page)
    return {"url": page.url, "screenshot": screenshot}

@app.post("/api/browser/{session_id}/tabs/{tab_id}/{action}")
async def tab_actions(session_id: str, tab_id: str, action: str, username: str = Depends(verify_api_key)):
    page = ACTIVE_SESSIONS.get(session_id, {}).get("tabs", {}).get(tab_id)
    if not page:
        raise HTTPException(status_code=404)
    
    if action == "back":
        await page.go_back(wait_until="domcontentloaded", timeout=60000)
    elif action == "forward":
        await page.go_forward(wait_until="domcontentloaded", timeout=60000)
    elif action == "reload":
        await page.reload(wait_until="domcontentloaded", timeout=60000)
    elif action == "get":
        pass # Just return current state for background update
        
    screenshot = await capture_screenshot(page)
    return {"url": page.url, "screenshot": screenshot}

# --- API Key Management ---
@app.get("/api/settings/keys")
async def get_keys(username: str = Depends(verify_api_key)):
    return {"keys": list(VALID_API_KEYS.keys())}

@app.post("/api/settings/keys/generate")
async def generate_key(username: str = Depends(verify_api_key)):
    new_key = f"lovora_key_{str(uuid.uuid4())[:8]}"
    VALID_API_KEYS[new_key] = username
    return {"status": "success", "new_key": new_key}

@app.delete("/api/settings/keys/{key_to_delete}")
async def delete_key(key_to_delete: str, username: str = Depends(verify_api_key)):
    if key_to_delete in VALID_API_KEYS and len(VALID_API_KEYS) > 1:
        del VALID_API_KEYS[key_to_delete]
        return {"status": "deleted"}
    raise HTTPException(status_code=400, detail="Cannot delete default or invalid key")
