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

import { getCartaoClube, type CartaoClube } from '@/lib/clube';
import { getCliente, getElegibilidade, getFaturas, getModulos, getRede } from '@/lib/data';
import type { Elegibilidade } from '@/lib/data';
import { buscarTermoPendente } from '@/lib/contrato';
import { isAdimplente, podeAcessar } from '@/lib/gate';
import type { MotivoBloqueio } from '@/lib/gate';
import { sair as authSair } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { AppAcesso, Cliente, Fatura, Modulo, ModuloKey, UnidadeRede } from '@/lib/types';

type Veredito = { pode: boolean; motivo: MotivoBloqueio };
export type EstadoSessao = 'carregando' | 'deslogado' | 'aguardando' | 'pronto';

type SessionValue = {
  estado: EstadoSessao;
  /** Compatibilidade com as telas da 1c: elas checam `carregando` antes de renderizar. */
  carregando: boolean;
  cliente: Cliente | null;
  modulos: Modulo[];
  faturas: Fatura[];
  rede: UnidadeRede[];
  /** Só as faturas: alimenta o Financeiro ("total em aberto"). */
  adimplente: boolean;
  /** Régua única (fn_elegibilidade): decide cadeado, selo do cartão e aviso da home. */
  elegivel: boolean;
  /** Cartão de descontos em farmácias; null = ainda não aderiu (ou falha de leitura). */
  clube: CartaoClube | null;
  acesso: AppAcesso;
  /** true = há termo publicado esperando aceite. null = ainda não se sabe (não bloqueia). */
  aceitePendente: boolean | null;
  recarregarAceite: () => void;
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
  const [rede, setRede] = useState<UnidadeRede[]>([]);
  const [elegibilidade, setElegibilidade] = useState<Elegibilidade | null>(null);
  const [clube, setClube] = useState<CartaoClube | null>(null);

  const limpar = useCallback(() => {
    setCliente(null);
    setModulos([]);
    setFaturas([]);
    setRede([]);
    setElegibilidade(null);
    setClube(null);
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
    const [m, f, r, e, cl] = await Promise.all([
      getModulos(),
      getFaturas(),
      getRede(),
      getElegibilidade(),
      getCartaoClube(),
    ]);
    setCliente(c);
    setModulos(m);
    setFaturas(f);
    setRede(r);
    setElegibilidade(e);
    setClube(cl);
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
  // Sem resposta do servidor, vale o cálculo antigo pelas faturas — a tela nunca trava por
  // falha de rede, e quem barra de fato é a fn_cliente_pode no servidor.
  const elegivel = elegibilidade ? elegibilidade.elegivel : adimplente;
  const acesso: AppAcesso = cliente?.app_acesso ?? 'bloqueado';

  // ═══ ACEITE PENDENTE ═══
  // 26/08/2026. Pré-cadastrado (SUEESSOR, Sagrado, Dimeg) aceita o termo DEPOIS do login,
  // porque o plano dele já estava definido antes de ele existir no app.
  //
  // 🔴 ESTE ESTADO É A PEÇA QUE FALTAVA. A tela `aceite-termo` foi construída em 26/08 e não
  // era alcançável por rota nenhuma: existia e nunca aparecia. É este flag que o Roteador usa.
  //
  // ⚠️ `null` (desconhecido) NÃO bloqueia. Falha de rede viraria app travado numa tela de
  // aceite que não carrega — e o beneficiário ficaria sem acesso ao próprio exame por causa
  // de um 500. Bloquear só quando o servidor CONFIRMOU que há termo pendente.
  const [aceitePendente, setAceitePendente] = useState<boolean | null>(null);

  useEffect(() => {
    // Só pergunta quando existe cliente: sem vínculo o RLS não devolveria contrato nenhum e a
    // chamada seria ruído. `estado` na dependência refaz a checagem após o login.
    if (estado !== 'pronto') return;
    let vivo = true;
    void (async () => {
      const r = await buscarTermoPendente();
      if (!vivo) return;
      // r === null é falha de rede → deixa null → não bloqueia. Ver o comentário acima.
      setAceitePendente(r === null ? null : r.pendente);
    })();
    return () => { vivo = false; };
  }, [estado, cliente?.id]);

  const modulo = useCallback((key: ModuloKey) => modulos.find((m) => m.key === key), [modulos]);

  const pode = useCallback(
    (key: ModuloKey): Veredito => {
      const m = modulos.find((x) => x.key === key);
      if (!m) return { pode: false, motivo: 'modulo_desativado' };
      return podeAcessar(acesso, m, elegivel);
    },
    [modulos, acesso, elegivel]
  );

  const sair = useCallback(async () => {
    await authSair();
    limpar();
    setEstado('deslogado');
  }, [limpar]);

  const value: SessionValue = {
    estado,
    aceitePendente,
    recarregarAceite: () => setAceitePendente(false),
    carregando: estado === 'carregando',
    cliente,
    modulos,
    faturas,
    rede,
    adimplente,
    elegivel,
    clube,
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
