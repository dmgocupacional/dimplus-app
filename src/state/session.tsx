// ═══ BLOCO: SESSÃO ═══
//
// Sessão MOCKADA (FASE 1c). Não há login, não há auth.uid(), não há Supabase.
// A FASE 1b substitui o carregamento abaixo por: CPF → OTP → sessão Supabase → queries.
// O resto do app consome este contexto e não sabe de onde o dado veio — de propósito.
//
// O bloco de OVERRIDES DE DEV existe para exercitar o gate no celular (equivale aos
// switches do mockup aprovado). Ele é o primeiro candidato a sumir quando a 1b entrar.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getCliente, getFaturas, getModulos, getRede } from '@/lib/data';
import { isAdimplente, podeAcessar } from '@/lib/gate';
import type { MotivoBloqueio } from '@/lib/gate';
import type { AppAcesso, Cliente, Fatura, Modulo, ModuloKey, Parceiro } from '@/lib/types';

type Veredito = { pode: boolean; motivo: MotivoBloqueio };

type SessionValue = {
  carregando: boolean;
  cliente: Cliente | null;
  modulos: Modulo[];
  faturas: Fatura[];
  rede: Parceiro[];
  adimplente: boolean;
  acesso: AppAcesso;
  pode: (key: ModuloKey) => Veredito;
  modulo: (key: ModuloKey) => Modulo | undefined;
  // ─── dev only ───
  forcarInadimplencia: boolean;
  setForcarInadimplencia: (v: boolean) => void;
  setAcessoDev: (v: AppAcesso) => void;
  toggleModuloDev: (key: ModuloKey) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [rede, setRede] = useState<Parceiro[]>([]);

  // overrides de dev
  const [forcarInadimplencia, setForcarInadimplencia] = useState(false);
  const [acessoDev, setAcessoDev] = useState<AppAcesso | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [c, m, f, r] = await Promise.all([
        getCliente(),
        getModulos(),
        getFaturas(),
        getRede(),
      ]);
      if (!vivo) return;
      setCliente(c);
      setModulos(m);
      setFaturas(f);
      setRede(r);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const adimplente = useMemo(
    () => (forcarInadimplencia ? false : isAdimplente(faturas)),
    [faturas, forcarInadimplencia]
  );

  const acesso: AppAcesso = acessoDev ?? cliente?.app_acesso ?? 'bloqueado';

  const modulo = useCallback(
    (key: ModuloKey) => modulos.find((m) => m.key === key),
    [modulos]
  );

  const pode = useCallback(
    (key: ModuloKey): Veredito => {
      const m = modulos.find((x) => x.key === key);
      if (!m) return { pode: false, motivo: 'modulo_desativado' };
      return podeAcessar(acesso, m, adimplente);
    },
    [modulos, acesso, adimplente]
  );

  const toggleModuloDev = useCallback((key: ModuloKey) => {
    setModulos((prev) =>
      prev.map((m) => (m.key === key ? { ...m, ativo: !m.ativo } : m))
    );
  }, []);

  const value: SessionValue = {
    carregando,
    cliente,
    modulos,
    faturas,
    rede,
    adimplente,
    acesso,
    pode,
    modulo,
    forcarInadimplencia,
    setForcarInadimplencia,
    setAcessoDev: (v) => setAcessoDev(v),
    toggleModuloDev,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return ctx;
}
// ── FIM BLOCO ──
