// ═══ BLOCO: SESSÃO ═══
//
// Sessão REAL (SPRINT B). Antes isto carregava mock no boot; agora depende de `auth.uid()`.
//
// A máquina de estados tem QUATRO valores e cada um pinta uma tela diferente. Colapsar dois
// deles é o erro clássico aqui:
//
//   'carregando'  → ainda restaurando a sessão do AsyncStorage. Nada a decidir.
//   'deslogado'   → sem sessão → telas de login/cadastro.
//   'aguardando'  → TEM sessão, e `getCliente()` devolveu null.
//   'pronto'      → tem sessão e tem cliente.
//
// ⚠️ 'aguardando' NÃO É ERRO. A conta nasce inerte de propósito: loga, mas `clientes.user_id`
// segue NULL e `app_acesso` segue 'bloqueado', então o RLS da FASE 0 não devolve linha alguma.
// Tratar isso como falha (retry infinito, "erro ao carregar", logout automático) deixaria o
// beneficiário sem saber que só falta a aprovação do staff. É estado normal do produto.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getCliente, getFaturas, getModulos, getRede } from '@/lib/data';
import { isAdimplente, podeAcessar } from '@/lib/gate';
import type { MotivoBloqueio } from '@/lib/gate';
import { sair as authSair } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { AppAcesso, Cliente, Fatura, Modulo, ModuloKey, Parceiro } from '@/lib/types';

type Veredito = { pode: boolean; motivo: MotivoBloqueio };
export type EstadoSessao = 'carregando' | 'deslogado' | 'aguardando' | 'pronto';

type SessionValue = {
  estado: EstadoSessao;
  /** Compatibilidade com as telas da 1c: elas checam `carregando` antes de renderizar. */
  carregando: boolean;
  cliente: Cliente | null;
  modulos: Modulo[];
  faturas: Fatura[];
  rede: Parceiro[];
  adimplente: boolean;
  acesso: AppAcesso;
  pode: (key: ModuloKey) => Veredito;
  modulo: (key: ModuloKey) => Modulo | undefined;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>('carregando');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [rede, setRede] = useState<Parceiro[]>([]);

  const limpar = useCallback(() => {
    setCliente(null);
    setModulos([]);
    setFaturas([]);
    setRede([]);
  }, []);

  // Carrega tudo que a sessão atual consegue ver. Só é chamado COM sessão.
  const carregar = useCallback(async () => {
    const c = await getCliente();
    if (!c) {
      // Sessão válida, cliente invisível = conta ainda não aprovada. Não limpar a sessão:
      // deslogar aqui faria a pessoa achar que a senha está errada.
      limpar();
      setEstado('aguardando');
      return;
    }
    const [m, f, r] = await Promise.all([getModulos(), getFaturas(), getRede()]);
    setCliente(c);
    setModulos(m);
    setFaturas(f);
    setRede(r);
    setEstado('pronto');
  }, [limpar]);

  useEffect(() => {
    let vivo = true;

    // `onAuthStateChange` dispara também na restauração inicial (INITIAL_SESSION) e a cada
    // refresh de token — por isso não há um getSession() separado no boot: seria uma segunda
    // fonte de verdade correndo em paralelo com esta.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (!vivo) return;
      if (!sessao) {
        limpar();
        setEstado('deslogado');
        return;
      }
      setEstado((atual) => (atual === 'pronto' ? atual : 'carregando'));
      void carregar();
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [carregar, limpar]);

  const adimplente = useMemo(() => isAdimplente(faturas), [faturas]);
  const acesso: AppAcesso = cliente?.app_acesso ?? 'bloqueado';

  const modulo = useCallback((key: ModuloKey) => modulos.find((m) => m.key === key), [modulos]);

  const pode = useCallback(
    (key: ModuloKey): Veredito => {
      const m = modulos.find((x) => x.key === key);
      if (!m) return { pode: false, motivo: 'modulo_desativado' };
      return podeAcessar(acesso, m, adimplente);
    },
    [modulos, acesso, adimplente]
  );

  const sair = useCallback(async () => {
    await authSair();
    limpar();
    setEstado('deslogado');
  }, [limpar]);

  const value: SessionValue = {
    estado,
    carregando: estado === 'carregando',
    cliente,
    modulos,
    faturas,
    rede,
    adimplente,
    acesso,
    pode,
    modulo,
    recarregar: carregar,
    sair,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return ctx;
}
// ── FIM BLOCO ──
