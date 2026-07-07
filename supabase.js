import { createClient, GoTrueAdminApi } from "@supabase/supabase-js";
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

//klice jsou v .env souboru, pri praci na jinem zarizeni po naklonovani repo pridat znovu do stejne slozky jako je supabase.js a App.js soubour .env