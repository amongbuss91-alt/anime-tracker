import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://bxpsvexmiughrptjbv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VLROoQ6Jy8Zu4sGDdFQZpw_-3gIJGSc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
