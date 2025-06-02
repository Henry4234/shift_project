import { createClient } from '@supabase/supabase-js'

// 載入 .env 變數（只有 Node.js 有效，瀏覽器無效）
import dotenv from 'dotenv'
dotenv.config()


const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
export { supabase }