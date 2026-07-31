// ═══ BLOCO: CLIENTE SUPABASE ═══
//
// Única instância do cliente Supabase do app. Criar um segundo em qualquer lugar quebra a
// sessão: dois clientes com o mesmo storage brigam pelo refresh do token.
//
// A URL e a chave ANON não são segredo — elas vão embutidas em qualquer app publicado e o
// que protege o dado é o RLS da FASE 0, não o sigilo da chave. Por isso vivem no `app.json`
// (extra), que o EAS Update já distribui. Se um dia entrar chave que É segredo, ela NÃO vem
// por aqui.
//
// ⚠️ `detectSessionInUrl: false` é obrigatório em React Native: o default liga um handler de
// URL que só existe no browser.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseAnonKey?: string; apiBase?: string }
  | undefined;

const SUPABASE_URL = extra?.supabaseUrl ?? '';
const SUPABASE_ANON_KEY = extra?.supabaseAnonKey ?? '';

/** Base do ERP, onde moram as rotas públicas de cadastro e login. */
export const API_BASE = extra?.apiBase ?? 'https://erp-dimplus.vercel.app';

// ⚠️ NO WEB, AsyncStorage É localStorage — e o `expo export --platform web` roda o bundle no
// Node para pré-renderizar, onde `window` não existe. O Supabase lê a sessão do storage assim
// que é criado, então o build quebrava com "ReferenceError: window is not defined" antes de
// qualquer tela renderizar. Storage em memória no web resolve: o preview web é só para
// aprovar o visual, sessão persistida ali não vale nada. No aparelho, AsyncStorage normal.
const memoria = new Map<string, string>();
const storageWeb = {
  getItem: async (k: string) => memoria.get(k) ?? null,
  setItem: async (k: string, v: string) => void memoria.set(k, v),
  removeItem: async (k: string) => void memoria.delete(k),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? storageWeb : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
// ── FIM BLOCO ──
