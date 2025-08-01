from supabase import create_client
import os
from dotenv import load_dotenv

# 載入環境變數
load_dotenv('.env')

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)


def fetch_shift_requirements():
    response = (supabase
        .from_('shift_requirements_legacy')
        .select('employees(name), shift_type, required_days')
        # .eq('cycle_id',cycle_id)
        .execute()
        )
    print(response)

fetch_shift_requirements()