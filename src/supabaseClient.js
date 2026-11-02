import { createClient } from '@supabase/supabase-js'

// Ambil URL dan Anon Key dari Project Settings -> API di dashboard Supabase-mu
const SUPABASE_URL = 'https://bwmbsryhkywwgxzbfhjk.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_IGCVNFTCaTz6NwvPw2WonA_1K6HcBn6'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)