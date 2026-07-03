import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

//klice jsou v .env souboru, pri praci na jinem zarizeni po naklonovani repo pridat znovu do stejne slozky jako je supabase.js a App.js soubour .env