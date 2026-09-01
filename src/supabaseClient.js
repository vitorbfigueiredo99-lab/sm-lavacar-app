import { createClient } from "@supabase/supabase-js";

// Chaves públicas do projeto Supabase (protegidas por RLS no banco — seguras
// para ficarem visíveis no navegador). Se houver variáveis de ambiente
// configuradas na hospedagem, elas têm prioridade sobre este fallback.
const FALLBACK_URL = "https://zxkdhdecodqvgogqucms.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable_OPTAkZAToYNu9cvG2cVpBg_6eQjev1U";

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

export const supabaseEnabled = Boolean(url && anonKey);

export const supabase = supabaseEnabled ? createClient(url, anonKey) : null;
