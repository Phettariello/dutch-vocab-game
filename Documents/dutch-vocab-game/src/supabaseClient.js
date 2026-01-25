// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bnfsbfiyswhgcmmqknhb.supabase.co'
const supabaseAnonKey = 'sb_publishable_f21tgPUDvhnNHWNkH6WJ0w_GRw_XGPF'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
