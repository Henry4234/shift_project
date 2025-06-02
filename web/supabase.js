import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://iadhgslrubguevwtqsib.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhZGhnc2xydWJndWV2d3Rxc2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NzE5OTAsImV4cCI6MjA2NDM0Nzk5MH0.kyPhBczr4xo8CCC5cHeRcKbPquhHpU_3w2BQ9pSB7LE'
const supabase = createClient(supabaseUrl, supabaseKey)
export { supabase }