"""
Auto Email Reports Module - Sends daily dashboard stats via Resend
"""

import httpx
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
import pytz

# Resend Configuration
RESEND_API_KEY = "re_XLQhuZYC_NCb1czT5b5mwSZArxCEgzdBw"
RECIPIENT_EMAILS = ["aadilmansoori111@gmail.com"]
SENDER_EMAIL = "onboarding@resend.dev"

# Timezone Configuration
IST = pytz.timezone('Asia/Kolkata')

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wazir_dairy")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def fetch_dashboard_stats():
    """Fetch statistics mirroring exactly the Frontend Dashboard logic"""
    try:
        now_ist = datetime.now(IST)
        current_month = now_ist.month
        current_year = now_ist.year

        # Fetch ALL non-deleted records
        expenditures = await db.expenditures.find({"deleted": {"$ne": True}}).to_list(None)
        investments = await db.investments.find({"deleted": {"$ne": True}}).to_list(None)
        milk_sales = await db.milk_sales.find({"deleted": {"$ne": True}}).to_list(None)
        dls_records = await db.dls.find({"deleted": {"$ne": True}}).to_list(None)

        # 1. OVERALL DASHBOARD (ALL TIME)
        total_expenditure_all = sum(float(e.get("amount", 0)) for e in expenditures)
        total_investment_all = sum(float(i.get("amount", 0)) for i in investments)
        total_dls_all = sum(float(d.get("amount", 0)) for d in dls_records)
        net_dls_all = total_dls_all - total_expenditure_all

        # 2. MONTHLY PERFORMANCE (CURRENT MONTH)
        current_month_exp = 0
        current_month_earnings = 0

        for e in expenditures:
            date_str = e.get("date", "")
            if date_str:
                parts = date_str.split('-')
                if len(parts) >= 2 and int(parts[0]) == current_year and int(parts[1]) == current_month:
                    current_month_exp += float(e.get("amount", 0))

        for m in milk_sales:
            date_str = m.get("date", "")
            if date_str:
                parts = date_str.split('-')
                if len(parts) >= 2 and int(parts[0]) == current_year and int(parts[1]) == current_month:
                    current_month_earnings += float(m.get("earnings", 0))

        net_profit_month = current_month_earnings - current_month_exp

        return {
            "date": now_ist.strftime("%d %B %Y"),
            "month_name": now_ist.strftime("%B %Y"),
            "total_investment": total_investment_all,
            "net_dls_all": net_dls_all,
            "current_month_earnings": current_month_earnings,
            "current_month_exp": current_month_exp,
            "net_profit_month": net_profit_month
        }

    except Exception as e:
        print(f"Error fetching dashboard stats: {e}")
        return None

def generate_html_report(stats):
    """Generate HTML email template matching the App Dashboard"""
    if not stats:
        return "<p>Unable to fetch dashboard statistics.</p>"

    # Formatting colors for negative values
    net_dls_color = "#10B981" if stats['net_dls_all'] >= 0 else "#EF4444"
    net_profit_color = "#10B981" if stats['net_profit_month'] >= 0 else "#EF4444"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
            h1 {{ color: #1f2937; font-size: 22px; text-align: center; margin-bottom: 4px; }}
            .date {{ color: #6b7280; font-size: 14px; text-align: center; margin-bottom: 24px; }}
            .section-title {{ color: #374151; font-size: 16px; font-weight: bold; margin-top: 20px; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }}
            .row {{ display: flex; justify-content: space-between; margin-bottom: 12px; }}
            .card {{ background: #f3f4f6; border-radius: 8px; padding: 16px; flex: 1; margin: 0 4px; text-align: center; }}
            .label {{ color: #6b7280; font-size: 12px; margin-bottom: 4px; font-weight: 600; text-transform: uppercase; }}
            .value {{ color: #1f2937; font-size: 20px; font-weight: bold; }}
            .footer {{ text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🐄 Wazir Dairy Farm</h1>
            <p class="date">Daily Report - {stats['date']}</p>

            <div class="section-title">Overall Dashboard (All Time)</div>
            <div class="row">
                <div class="card">
                    <div class="label">Total Investment</div>
                    <div class="value">₹{stats['total_investment']:,.2f}</div>
                </div>
                <div class="card">
                    <div class="label">Total DLS (Net)</div>
                    <div class="value" style="color: {net_dls_color};">₹{stats['net_dls_all']:,.2f}</div>
                </div>
            </div>

            <div class="section-title">Monthly Performance ({stats['month_name']})</div>
            <div class="row">
                <div class="card">
                    <div class="label">Earnings</div>
                    <div class="value">₹{stats['current_month_earnings']:,.2f}</div>
                </div>
                <div class="card">
                    <div class="label">Expenditure</div>
                    <div class="value">₹{stats['current_month_exp']:,.2f}</div>
                </div>
                <div class="card">
                    <div class="label">Net Profit</div>
                    <div class="value" style="color: {net_profit_color};">₹{stats['net_profit_month']:,.2f}</div>
                </div>
            </div>

            <div class="footer">
                <p>This is an automated report generated by the Wazir Dairy Farm System.</p>
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

        stats = await fetch_dashboard_stats()
        if not stats:
            print("Failed to fetch stats. Skipping email.")
            return

        html_content = generate_html_report(stats)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={{
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json"
                }},
                json={{
                    "from": SENDER_EMAIL,
                    "to": RECIPIENT_EMAILS,
                    "subject": f"📊 Daily Report - {stats['date']}",
                    "html": html_content
                }},
                timeout=30.0
            )

            if response.status_code == 200:
                print(f"✅ Email sent successfully")
            else:
                print(f"❌ Email failed: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"❌ Error sending daily report: {e}")
