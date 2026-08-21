// ═══ BLOCO: COMPONENTE — CALENDÁRIO DE MÊS ═══
//
// Grade 7 colunas do mês, para escolher UM dia entre os que têm vaga.
//
// Escrito à mão em vez de instalar biblioteca de calendário: o que precisamos é uma
// grade simples com dias habilitados/apagados, e uma lib traria estilo próprio brigando
// com os tokens da marca, além de dependência nova para pouca coisa.
//
// 🔴 DATAS SEM `new Date(string)`. Em JS, `new Date('2026-08-25')` é interpretado como
//    UTC e, em UTC-3, volta como 24/08 às 21h — o dia inteiro desliza. Toda comparação
//    aqui é feita com a string ISO `AAAA-MM-DD`, e o único `Date` construído usa o
//    construtor numérico (ano, mês, dia), que é horário LOCAL.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, font, radius, size, space } from '@/theme/tokens';

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Célula da grade: `null` é preenchimento antes do dia 1 / depois do último. */
type Celula = { dia: number; iso: string } | null;

function montarGrade(ano: number, mes: number): Celula[] {
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // local, não UTC
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulas: Celula[] = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push({ dia: d, iso: iso(ano, mes, d) });
  // Completa a última semana para a grade não ficar torta.
  while (celulas.length % 7 !== 0) celulas.push(null);
  return celulas;
}

export function CalendarioMes({
  diasComVaga,
  onEscolherDia,
}: {
  /** Dias que têm horário livre, em `AAAA-MM-DD`. Só estes ficam clicáveis. */
  diasComVaga: string[];
  onEscolherDia: (dataIso: string) => void;
}) {
  const disponiveis = useMemo(() => new Set(diasComVaga), [diasComVaga]);

  // Abre no mês do PRIMEIRO dia com vaga, não no mês corrente: se a próxima vaga é só
  // no mês que vem, abrir em um mês todo apagado faria o cliente achar que não há nada.
  const [ano, mes] = useMemo(() => {
    const primeiro = diasComVaga.slice().sort()[0];
    if (primeiro) {
      const [a, m] = primeiro.split('-').map(Number);
      return [a, m - 1] as const;
    }
    const hoje = new Date();
    return [hoje.getFullYear(), hoje.getMonth()] as const;
  }, [diasComVaga]);

  const [visivel, setVisivel] = useState({ ano, mes });
  const grade = useMemo(() => montarGrade(visivel.ano, visivel.mes), [visivel]);

  // Navegação limitada aos meses que realmente têm vaga — não deixa o cliente rolar
  // para dezembro e concluir que a agenda está vazia.
  const mesesComVaga = useMemo(() => {
    const s = new Set<string>();
    for (const d of diasComVaga) s.add(d.slice(0, 7));
    return s;
  }, [diasComVaga]);

  const chaveVisivel = `${visivel.ano}-${String(visivel.mes + 1).padStart(2, '0')}`;
  const chaves = useMemo(() => [...mesesComVaga].sort(), [mesesComVaga]);
  const posicao = chaves.indexOf(chaveVisivel);
  const temAnterior = posicao > 0;
  const temProximo = posicao >= 0 && posicao < chaves.length - 1;

  function irPara(delta: number) {
    const alvo = chaves[posicao + delta];
    if (!alvo) return;
    const [a, m] = alvo.split('-').map(Number);
    setVisivel({ ano: a, mes: m - 1 });
  }

  return (
    <View>
      <View style={s.cabecalho}>
        <Pressable onPress={() => irPara(-1)} disabled={!temAnterior} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={temAnterior ? color.navy : color.border} />
        </Pressable>
        <Text style={s.mesTitulo}>
          {MESES[visivel.mes]} de {visivel.ano}
        </Text>
        <Pressable onPress={() => irPara(1)} disabled={!temProximo} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={temProximo ? color.navy : color.border} />
        </Pressable>
      </View>

      <View style={s.semana}>
        {DIAS_SEMANA.map((d, i) => (
          <Text key={i} style={s.diaSemana}>
            {d}
          </Text>
        ))}
      </View>

      <View style={s.grade}>
        {grade.map((celula, i) => {
          if (!celula) return <View key={i} style={s.celula} />;
          const livre = disponiveis.has(celula.iso);
          return (
            <Pressable
              key={i}
              style={s.celula}
              disabled={!livre}
              onPress={() => onEscolherDia(celula.iso)}
            >
              {/* Dia sem vaga continua VISÍVEL, só apagado: sumir com ele faria o mês
                  parecer furado e esconderia que a data existe e está cheia. */}
              <View style={livre ? s.diaLivre : s.diaVazio}>
                <Text style={livre ? s.diaLivreTexto : s.diaVazioTexto}>{celula.dia}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    marginBottom: space.md,
  },
  mesTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink, textTransform: 'capitalize' },
  semana: { flexDirection: 'row', marginBottom: space.xs },
  diaSemana: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.medium,
    fontSize: size.xs,
    color: color.ink3,
  },
  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  celula: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  diaLivre: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: color.greenBg,
    borderWidth: 1,
    borderColor: color.greenDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaLivreTexto: { fontFamily: font.bold, fontSize: size.sm, color: color.navy },
  diaVazio: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  diaVazioTexto: { fontFamily: font.regular, fontSize: size.sm, color: color.border },
});
// ── FIM BLOCO ──
