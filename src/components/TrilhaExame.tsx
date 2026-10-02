// ═══ BLOCO: COMPONENTE — TRILHA DO EXAME (APP) ═══
// Sprint 1 (02/10/2026). As 5 etapas do exame que o paciente enxerga (mesmas do ERP, calculadas
// lá): Coleta → No laboratório → Análise técnica → Liberação médica → Laudo pronto.
// Feitas acendem no verde da marca; a atual fica com anel. Sem animação (bateria/acessibilidade).
import { StyleSheet, Text, View } from 'react-native';
import type { EtapaTrilha } from '@/lib/examesLab';
import { color, font, size, space } from '@/theme/tokens';

function curta(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function TrilhaExame({ etapas }: { etapas: EtapaTrilha[] }) {
  const atual = etapas.findIndex((e) => !e.feita);
  return (
    <View style={s.linha} accessibilityRole="progressbar"
      accessibilityLabel={`Andamento: ${atual === -1 ? 'laudo pronto' : etapas[atual]?.rotulo ?? ''}`}>
      {etapas.map((e, i) => (
        <View key={e.chave} style={s.etapa}>
          {i > 0 ? <View style={[s.traco, (e.feita || i === atual) && s.tracoAceso]} /> : null}
          <View style={[s.ponto, e.feita && s.pontoFeito, i === atual && s.pontoAtual]} />
          <Text style={[s.rotulo, (e.feita || i === atual) && s.rotuloAceso]} numberOfLines={2}>{e.rotulo}</Text>
          <Text style={s.data}>{e.feita ? curta(e.em) : i === atual ? 'agora' : ''}</Text>
        </View>
      ))}
    </View>
  );
}

const PONTO = 14;
const s = StyleSheet.create({
  linha: { flexDirection: 'row', marginTop: space.sm },
  etapa: { flex: 1, alignItems: 'center' },
  traco: { position: 'absolute', top: PONTO / 2 - 1.5, right: '50%', width: '100%', height: 3, backgroundColor: color.border },
  tracoAceso: { backgroundColor: color.green },
  ponto: { width: PONTO, height: PONTO, borderRadius: PONTO / 2, backgroundColor: color.border, borderWidth: 2, borderColor: color.border },
  pontoFeito: { backgroundColor: color.green, borderColor: color.green },
  pontoAtual: { backgroundColor: color.white, borderColor: color.green, borderWidth: 3 },
  rotulo: { fontFamily: font.medium, fontSize: 10, color: color.ink3, textAlign: 'center', marginTop: 4, lineHeight: 12 },
  rotuloAceso: { color: color.ink },
  data: { fontFamily: font.regular, fontSize: 10, color: color.ink2, marginTop: 1, minHeight: 12 },
});
// ── FIM BLOCO ──
