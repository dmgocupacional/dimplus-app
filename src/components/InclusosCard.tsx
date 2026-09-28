// ═══ BLOCO: CARD — SEUS INCLUSOS (HOME) ═══
// 28/09/2026 · Sprint B. Saldo das consultas inclusas do plano e a PRÓXIMA consulta reservada em
// amarelo, com o resumo (especialidade, unidade, hora) e o prazo para cancelar ou remarcar sem
// perder. Some quando o plano não tem nada contado (ex.: planos só com descontos).
// → BLOCO: BENEFÍCIOS INCLUSOS (src/lib/beneficios.ts)
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { beneficiosContados, formatarQuando, passouDoPrazo, type MeusBeneficios } from '@/lib/beneficios';
import { color, font, radius, size, space } from '@/theme/tokens';

export function InclusosCard({ dados }: { dados: MeusBeneficios | null }) {
  const contados = beneficiosContados(dados);
  if (contados.length === 0) return null;
  const proxima = (dados?.movimentos ?? [])
    .filter((m) => m.estado === 'reservada')
    .sort((a, b) => (a.quando < b.quando ? -1 : 1))[0];
  const ilimitados = (dados?.beneficios ?? []).filter((b) => b.modo === 'incluso' && b.quantidade == null);

  return (
    <Pressable onPress={() => router.push('/meus-agendamentos' as never)} style={s.card}>
      <View style={s.topo}>
        <Text style={s.titulo}>Seus inclusos</Text>
        <Ionicons name="chevron-forward" size={16} color={color.ink3} />
      </View>

      {contados.map((b) => {
        const total = b.quantidade ?? 0;
        const restam = b.restantes ?? 0;
        return (
          <View key={b.categoria_id} style={s.linha}>
            <View style={s.linhaTexto}>
              <Text style={s.nome}>{b.nome}</Text>
              <Text style={s.sub}>
                {b.usadas ? `${b.usadas} usada${b.usadas > 1 ? 's' : ''}` : 'nenhuma usada'}
                {b.reservadas ? ` · ${b.reservadas} agendada${b.reservadas > 1 ? 's' : ''}` : ''}
                {b.perdidas ? ` · ${b.perdidas} perdida${b.perdidas > 1 ? 's' : ''}` : ''}
              </Text>
            </View>
            <View style={s.contador}>
              <Text style={[s.numero, restam === 0 && s.numeroZero]}>{restam}</Text>
              <Text style={s.de}>de {total}</Text>
            </View>
          </View>
        );
      })}

      {ilimitados.length > 0 ? (
        <Text style={s.ilimitado}>
          {ilimitados.map((b) => b.nome).join(' e ')}: sem limite
        </Text>
      ) : null}

      {proxima ? (
        <View style={[s.reserva, passouDoPrazo(proxima.prazo_sem_perda) && s.reservaTarde]}>
          <Text style={s.reservaTitulo}>
            {proxima.especialidade ?? 'Consulta'} · {formatarQuando(proxima.quando)}
          </Text>
          {proxima.unidade ? (
            <Text style={s.reservaSub}>
              {proxima.unidade.nome}{proxima.unidade.endereco ? ` · ${proxima.unidade.endereco}` : ''}
            </Text>
          ) : null}
          <Text style={s.reservaPrazo}>
            {passouDoPrazo(proxima.prazo_sem_perda)
              ? 'Menos de 24h: se faltar ou cancelar agora, a consulta é descontada.'
              : proxima.prazo_sem_perda
                ? `Cancele ou remarque até ${formatarQuando(proxima.prazo_sem_perda)} sem perder. Se faltar, perde a consulta.`
                : 'Se faltar, perde a consulta.'}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: color.white,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: color.border,
    gap: space.md,
    marginTop: space.lg,
  },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontFamily: font.black, fontSize: size.base, color: color.navy },
  linha: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  linhaTexto: { flex: 1 },
  nome: { fontFamily: font.bold, fontSize: size.sm, color: color.ink },
  sub: { fontFamily: font.regular, fontSize: size.xs, color: color.ink2, marginTop: 2 },
  contador: { alignItems: 'flex-end' },
  numero: { fontFamily: font.black, fontSize: size.xl, color: color.greenDeep },
  numeroZero: { color: color.ink3 },
  de: { fontFamily: font.regular, fontSize: size.xs, color: color.ink3 },
  ilimitado: { fontFamily: font.regular, fontSize: size.xs, color: color.ink2 },
  reserva: {
    backgroundColor: color.warningBg,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: color.warning,
    padding: space.md,
    gap: 2,
  },
  reservaTarde: { borderLeftColor: color.danger },
  reservaTitulo: { fontFamily: font.bold, fontSize: size.sm, color: color.ink },
  reservaSub: { fontFamily: font.regular, fontSize: size.xs, color: color.ink2 },
  reservaPrazo: { fontFamily: font.bold, fontSize: size.xs, color: color.navy, marginTop: 4 },
});
// ── FIM BLOCO ──
