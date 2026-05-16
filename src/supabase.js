import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vuwipshpbhuvdvldjzay.supabase.co'
const supabaseKey = 'sb_publishable_sqMmlE4gL4U1Xg8PYkjVQw_AenCRvl5'

export const supabase = createClient(supabaseUrl, supabaseKey)
