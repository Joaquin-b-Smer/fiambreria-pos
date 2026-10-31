import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qzlchxjmthjvsmnbjjvs.supabase.co' 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bGNoeGptdGhqdnNtbmJqanZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NzAzMTIsImV4cCI6MjEwOTA0NjMxMn0.G49a24bkCF3nMjq3sP_Osfs6YHDKbLKncyDgPzNsY9w'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)