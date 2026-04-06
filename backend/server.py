from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from pytz import timezone

# 🆕 FEEDBACK #16: Import email reports module
from email_reports import setup_email_scheduler

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# FEEDBACK #6: Initialize scheduler for reminder notifications
IST = timezone('Asia/Kolkata')
scheduler = AsyncIOScheduler(timezone=IST)

# Helper to convert ObjectId to string
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

# FEEDBACK #5: Enhanced push notification helper
async def send_push_notification(from_user: str, title: str, body: str, data: Dict[str, Any] = None):
    """Send push notification to the other partner"""
    try:
        other_user = "Imran" if from_user == "Aadil" else "Aadil"
        user_doc = await db.users.find_one({"name": other_user})
        
        if not user_doc or "expo_push_token" not in user_doc:
            logging.warning(f"⚠️ No push token found for {other_user}")
            return

        token = user_doc["expo_push_token"]
        
        # Prepare the standard data payload for app routing
        # If no specific screen is provided, default to the WRX activity tab
        payload_data = data or {}
        if "type" not in payload_data:
            payload_data["type"] = "activity"
        if "screen" not in payload_data:
            payload_data["screen"] = "/(tabs)/wrx"

        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": payload_data,
            "channelId": "default"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                }
            )
            
            result = response.json()
            if response.status_code == 200:
                logging.info(f"✅ Push notification sent to {other_user}: {title}")
            else:
                logging.error(f"❌ Expo API Error: {result}")

    except Exception as e:
        logging.error(f"❌ Error sending push notification: {e}")

# FEEDBACK #6: Check for event reminders daily
async def check_event_reminders():
    try:
        IST = timezone('Asia/Kolkata')
        today = datetime.now(IST).date().isoformat()
        logging.info(f"Checking event reminders for {today}")
        
        events = await db.events.find({
            "reminder_date": today,
            "deleted": False
        }).to_list(1000)
        
        for event in events:
            body = f"Upcoming event: {event['description']} on {event['date']}"
            
            # Save to notification history
            notif_data = {
                "type": "event_reminder",
                "data": {"event_id": str(event["_id"]), "description": event['description']},
                "message": body,
                "created_at": datetime.utcnow()
            }
            await db.notifications.insert_one(notif_data)
            
            # Send Push to both partners
            for user_name in ["Aadil", "Imran"]:
                user_doc = await db.users.find_one({"name": user_name})
                if user_doc and user_doc.get("expo_push_token"):
                    # Use a single httpx client session for better performance if possible
                    async with httpx.AsyncClient() as client_http:
                        await client_http.post(
                            'https://exp.host/--/api/v2/push/send',
                            json={
                                "to": user_doc["expo_push_token"],
                                "title": "Event Reminder",
                                "body": body,
                                "data": {"screen": "/(tabs)/", "type": "event_reminder"},
                                "sound": "default"
                            }
                        )
    except Exception as e:
        logging.error(f"Error checking reminders: {e}")

# ==================== MODELS ====================

class User(BaseModel):
    name: str
    pin: str
    phone: str
    expo_push_token: Optional[str] = None

class UserLogin(BaseModel):
    name: str
    pin: str

class UpdatePushToken(BaseModel):
    name: str
    expo_push_token: str

class Investment(BaseModel):
    amount: float
    date: str
    investor: str
    category: str
    notes: Optional[str] = None
    deleted: bool = False
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class Expenditure(BaseModel):
    amount: float
    date: str
    paid_by: str
    category: str
    subcategory: str
    notes: Optional[str] = None
    deleted: bool = False
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class MilkSale(BaseModel):
    date: str
    volume: float
    fat_percentage: float
    rate: float = 8.4
    earnings: float
    deleted: bool = False
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class DairyLockSale(BaseModel):
    month: int
    year: int
    amount: float
    date: str
    notes: Optional[str] = None
    deleted: bool = False
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

# 🆕 FEEDBACK #9: Bills model for image uploads
class Bill(BaseModel):
    image: str  # base64 encoded image
    description: str
    amount: float
    date: str
    uploaded_by: str
    deleted: bool = False
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class Notification(BaseModel):
    type: str  # 'investment', 'expenditure', 'milk_sale', 'dls', 'deletion', 'event_reminder', 'bill'
    data: Dict[str, Any]
    message: str
    read_by: List[str] = []
    reactions: Dict[str, str] = {}  # {user: emoji}
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

# FEEDBACK #6: Updated CalendarEvent model with reminder fields
class CalendarEvent(BaseModel):
    date: str  # YYYY-MM-DD format
    description: str  # max 15 chars
    created_by: str
    reminder: Optional[str] = None  # '15_days', '1_month', '3_months', '6_months', '1_year'
    reminder_date: Optional[str] = None  # Calculated date when reminder should trigger
    deleted: bool = False
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class ReactionUpdate(BaseModel):
    notification_id: str
    user: str
    emoji: str

class ReadUpdate(BaseModel):
    notification_ids: List[str]
    user: str

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"name": credentials.name, "pin": credentials.pin})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"success": True, "user": {"name": user["name"], "phone": user["phone"]}}

@api_router.post("/auth/setup")
async def setup_users():
    existing = await db.users.count_documents({})
    if existing > 0:
        return {"message": "Users already set up"}
    
    users = [
        {"name": "Aadil", "pin": "1234", "phone": "+919340482240", "expo_push_token": None},
        {"name": "Imran", "pin": "5678", "phone": "+919669005006", "expo_push_token": None}
    ]
    await db.users.insert_many(users)
    return {"message": "Users created successfully"}

@api_router.post("/auth/update-push-token")
async def update_push_token(data: UpdatePushToken):
    await db.users.update_one(
        {"name": data.name},
        {"$set": {"expo_push_token": data.expo_push_token}}
    )
    logging.info(f"Updated push token for {data.name}")
    return {"success": True}

# ==================== INVESTMENT ENDPOINTS ====================

@api_router.post("/investments")
async def create_investment(investment: Investment):
    result = await db.investments.insert_one(investment.dict())
    notif = Notification(
        type="investment",
        data=investment.dict(),
        message=f"{investment.investor} added Investment - {investment.category} - ₹{investment.amount:,.0f} on {investment.date}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        investment.investor,
        "New Investment Added",
        f"{investment.investor} added Investment - {investment.category} - ₹{investment.amount:,.0f}",
        {"screen": "wrx", "type": "investment"}
    )
    
    return {"success": True, "id": str(result.inserted_id)}

@api_router.put("/investments/{investment_id}")
async def update_investment(investment_id: str, investment: Investment):
    await db.investments.update_one(
        {"_id": ObjectId(investment_id)},
        {"$set": investment.dict()}
    )
    notif = Notification(
        type="investment",
        data=investment.dict(),
        message=f"{investment.investor} updated Investment - {investment.category} - ₹{investment.amount:,.0f} on {investment.date}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        investment.investor,
        "Investment Updated",
        f"{investment.investor} updated Investment - {investment.category} - ₹{investment.amount:,.0f}",
        {"screen": "wrx", "type": "investment"}
    )
    
    return {"success": True}

@api_router.get("/investments")
async def get_investments(deleted: bool = False):
    investments = await db.investments.find({"deleted": deleted}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(inv) for inv in investments]

@api_router.delete("/investments/{investment_id}")
async def delete_investment(investment_id: str, user: str):
    inv = await db.investments.find_one({"_id": ObjectId(investment_id)})
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    await db.investments.update_one(
        {"_id": ObjectId(investment_id)},
        {"$set": {"deleted": True}}
    )
    
    notif = Notification(
        type="deletion",
        data={"type": "investment", "id": investment_id},
        message=f"{user} removed Investment entry - {inv['category']} - ₹{inv['amount']:,.0f} on {inv['date']}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        user,
        "Investment Deleted",
        f"{user} removed Investment - {inv['category']} - ₹{inv['amount']:,.0f}",
        {"screen": "wrx", "type": "deletion"}
    )
    
    return {"success": True}

# ==================== EXPENDITURE ENDPOINTS ====================

@api_router.post("/expenditures")
async def create_expenditure(expenditure: Expenditure):
    result = await db.expenditures.insert_one(expenditure.dict())
    notif = Notification(
        type="expenditure",
        data=expenditure.dict(),
        message=f"{expenditure.paid_by} added Expenditure - {expenditure.category}/{expenditure.subcategory} - ₹{expenditure.amount:,.0f} on {expenditure.date}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        expenditure.paid_by,
        "New Expenditure Added",
        f"{expenditure.paid_by} added Expenditure - {expenditure.category}/{expenditure.subcategory} - ₹{expenditure.amount:,.0f}",
        {"screen": "wrx", "type": "expenditure"}
    )
    
    return {"success": True, "id": str(result.inserted_id)}

@api_router.get("/expenditures")
async def get_expenditures(deleted: bool = False):
    expenditures = await db.expenditures.find({"deleted": deleted}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(exp) for exp in expenditures]

@api_router.patch("/expenditures/{expenditure_id}")
async def update_expenditure(expenditure_id: str, expenditure: Expenditure, user: str):
    exp = await db.expenditures.find_one({"_id": ObjectId(expenditure_id)})
    if not exp:
        raise HTTPException(status_code=404, detail="Expenditure not found")
    
    await db.expenditures.update_one(
        {"_id": ObjectId(expenditure_id)},
        {"$set": expenditure.dict(exclude_unset=True)}
    )
    
    notif = Notification(
        type="expenditure",
        data=expenditure.dict(),
        message=f"{user} updated Expenditure - {expenditure.category}/{expenditure.subcategory} - ₹{expenditure.amount:,.0f} on {expenditure.date}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        user,
        "Expenditure Updated",
        f"{user} updated Expenditure - {expenditure.category}/{expenditure.subcategory} - ₹{expenditure.amount:,.0f}",
        {"screen": "wrx", "type": "expenditure"}
    )
    
    return {"success": True}

@api_router.delete("/expenditures/{expenditure_id}")
async def delete_expenditure(expenditure_id: str, user: str):
    exp = await db.expenditures.find_one({"_id": ObjectId(expenditure_id)})
    if not exp:
        raise HTTPException(status_code=404, detail="Expenditure not found")
    
    await db.expenditures.update_one(
        {"_id": ObjectId(expenditure_id)},
        {"$set": {"deleted": True}}
    )
    
    notif = Notification(
        type="deletion",
        data={"type": "expenditure", "id": expenditure_id},
        message=f"{user} removed Expenditure entry - {exp['category']}/{exp['subcategory']} - ₹{exp['amount']:,.0f} on {exp['date']}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        user,
        "Expenditure Deleted",
        f"{user} removed Expenditure - {exp['category']}/{exp['subcategory']} - ₹{exp['amount']:,.0f}",
        {"screen": "wrx", "type": "deletion"}
    )
    
    return {"success": True}

# ==================== MILK SALES ENDPOINTS ====================

@api_router.post("/milk-sales")
async def create_milk_sale(sale: MilkSale):
    result = await db.milk_sales.insert_one(sale.dict())
    notif = Notification(
        type="milk_sale",
        data=sale.dict(),
        message=f"Milk Sale added for {sale.date} - {sale.volume}L at {sale.fat_percentage}% fat, Rate: ₹{sale.rate} = ₹{sale.earnings:,.0f}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        "System",
        "New Milk Sale",
        f"Milk Sale added for {sale.date} - ₹{sale.earnings:,.0f}",
        {"screen": "wrx", "type": "milk_sale"}
    )
    
    return {"success": True, "id": str(result.inserted_id)}

@api_router.get("/milk-sales")
async def get_milk_sales(deleted: bool = False):
    sales = await db.milk_sales.find({"deleted": deleted}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(sale) for sale in sales]

@api_router.patch("/milk-sales/{sale_id}")
async def update_milk_sale(sale_id: str, sale: MilkSale, user: str):
    existing_sale = await db.milk_sales.find_one({"_id": ObjectId(sale_id)})
    if not existing_sale:
        raise HTTPException(status_code=404, detail="Milk sale not found")
    
    await db.milk_sales.update_one(
        {"_id": ObjectId(sale_id)},
        {"$set": sale.dict(exclude_unset=True)}
    )
    
    notif = Notification(
        type="milk_sale",
        data=sale.dict(),
        message=f"{user} updated Milk Sale for {sale.date} - {sale.volume}L at {sale.fat_percentage}% fat = ₹{sale.earnings:,.0f}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        user,
        "Milk Sale Updated",
        f"{user} updated Milk Sale for {sale.date} - ₹{sale.earnings:,.0f}",
        {"screen": "wrx", "type": "milk_sale"}
    )
    
    return {"success": True}

@api_router.delete("/milk-sales/{sale_id}")
async def delete_milk_sale(sale_id: str, user: str):
    sale = await db.milk_sales.find_one({"_id": ObjectId(sale_id)})
    if not sale:
        raise HTTPException(status_code=404, detail="Milk sale not found")
    
    await db.milk_sales.update_one(
        {"_id": ObjectId(sale_id)},
        {"$set": {"deleted": True}}
    )
    
    notif = Notification(
        type="deletion",
        data={"type": "milk_sale", "id": sale_id},
        message=f"{user} removed Milk Sale entry for {sale['date']}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        user,
        "Milk Sale Deleted",
        f"{user} removed Milk Sale for {sale['date']}",
        {"screen": "wrx", "type": "deletion"}
    )
    
    return {"success": True}

# ==================== DAIRY LOCK SALES ENDPOINTS ====================

@api_router.post("/dairy-lock-sales")
async def create_dls(dls: DairyLockSale):
    result = await db.dairy_lock_sales.insert_one(dls.dict())
    notif = Notification(
        type="dls",
        data=dls.dict(),
        message=f"Dairy Lock Sale added for {dls.month}/{dls.year} - ₹{dls.amount:,.0f} on {dls.date}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        "System",
        "New DLS Payment",
        f"Dairy Lock Sale added for {dls.month}/{dls.year} - ₹{dls.amount:,.0f}",
        {"screen": "wrx", "type": "dls"}
    )
    
    return {"success": True, "id": str(result.inserted_id)}

@api_router.get("/dairy-lock-sales")
async def get_dls(deleted: bool = False):
    sales = await db.dairy_lock_sales.find({"deleted": deleted}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(sale) for sale in sales]

@api_router.patch("/dairy-lock-sales/{dls_id}")
async def update_dls(dls_id: str, dls: DairyLockSale, user: str):
    existing_dls = await db.dairy_lock_sales.find_one({"_id": ObjectId(dls_id)})
    if not existing_dls:
        raise HTTPException(status_code=404, detail="DLS not found")
    
    await db.dairy_lock_sales.update_one(
        {"_id": ObjectId(dls_id)},
        {"$set": dls.dict(exclude_unset=True)}
    )
    
    notif = Notification(
        type="dls",
        data=dls.dict(),
        message=f"{user} updated Dairy Lock Sale for {dls.month}/{dls.year} - ₹{dls.amount:,.0f} on {dls.date}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        user,
        "DLS Updated",
        f"{user} updated Dairy Lock Sale for {dls.month}/{dls.year} - ₹{dls.amount:,.0f}",
        {"screen": "wrx", "type": "dls"}
    )
    
    return {"success": True}

@api_router.delete("/dairy-lock-sales/{dls_id}")
async def delete_dls(dls_id: str, user: str):
    dls = await db.dairy_lock_sales.find_one({"_id": ObjectId(dls_id)})
    if not dls:
        raise HTTPException(status_code=404, detail="DLS not found")
    
    await db.dairy_lock_sales.update_one(
        {"_id": ObjectId(dls_id)},
        {"$set": {"deleted": True}}
    )
    
    notif = Notification(
        type="deletion",
        data={"type": "dls", "id": dls_id},
        message=f"{user} removed Dairy Lock Sale entry for {dls['month']}/{dls['year']}"
    )
    await db.notifications.insert_one(notif.dict())
    
    await send_push_notification(
        user,
        "DLS Deleted",
        f"{user} removed Dairy Lock Sale for {dls['month']}/{dls['year']}",
        {"screen": "wrx", "type": "deletion"}
    )
    
    return {"success": True}

# ==================== 🆕 BILLS ENDPOINTS (FEEDBACK #9) ====================

@api_router.post("/bills")
async def create_bill(bill: Bill):
    """Upload a bill with compressed image"""
    result = await db.bills.insert_one(bill.dict())
    
    # Create notification
    notif = Notification(
        type="bill",
        data=bill.dict(exclude={"image"}),  # Don't include image in notification
        message=f"{bill.uploaded_by} uploaded Bill - {bill.description} - ₹{bill.amount:,.0f} on {bill.date}"
    )
    await db.notifications.insert_one(notif.dict())
    
    # Send push notification
    await send_push_notification(
        bill.uploaded_by,
        "New Bill Uploaded",
        f"{bill.uploaded_by} uploaded Bill - {bill.description} - ₹{bill.amount:,.0f}",
        {"screen": "wrx", "type": "bill"}
    )
    
    return {"success": True, "id": str(result.inserted_id)}

@api_router.get("/bills")
async def get_bills(deleted: bool = False):
    """Get all bills"""
    bills = await db.bills.find({"deleted": deleted}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(bill) for bill in bills]

@api_router.delete("/bills/{bill_id}")
async def delete_bill(bill_id: str, user: str):
    """Soft delete a bill"""
    bill = await db.bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    await db.bills.update_one(
        {"_id": ObjectId(bill_id)},
        {"$set": {"deleted": True}}
    )
    
    # Create deletion notification
    notif = Notification(
        type="deletion",
        data={"type": "bill", "id": bill_id},
        message=f"{user} removed Bill entry - {bill['description']} - ₹{bill['amount']:,.0f}"
    )
    await db.notifications.insert_one(notif.dict())
    
    # Send push notification
    await send_push_notification(
        user,
        "Bill Deleted",
        f"{user} removed Bill - {bill['description']}",
        {"screen": "wrx", "type": "deletion"}
    )
    
    return {"success": True}

# ==================== NOTIFICATION ENDPOINTS ====================

@api_router.get("/notifications")
async def get_notifications(limit: int = 100):
    """
    🆕 FEEDBACK #6: Changed from 90 days to 30 days
    Get notifications from last 30 days
    """
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    notifications = await db.notifications.find(
        {"created_at": {"$gte": thirty_days_ago}}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [serialize_doc(notif) for notif in notifications]

@api_router.post("/notifications/mark-read")
async def mark_notifications_read(data: ReadUpdate):
    for notif_id in data.notification_ids:
        await db.notifications.update_one(
            {"_id": ObjectId(notif_id)},
            {"$addToSet": {"read_by": data.user}}
        )
    return {"success": True}

@api_router.post("/notifications/react")
async def react_to_notification(data: ReactionUpdate):
    await db.notifications.update_one(
        {"_id": ObjectId(data.notification_id)},
        {"$set": {f"reactions.{data.user}": data.emoji}}
    )
    return {"success": True}

# ==================== DASHBOARD STATS ====================

@api_router.get("/stats/dashboard")
async def get_dashboard_stats(month: Optional[int] = None, year: Optional[int] = None):
    try:
        # Default to current month/year if not provided
        now = datetime.now()
        target_month = month if month is not None else now.month
        target_year = year if year is not None else now.year

        # Create date filter for the specific month
        # Start of month
        start_date = datetime(target_year, target_month, 1).isoformat()
        # Start of next month
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1).isoformat()
        else:
            end_date = datetime(target_year, target_month + 1, 1).isoformat()

        date_filter = {"date": {"$gte": start_date, "$lt": end_date}, "deleted": {"$ne": True}}

        # 1. Monthly Expenditures
        exp_docs = await db.expenditures.find(date_filter).to_list(1000)
        total_exp = sum(float(d.get("amount", 0)) for d in exp_docs)

        # 2. Monthly Milk Earnings
        milk_docs = await db.milk_sales.find(date_filter).to_list(1000)
        total_earn = sum(float(d.get("earnings", 0)) for d in milk_docs)

        # 3. Monthly DLS
        dls_docs = await db.dls.find(date_filter).to_list(1000)
        total_dls = sum(float(d.get("amount", 0)) for d in dls_docs)

        # 4. Total Investment (Usually users want to see ALL-TIME investment, 
        # but we can filter it if needed. Let's keep it all-time for now)
        inv_docs = await db.investments.find({"deleted": {"$ne": True}}).to_list(1000)
        total_inv = sum(float(d.get("amount", 0)) for d in inv_docs)
        aadil_inv = sum(float(d.get("amount", 0)) for d in inv_docs if d.get("investor") == "Aadil")
        imran_inv = sum(float(d.get("amount", 0)) for d in inv_docs if d.get("investor") == "Imran")

        return {
            "total_investment": total_inv,
            "aadil_investment": aadil_inv,
            "imran_investment": imran_inv,
            "total_earnings": total_earn,
            "total_expenditure": total_exp,
            "total_dls": total_dls,
            "net_profit": total_earn - total_exp,
            "month": target_month,
            "year": target_year
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== CALENDAR EVENT ENDPOINTS ====================

@api_router.post("/events")
async def create_event(event: CalendarEvent):
    if len(event.description) > 15:
        event.description = event.description[:15]
    
    result = await db.events.insert_one(event.dict())
    
    notif_message = f"{event.created_by} created event: {event.description} on {event.date}"
    if event.reminder:
        notif_message += f" (Reminder: {event.reminder.replace('_', ' ')})"
    
    notif = Notification(
        type="event_created",
        data=event.dict(),
        message=notif_message
    )
    await db.notifications.insert_one(notif.dict())
    
    return {"success": True, "id": str(result.inserted_id)}

@api_router.get("/events")
async def get_events(deleted: bool = False):
    events = await db.events.find({"deleted": deleted}).sort("date", 1).to_list(1000)
    return [serialize_doc(event) for event in events]

@api_router.patch("/events/{event_id}")
async def update_event(event_id: str, event: CalendarEvent):
    """Update an existing event"""
    await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": event.dict(exclude_unset=True)}
    )
    return {"success": True}

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": {"deleted": True}}
    )
    return {"success": True}

# 🆕 FEEDBACK #16: Manual test endpoint for email reports
@api_router.post("/test-email-report")
async def test_email_report():
    """Manual trigger for testing email reports"""
    from email_reports import send_daily_report
    await send_daily_report()
    return {"message": "Email report sent (check console logs)"}

# Health check
@api_router.get("/")
async def root():
    return {"message": "Wazir Dairy Farming API"}

# Cleanup test data
@api_router.delete("/test/cleanup")
async def cleanup_test_data():
    """Remove all test data from database"""
    try:
        await db.investments.delete_many({})
        await db.expenditures.delete_many({})
        await db.milk_sales.delete_many({})
        await db.dairy_lock_sales.delete_many({})
        await db.bills.delete_many({})
        await db.notifications.delete_many({})
        
        return {
            "message": "All test data cleaned up successfully",
            "deleted": {
                "investments": "all",
                "expenditures": "all",
                "milk_sales": "all",
                "dairy_lock_sales": "all",
                "bills": "all",
                "notifications": "all"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FEEDBACK #6 & #16: Start scheduler on app startup
@app.on_event("startup")
async def startup_event():
    # Schedule daily reminder check at 9 AM
    scheduler.add_job(
        check_event_reminders,
        CronTrigger(hour=9, minute=0),
        id="event_reminder_check",
        replace_existing=True
    )
    
    # 🆕 FEEDBACK #16: Setup email reports (9 AM and 9 PM)
    setup_email_scheduler(scheduler)
    
    if not scheduler.running:
            scheduler.start()
            
        logging.info("🚀 Scheduler started successfully in Asia/Kolkata timezone")
        logging.info("📅 Jobs: Daily Reports (9AM/9PM IST), Reminders (9AM IST)")

@app.get("/api/health")
async def health_check():
    # Helpful for keeping the Render instance awake
    return {"status": "healthy", "timezone": "Asia/Kolkata", "time": datetime.now(IST).isoformat()}

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown()
    client.close()
    logging.info("Scheduler stopped and database connection closed")
