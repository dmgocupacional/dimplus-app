// ═══ BLOCO: CARTÃO DO CLUBE DE DESCONTOS ═══
// 16/09/2026. Segundo cartão do carrossel da home: descontos em farmácias conveniadas.
// Sem lógica de negócio — recebe número e estado já decididos. → BLOCO: SESSÃO
//
// ⚠️ Visual deliberadamente diferente do cartão DIM+ (verde da marca em vez de navy): num
// carrossel, dois cartões iguais viram um só aos olhos de quem desliza rápido.
import { StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/ui';
import { color, font, radius, size, space } from '@/theme/tokens';

/** 1200000000000001 → 1200 0000 0000 0001 */
function agruparCartao(n: string): string {
  return n.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
}

export function CartaoClube({
  nome,
  numero,
  ativo,
}: {
  nome: string;
  numero: string | null;
  ativo: boolean;
}) {
  return (
    <View style={s.cartao}>
      <View style={s.blob} />

      <View style={s.topo}>
        <View>
          <Text style={s.rotulo}>CLUBE DE DESCONTOS</Text>
          <Text style={s.titulo}>Farmácias</Text>
        </View>
        <Pill texto={ativo ? 'ativo' : 'inativo'} tom={ativo ? 'ok' : 'erro'} />
      </View>

      <View style={s.meio}>
        <Text style={s.rotulo}>TITULAR</Text>
        <Text style={s.nome}>{nome}</Text>
      </View>

      <View style={s.base}>
        <View>
          <Text style={s.rotulo}>Nº DO CARTÃO</Text>
          <Text style={s.numero}>{numero ? agruparCartao(numero) : '—'}</Text>
        </View>
      </View>

      <View style={s.rodape}>
        <Text style={s.rodapeTxt}>Apresente na farmácia conveniada</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cartao: {
    backgroundColor: color.greenDeep,
    borderRadius: radius.lg,
    padding: space.xl,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: color.navy900,
    opacity: 0.25,
    right: -60,
    bottom: -70,
  },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rotulo: {
    fontFamily: font.bold,
    fontSize: 8,
    letterSpacing: 1.1,
    color: color.white,
    opacity: 0.8,
  },
  titulo: { fontFamily: font.black, fontSize: size.lg, color: color.white, marginTop: 2 },
  meio: { marginTop: space.xl },
  nome: { fontFamily: font.bold, fontSize: size.base, color: color.white, marginTop: 2 },
  base: { marginTop: space.lg, marginBottom: space.lg },
  numero: { fontFamily: font.bold, fontSize: size.lg, color: color.white, marginTop: 2 },
  rodape: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
    paddingVertical: space.md,
  },
  rodapeTxt: { fontFamily: font.regular, fontSize: size.xs, color: color.white, opacity: 0.85 },
});
// ── FIM BLOCO ──
