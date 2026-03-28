from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, date, timedelta
import os
from contextlib import asynccontextmanager
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# Environment variables
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wazir_dairy")

# Global variables
db = None
scheduler = AsyncIOScheduler()

# Pydantic Models
class User(BaseModel):
    id: str
    name: str
    phone: str
    pin: str
    expo_push_token: Optional[str] = None

class LoginRequest(BaseModel):
    phone: str
    pin: str
    expo_push_token: Optional[str] = None

class Investment(BaseModel):
    id: str
    amount: float
    date: str
    category: str
    created_by: str
    deleted: bool = False

class Expenditure(BaseModel):
    id: str
    amount: float
    date: str
    category: str
    created_by: str
    deleted: bool = False

class MilkSale(BaseModel):
    id: str
    earnings: float
    date: str
    created_by: str
    deleted: bool = False

class DairyLockSale(BaseModel):
    id: str
    earnings: float
    date: str
    created_by: str
    deleted: bool = False

class Event(BaseModel):
    id: str
    date: str
    description: str
    created_by: str
    reminder: Optional[str] = None
    reminder_date: Optional[str] = None
    deleted: bool = False

class Notification(BaseModel):
    id: str
    type: str
    message: str
    data: Dict
    read_by: List[str] = []
    reactions: Dict[str, str] = {}
    created_at: str

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Start background scheduler for reminders
    scheduler.add_job(
        check_reminders,
        CronTrigger(hour=9, minute=0),  # Check daily at 9 AM
        id='reminder_checker',
        replace_existing=True
    )
    scheduler.start()
    
    print("✅ Database connected and scheduler started")
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    client.close()
    print("🔴 Database connection closed and scheduler stopped")

app = FastAPI(lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper Functions
async def send_push_notification(expo_token: str, title: str, body: str, data: Dict = None):
    """Send push notification via Expo"""
    if not expo_token or not expo_token.startswith('ExponentPushToken'):
        return
    
    message = {
        "to": expo_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {}
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                timeout=10.0
            )
            print(f"Push notification sent: {response.status_code}")
        except Exception as e:
            print(f"Error sending push notification: {e}")

async def create_notification(type: str, message: str, data: Dict):
    """Create a notification in the database"""
    notification = {
        "id": str(datetime.utcnow().timestamp()),
        "type": type,
        "message": message,
        "data": data,
        "read_by": [],
        "reactions": {},
        "created_at": datetime.utcnow().isoformat()
    }
    await db.notifications.insert_one(notification)
    return notification

async def notify_all_users(title: str, body: str, notification_type: str, data: Dict):
    """Send push notifications to all users and create notification record"""
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    
    # Create notification in database
    await create_notification(notification_type, body, data)
    
    # Send push to all users with tokens
    for user in users:
        if user.get("expo_push_token"):
            await send_push_notification(user["expo_push_token"], title, body, data)

async def check_reminders():
    """Background task to check for due reminders"""
    today = date.today().isoformat()
    
    # Find events with reminders due today
    events = await db.events.find({
        "reminder_date": today,
        "deleted": False
    }, {"_id": 0}).to_list(1000)
    
    for event in events:
        title = "Event Reminder"
        body = f"Upcoming event: {event['description']} on {event['date']}"
        data = {"type": "event_reminder", "event_id": event['id'], "screen": "wrx"}
        
        await notify_all_users(title, body, "event_reminder", data)
        print(f"Reminder sent for event: {event['description']}")

# Auth Routes
@app.post("/api/auth/login")
async def login(request: LoginRequest):
    user = await db.users.find_one({"phone": request.phone, "pin": request.pin}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update expo push token if provided
    if request.expo_push_token:
        await db.users.update_one(
            {"phone": request.phone},
            {"$set": {"expo_push_token": request.expo_push_token}}
        )
        user["expo_push_token"] = request.expo_push_token
    
    return {"message": "Login successful", "user": user}

@app.post("/api/auth/register")
async def register(user: User):
    existing = await db.users.find_one({"phone": user.phone}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    await db.users.insert_one(user.dict())
    return {"message": "User registered successfully"}

# Investment Routes
@app.get("/api/investments")
async def get_investments():
    investments = await db.investments.find({}, {"_id": 0}).to_list(1000)
    return investments

@app.post("/api/investments")
async def create_investment(investment: Dict = Body(...)):
    investment["id"] = str(datetime.utcnow().timestamp())
    await db.investments.insert_one(investment)
    
    # Notify all users
    title = "New Investment"
    body = f"{investment['created_by']} added ₹{investment['amount']} investment in {investment['category']}"
    data = {"type": "investment_created", "investment_id": investment['id']}
    await notify_all_users(title, body, "investment_created", data)
    
    return investment

@app.patch("/api/investments/{investment_id}")
async def update_investment(investment_id: str, update_data: Dict = Body(...)):
    result = await db.investments.update_one(
        {"id": investment_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    # Notify all users about the update
    if not update_data.get("deleted"):
        title = "Investment Updated"
        body = f"An investment was updated"
        data = {"type": "investment_updated", "investment_id": investment_id}
        await notify_all_users(title, body, "investment_updated", data)
    else:
        title = "Investment Deleted"
        body = f"An investment was deleted"
        data = {"type": "investment_deleted", "investment_id": investment_id}
        await notify_all_users(title, body, "investment_deleted", data)
    
    return {"message": "Investment updated successfully"}

# Expenditure Routes
@app.get("/api/expenditures")
async def get_expenditures():
    expenditures = await db.expenditures.find({}, {"_id": 0}).to_list(1000)
    return expenditures

@app.post("/api/expenditures")
async def create_expenditure(expenditure: Dict = Body(...)):
    expenditure["id"] = str(datetime.utcnow().timestamp())
    await db.expenditures.insert_one(expenditure)
    
    title = "New Expenditure"
    body = f"{expenditure['created_by']} added ₹{expenditure['amount']} expenditure in {expenditure['category']}"
    data = {"type": "expenditure_created", "expenditure_id": expenditure['id']}
    await notify_all_users(title, body, "expenditure_created", data)
    
    return expenditure

@app.patch("/api/expenditures/{expenditure_id}")
async def update_expenditure(expenditure_id: str, update_data: Dict = Body(...)):
    result = await db.expenditures.update_one(
        {"id": expenditure_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Expenditure not found")
    
    if not update_data.get("deleted"):
        title = "Expenditure Updated"
        body = f"An expenditure was updated"
        data = {"type": "expenditure_updated", "expenditure_id": expenditure_id}
        await notify_all_users(title, body, "expenditure_updated", data)
    else:
        title = "Expenditure Deleted"
        body = f"An expenditure was deleted"
        data = {"type": "expenditure_deleted", "expenditure_id": expenditure_id}
        await notify_all_users(title, body, "expenditure_deleted", data)
    
    return {"message": "Expenditure updated successfully"}

# Milk Sales Routes
@app.get("/api/milk-sales")
async def get_milk_sales():
    sales = await db.milk_sales.find({}, {"_id": 0}).to_list(1000)
    return sales

@app.post("/api/milk-sales")
async def create_milk_sale(sale: Dict = Body(...)):
    sale["id"] = str(datetime.utcnow().timestamp())
    await db.milk_sales.insert_one(sale)
    
    title = "New Milk Sale"
    body = f"{sale['created_by']} added ₹{sale['earnings']} milk sale"
    data = {"type": "milk_sale_created", "sale_id": sale['id']}
    await notify_all_users(title, body, "milk_sale_created", data)
    
    return sale

@app.patch("/api/milk-sales/{sale_id}")
async def update_milk_sale(sale_id: str, update_data: Dict = Body(...)):
    result = await db.milk_sales.update_one(
        {"id": sale_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Milk sale not found")
    
    if not update_data.get("deleted"):
        title = "Milk Sale Updated"
        body = f"A milk sale was updated"
        data = {"type": "milk_sale_updated", "sale_id": sale_id}
        await notify_all_users(title, body, "milk_sale_updated", data)
    else:
        title = "Milk Sale Deleted"
        body = f"A milk sale was deleted"
        data = {"type": "milk_sale_deleted", "sale_id": sale_id}
        await notify_all_users(title, body, "milk_sale_deleted", data)
    
    return {"message": "Milk sale updated successfully"}

# Dairy Lock Sales Routes
@app.get("/api/dairy-lock-sales")
async def get_dairy_lock_sales():
    sales = await db.dairy_lock_sales.find({}, {"_id": 0}).to_list(1000)
    return sales

@app.post("/api/dairy-lock-sales")
async def create_dairy_lock_sale(sale: Dict = Body(...)):
    sale["id"] = str(datetime.utcnow().timestamp())
    await db.dairy_lock_sales.insert_one(sale)
    
    title = "New Dairy Lock Sale"
    body = f"{sale['created_by']} added ₹{sale['earnings']} DLS"
    data = {"type": "dls_created", "sale_id": sale['id']}
    await notify_all_users(title, body, "dls_created", data)
    
    return sale

@app.patch("/api/dairy-lock-sales/{sale_id}")
async def update_dairy_lock_sale(sale_id: str, update_data: Dict = Body(...)):
    result = await db.dairy_lock_sales.update_one(
        {"id": sale_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Dairy lock sale not found")
    
    if not update_data.get("deleted"):
        title = "DLS Updated"
        body = f"A dairy lock sale was updated"
        data = {"type": "dls_updated", "sale_id": sale_id}
        await notify_all_users(title, body, "dls_updated", data)
    else:
        title = "DLS Deleted"
        body = f"A dairy lock sale was deleted"
        data = {"type": "dls_deleted", "sale_id": sale_id}
        await notify_all_users(title, body, "dls_deleted", data)
    
    return {"message": "Dairy lock sale updated successfully"}

# Event Routes
@app.get("/api/events")
async def get_events():
    events = await db.events.find({}, {"_id": 0}).to_list(1000)
    return events

@app.post("/api/events")
async def create_event(event: Dict = Body(...)):
    event["id"] = str(datetime.utcnow().timestamp())
    await db.events.insert_one(event)
    
    title = "New Event"
    body = f"{event['created_by']} created event: {event['description']} on {event['date']}"
    data = {"type": "event_created", "event_id": event['id'], "screen": "wrx"}
    await notify_all_users(title, body, "event_created", data)
    
    return event

@app.patch("/api/events/{event_id}")
async def update_event(event_id: str, update_data: Dict = Body(...)):
    result = await db.events.update_one(
        {"id": event_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not update_data.get("deleted"):
        title = "Event Updated"
        body = f"An event was updated"
        data = {"type": "event_updated", "event_id": event_id, "screen": "wrx"}
        await notify_all_users(title, body, "event_updated", data)
    else:
        title = "Event Deleted"
        body = f"An event was deleted"
        data = {"type": "event_deleted", "event_id": event_id, "screen": "wrx"}
        await notify_all_users(title, body, "event_deleted", data)
    
    return {"message": "Event updated successfully"}

# Notification Routes
@app.get("/api/notifications")
async def get_notifications():
    notifications = await db.notifications.find({}, {"_id": 0}).to_list(1000)
    # Sort by created_at descending
    notifications.sort(key=lambda x: x['created_at'], reverse=True)
    return notifications

@app.post("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, data: Dict = Body(...)):
    user_name = data.get("user_name")
    
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$addToSet": {"read_by": user_name}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@app.post("/api/notifications/{notification_id}/react")
async def react_to_notification(notification_id: str, data: Dict = Body(...)):
    user_name = data.get("user_name")
    reaction = data.get("reaction")
    
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {f"reactions.{user_name}": reaction}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Reaction added"}

# Dashboard Stats Route
@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    # Get all data
    investments = await db.investments.find({"deleted": False}, {"_id": 0}).to_list(1000)
    expenditures = await db.expenditures.find({"deleted": False}, {"_id": 0}).to_list(1000)
    milk_sales = await db.milk_sales.find({"deleted": False}, {"_id": 0}).to_list(1000)
    dls = await db.dairy_lock_sales.find({"deleted": False}, {"_id": 0}).to_list(1000)
    
    # Calculate totals
    total_investment = sum(inv['amount'] for inv in investments)
    total_expenditure = sum(exp['amount'] for exp in expenditures)
    total_milk_sales = sum(sale['earnings'] for sale in milk_sales)
    total_dls = sum(sale['earnings'] for sale in dls)
    
    # Net DLS (as requested in feedback)
    net_dls = total_dls
    
    return {
        "total_investment": total_investment,
        "total_expenditure": total_expenditure,
        "total_milk_sales": total_milk_sales,
        "total_dls": total_dls,
        "net_dls": net_dls,
        "net_profit": (total_milk_sales + total_dls) - total_expenditure
    }

# Health Check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
