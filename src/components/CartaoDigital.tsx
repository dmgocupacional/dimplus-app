// ═══ BLOCO: CARTÃO DIGITAL ═══
// A peça de marca do app. Navy de fundo, logo branco, selo de estado no canto.
// Sem lógica: recebe o estado já decidido pelo gate. → BLOCO: SESSÃO

import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/ui';
import { formatMesAno, maskCPF } from '@/lib/format';
import type { AppAcesso, Cliente } from '@/lib/types';
import { color, font, radius, size, space } from '@/theme/tokens';

const LOGO_BRANCO = require('../../assets/brand/logo-white.png');

function rotuloEstado(acesso: AppAcesso, adimplente: boolean): {
  texto: string;
  tom: 'ok' | 'aviso' | 'erro';
} {
  if (acesso === 'bloqueado') return { texto: 'sem acesso', tom: 'erro' };
  if (acesso === 'suspenso') return { texto: 'suspenso', tom: 'aviso' };
  if (!adimplente) return { texto: 'em atraso', tom: 'erro' };
  return { texto: 'ativo', tom: 'ok' };
}

export function CartaoDigital({
  cliente,
  acesso,
  adimplente,
}: {
  cliente: Cliente;
  acesso: AppAcesso;
  adimplente: boolean;
}) {
  const estado = rotuloEstado(acesso, adimplente);

  return (
    <View style={s.cartao}>
      {/* elemento gráfico da marca: traços entrelaçados, em opacidade baixa */}
      <View style={s.blob1} />
      <View style={s.blob2} />

      <View style={s.topo}>
        <View>
          <Text style={s.rotulo}>PLANO</Text>
          <Text style={s.plano}>{cliente.plano ?? 'DIM+ SAÚDE'}</Text>
        </View>
        <Image source={LOGO_BRANCO} style={s.logo} contentFit="contain" />
      </View>

      <View style={s.meio}>
        <Text style={s.rotulo}>TITULAR</Text>
        <Text style={s.nome} numberOfLines={1}>
          {cliente.nome}
        </Text>
        <Text style={s.cpf}>{maskCPF(cliente.cpf)}</Text>
      </View>

      <View style={s.base}>
        <View>
          <Text style={s.rotulo}>MEMBRO DESDE</Text>
          <Text style={s.dado}>{formatMesAno(cliente.membro_desde)}</Text>
        </View>
        {/* Não existe "validade" no banco. O que existe é o PRÓXIMO VENCIMENTO da assinatura
            (`subscription_next_due`). Quando é NULL — dependente não tem assinatura própria —
            o campo SOME em vez de mostrar traço: um cartão com validade em branco parece
            cartão vencido.

            🔴 18/08/2026 — ESTE CAMPO PODE MOSTRAR A ASSINATURA ERRADA, e a causa está no
            outro repo. `clientes.asaas_subscription_id` é SINGULAR, mas o Asaas permite N
            assinaturas por customer: medidos 5 clientes com DUAS, uma invisível ao ERP.
            Para eles o campo reflete a que o ERP enxerga, não necessariamente a que sustenta
            a cobrança — Marluce daria 2026-07-01 e LEONARDO 2025-11-13, ambos no passado.
            ✅ Impacto hoje é ZERO: os 5 estão `app_acesso='bloqueado'` e sem `user_id`.
            NÃO tratar aqui — a cura é no erp-dimplus (parar de ler pelo campo singular).
            Mascarar na tela esconderia o dado errado em vez de corrigi-lo.
            Ver `erp-dimplus/docs/ROADMAP-APP.md` §9 e a sessão
            `erp-dimplus/docs/sessions/2026-08-18-dedup-conversao-drift-asaas-e-unique-cpf.md`. */}
        {cliente.proximo_vencimento ? (
          <View>
            <Text style={s.rotulo}>PRÓX. VENCIMENTO</Text>
            <Text style={s.dado}>{formatMesAno(cliente.proximo_vencimento)}</Text>
          </View>
        ) : null}
        <Pill texto={estado.texto} tom={estado.tom} />
      </View>

      <View style={s.rodape}>
        <Text style={s.rodapeTxt}>Cartão benefício by DIMEG</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cartao: {
    backgroundColor: color.navy,
    borderRadius: radius.lg,
    padding: space.xl,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: color.navy600,
    opacity: 0.35,
    right: -70,
    top: -80,
  },
  blob2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: color.navy900,
    opacity: 0.5,
    left: -60,
    bottom: -40,
  },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 74, height: 54 },
  rotulo: {
    fontFamily: font.bold,
    fontSize: 8,
    letterSpacing: 1.1,
    color: color.sky,
    opacity: 0.85,
  },
  plano: { fontFamily: font.black, fontSize: size.lg, color: color.white, marginTop: 2 },
  meio: { marginTop: space.xl },
  nome: { fontFamily: font.bold, fontSize: size.xl, color: color.white, marginTop: 2 },
  cpf: { fontFamily: font.regular, fontSize: size.sm, color: color.sky, marginTop: 2 },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.lg,
  },
  dado: { fontFamily: font.bold, fontSize: size.sm, color: color.white, marginTop: 2 },
  rodape: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(172,209,255,0.22)',
    paddingVertical: space.md,
    alignItems: 'center',
  },
  rodapeTxt: {
    fontFamily: font.medium,
    fontSize: size.xs,
    color: color.sky,
    letterSpacing: 0.4,
  },
});
// ── FIM BLOCO ──
