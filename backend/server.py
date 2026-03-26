from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Helper to convert ObjectId to string
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

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
    deleted: bool = False
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class Expenditure(BaseModel):
    amount: float
    date: str
    paid_by: str
    category: str
    subcategory: str
    deleted: bool = False
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class MilkSale(BaseModel):
    date: str
    volume: float  # liters
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

class Notification(BaseModel):
    type: str  # 'investment', 'expenditure', 'milk_sale', 'dls', 'deletion'
    data: Dict[str, Any]
    message: str
    read_by: List[str] = []
    reactions: Dict[str, str] = {}  # {user: emoji}
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
    # Check if users already exist
    existing = await db.users.count_documents({})
    if existing > 0:
        return {"message": "Users already set up"}
    
    # Create default users
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
    return {"success": True}

# ==================== INVESTMENT ENDPOINTS ====================

@api_router.post("/investments")
async def create_investment(investment: Investment):
    result = await db.investments.insert_one(investment.dict())
    # Create notification
    notif = Notification(
        type="investment",
        data=investment.dict(),
        message=f"{investment.investor} added Investment - {investment.category} - ₹{investment.amount:,.0f} on {investment.date}"
    )
    await db.notifications.insert_one(notif.dict())
    return {"success": True, "id": str(result.inserted_id)}

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
    
    # Create deletion notification
    notif = Notification(
        type="deletion",
        data={"type": "investment", "id": investment_id},
        message=f"{user} removed Investment entry - {inv['category']} - ₹{inv['amount']:,.0f} on {inv['date']}"
    )
    await db.notifications.insert_one(notif.dict())
    return {"success": True}

# ==================== EXPENDITURE ENDPOINTS ====================

@api_router.post("/expenditures")
async def create_expenditure(expenditure: Expenditure):
    result = await db.expenditures.insert_one(expenditure.dict())
    # Create notification
    notif = Notification(
        type="expenditure",
        data=expenditure.dict(),
        message=f"{expenditure.paid_by} added Expenditure - {expenditure.category}/{expenditure.subcategory} - ₹{expenditure.amount:,.0f} on {expenditure.date}"
    )
    await db.notifications.insert_one(notif.dict())
    return {"success": True, "id": str(result.inserted_id)}

@api_router.get("/expenditures")
async def get_expenditures(deleted: bool = False):
    expenditures = await db.expenditures.find({"deleted": deleted}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(exp) for exp in expenditures]

@api_router.delete("/expenditures/{expenditure_id}")
async def delete_expenditure(expenditure_id: str, user: str):
    exp = await db.expenditures.find_one({"_id": ObjectId(expenditure_id)})
    if not exp:
        raise HTTPException(status_code=404, detail="Expenditure not found")
    
    await db.expenditures.update_one(
        {"_id": ObjectId(expenditure_id)},
        {"$set": {"deleted": True}}
    )
    
    # Create deletion notification
    notif = Notification(
        type="deletion",
        data={"type": "expenditure", "id": expenditure_id},
        message=f"{user} removed Expenditure entry - {exp['category']}/{exp['subcategory']} - ₹{exp['amount']:,.0f} on {exp['date']}"
    )
    await db.notifications.insert_one(notif.dict())
    return {"success": True}

# ==================== MILK SALES ENDPOINTS ====================

@api_router.post("/milk-sales")
async def create_milk_sale(sale: MilkSale):
    result = await db.milk_sales.insert_one(sale.dict())
    # Create notification
    notif = Notification(
        type="milk_sale",
        data=sale.dict(),
        message=f"Milk Sale added for {sale.date} - {sale.volume}L at {sale.fat_percentage}% fat, Rate: ₹{sale.rate} = ₹{sale.earnings:,.0f}"
    )
    await db.notifications.insert_one(notif.dict())
    return {"success": True, "id": str(result.inserted_id)}

@api_router.get("/milk-sales")
async def get_milk_sales(deleted: bool = False):
    sales = await db.milk_sales.find({"deleted": deleted}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(sale) for sale in sales]

@api_router.delete("/milk-sales/{sale_id}")
async def delete_milk_sale(sale_id: str, user: str):
    sale = await db.milk_sales.find_one({"_id": ObjectId(sale_id)})
    if not sale:
        raise HTTPException(status_code=404, detail="Milk sale not found")
    
    await db.milk_sales.update_one(
        {"_id": ObjectId(sale_id)},
        {"$set": {"deleted": True}}
    )
    
    # Create deletion notification
    notif = Notification(
        type="deletion",
        data={"type": "milk_sale", "id": sale_id},
        message=f"{user} removed Milk Sale entry for {sale['date']}"
    )
    await db.notifications.insert_one(notif.dict())
    return {"success": True}

# ==================== DAIRY LOCK SALES ENDPOINTS ====================

@api_router.post("/dairy-lock-sales")
async def create_dls(dls: DairyLockSale):
    result = await db.dairy_lock_sales.insert_one(dls.dict())
    # Create notification
    notif = Notification(
        type="dls",
        data=dls.dict(),
        message=f"Dairy Lock Sale added for {dls.month}/{dls.year} - ₹{dls.amount:,.0f} on {dls.date}"
    )
    await db.notifications.insert_one(notif.dict())
    return {"success": True, "id": str(result.inserted_id)}

@api_router.get("/dairy-lock-sales")
async def get_dls(deleted: bool = False):
    sales = await db.dairy_lock_sales.find({"deleted": deleted}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(sale) for sale in sales]

@api_router.delete("/dairy-lock-sales/{dls_id}")
async def delete_dls(dls_id: str, user: str):
    dls = await db.dairy_lock_sales.find_one({"_id": ObjectId(dls_id)})
    if not dls:
        raise HTTPException(status_code=404, detail="DLS not found")
    
    await db.dairy_lock_sales.update_one(
        {"_id": ObjectId(dls_id)},
        {"$set": {"deleted": True}}
    )
    
    # Create deletion notification
    notif = Notification(
        type="deletion",
        data={"type": "dls", "id": dls_id},
        message=f"{user} removed Dairy Lock Sale entry for {dls['month']}/{dls['year']}"
    )
    await db.notifications.insert_one(notif.dict())
    return {"success": True}

# ==================== NOTIFICATION ENDPOINTS ====================

@api_router.get("/notifications")
async def get_notifications(limit: int = 100):
    # Get notifications from last 90 days
    from datetime import timedelta
    ninety_days_ago = datetime.utcnow() - timedelta(days=90)
    
    notifications = await db.notifications.find(
        {"created_at": {"$gte": ninety_days_ago}}
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
async def get_dashboard_stats():
    # Get all non-deleted data
    investments = await db.investments.find({"deleted": False}).to_list(1000)
    expenditures = await db.expenditures.find({"deleted": False}).to_list(1000)
    milk_sales = await db.milk_sales.find({"deleted": False}).to_list(1000)
    dls = await db.dairy_lock_sales.find({"deleted": False}).to_list(1000)
    
    # Calculate totals
    total_investment = sum(inv["amount"] for inv in investments)
    aadil_investment = sum(inv["amount"] for inv in investments if inv["investor"] == "Aadil")
    imran_investment = sum(inv["amount"] for inv in investments if inv["investor"] == "Imran")
    
    total_expenditure = sum(exp["amount"] for exp in expenditures)
    total_earnings = sum(sale["earnings"] for sale in milk_sales)
    total_dls = sum(d["amount"] for d in dls)
    
    return {
        "total_investment": total_investment,
        "aadil_investment": aadil_investment,
        "imran_investment": imran_investment,
        "total_earnings": total_earnings,
        "total_expenditure": total_expenditure,
        "net_profit": total_earnings - total_expenditure,
        "total_dls": total_dls
    }

# Health check
@api_router.get("/")
async def root():
    return {"message": "Wazir Dairy Farming API"}

# Cleanup test data
@api_router.delete("/test/cleanup")
async def cleanup_test_data():
    """Remove all test data from database"""
    try:
        # Delete all entries
        await db.investments.delete_many({})
        await db.expenditures.delete_many({})
        await db.milk_sales.delete_many({})
        await db.dairy_lock_sales.delete_many({})
        await db.notifications.delete_many({})
        
        return {
            "message": "All test data cleaned up successfully",
            "deleted": {
                "investments": "all",
                "expenditures": "all",
                "milk_sales": "all",
                "dairy_lock_sales": "all",
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
