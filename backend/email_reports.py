"""
Auto Email Reports Module - Sends daily dashboard stats via Resend
"""

import httpx
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import pytz

# Resend Configuration
RESEND_API_KEY = "re_XLQhuZYC_NCb1czT5b5mwSZArxCEgzdBw"
RECIPIENT_EMAILS = ["aadi208888@gmail.com", "aadilmansoori111@gmail.com", "mansuri.imran777@gmail.com","yakub.mansoori@gmail.com"]
SENDER_EMAIL = "onboarding@resend.dev"

# Timezone Configuration
IST = pytz.timezone('Asia/Kolkata')

# MongoDB connection (Matches server.py logic)
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wazir_dairy")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def fetch_dashboard_stats():
    """Fetch aggregated dashboard statistics using IST timezone logic"""
    try:
        # Get today's date range in IST
        now_ist = datetime.now(IST)
        today_start = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_start = today_start + timedelta(days=1)

        # ISO strings for MongoDB filtering
        start_str = today_start.isoformat()
        end_str = tomorrow_start.isoformat()

        # Fetch collections
        expenditures = await db.expenditures.find({
            "date": {"$gte": start_str, "$lt": end_str},
            "deleted": {"$ne": True}
        }).to_list(1000)

        investments = await db.investments.find({
            "date": {"$gte": start_str, "$lt": end_str},
            "deleted": {"$ne": True}
        }).to_list(1000)

        # Note: Milk sales uses 'earnings' field for the amount
        milk_sales = await db.milk_sales.find({
            "date": {"$gte": start_str, "$lt": end_str},
            "deleted": {"$ne": True}
        }).to_list(1000)

        dls_records = await db.dls.find({
            "date": {"$gte": start_str, "$lt": end_str},
            "deleted": {"$ne": True}
        }).to_list(1000)

        # Calculate totals
        total_expenditure = sum(float(e.get("amount", 0)) for e in expenditures)
        total_investment = sum(float(i.get("amount", 0)) for i in investments)
        total_milk_sales = sum(float(m.get("earnings", 0)) for m in milk_sales)
        total_dls = sum(float(d.get("amount", 0)) for d in dls_records)

        # Net DLS calculation
        net_dls = total_dls - total_expenditure

        return {
            "date": today_start.strftime("%d %B %Y"),
            "total_dls": total_dls,
            "total_expenditure": total_expenditure,
            "total_investment": total_investment,
            "total_milk_sales": total_milk_sales,
            "net_dls": net_dls,
            "expenditure_count": len(expenditures),
            "investment_count": len(investments),
            "milk_sales_count": len(milk_sales),
            "dls_count": len(dls_records)
        }

    except Exception as e:
        print(f"Error fetching dashboard stats: {e}")
        return None

def generate_html_report(stats):
    """Generate HTML email template with dashboard stats"""
    if not stats:
        return "<p>Unable to fetch dashboard statistics.</p>"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
            h1 {{ color: #1f2937; font-size: 24px; margin-bottom: 8px; }}
            .date {{ color: #6b7280; font-size: 14px; margin-bottom: 24px; }}
            .stat-card {{ background: #f3f4f6; border-radius: 6px; padding: 16px; margin-bottom: 12px; }}
            .stat-label {{ color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }}
            .stat-value {{ color: #1f2937; font-size: 28px; font-weight: bold; margin-top: 4px; }}
            .stat-count {{ color: #9ca3af; font-size: 12px; margin-top: 4px; }}
            .net-dls {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }}
            .footer {{ text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🐄 Wazir Dairy Farm - Daily Report</h1>
            <p class="date">{stats['date']}</p>

            <div class="stat-card net-dls">
                <div class="stat-label">Net DLS (DLS - Expenditure)</div>
                <div class="stat-value" style="color: white;">₹{stats['net_dls']:,.2f}</div>
            </div>

            <div class="stat-card">
                <div class="stat-label">💰 Total DLS</div>
                <div class="stat-value">₹{stats['total_dls']:,.2f}</div>
                <div class="stat-count">{stats['dls_count']} entries</div>
            </div>

            <div class="stat-card">
                <div class="stat-label">🥛 Milk Sales</div>
                <div class="stat-value">₹{stats['total_milk_sales']:,.2f}</div>
                <div class="stat-count">{stats['milk_sales_count']} sales</div>
            </div>

            <div class="stat-card">
                <div class="stat-label">📤 Expenditure</div>
                <div class="stat-value">₹{stats['total_expenditure']:,.2f}</div>
                <div class="stat-count">{stats['expenditure_count']} expenses</div>
            </div>

            <div class="stat-card">
                <div class="stat-label">📈 Investment</div>
                <div class="stat-value">₹{stats['total_investment']:,.2f}</div>
                <div class="stat-count">{stats['investment_count']} investments</div>
            </div>

            <div class="footer">
                <p>Generated automatically by Wazir Dairy Farm App</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html

async def send_daily_report():
    """Main function to send daily email report via Resend"""
    try:
        now_ist = datetime.now(IST)
        print(f"[{now_ist}] Starting daily email report process...")

        # Fetch stats
        stats = await fetch_dashboard_stats()
        if not stats:
            print("Failed to fetch stats. Skipping email.")
            return

        # Generate HTML
        html_content = generate_html_report(stats)

        # Send email via Resend
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": SENDER_EMAIL,
                    "to": RECIPIENT_EMAILS,
                    "subject": f"📊 Daily Report - {stats['date']}",
                    "html": html_content
                },
                timeout=30.0
            )

            if response.status_code == 200:
                print(f"✅ Email sent successfully to {len(RECIPIENT_EMAILS)} recipients")
            else:
                print(f"❌ Email failed: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"❌ Error sending daily report: {e}")
