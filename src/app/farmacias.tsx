// ═══ BLOCO: TELA — FARMÁCIAS CONVENIADAS (NATIVA) ═══
// 28/09/2026. A rede Vidalink do convênio DIMEG no padrão do DIM+: abre onde a pessoa está (GPS;
// sem permissão, na cidade do cadastro), mais perto primeiro,
// busca por rede/rua/bairro, filtro por rede, e cada farmácia com "Como chegar" e "Ligar".
// Dados: erp (/api/app/farmacias), que lê o localizador público da Vidalink — não há API.
// Se o erp não conseguir ler, a tela oferece o localizador da Vidalink (/farmacias-vidalink).
// → BLOCO: FARMÁCIAS VIDALINK (DADOS) (src/lib/farmacias.ts)
// → BLOCO: CLUBE DE DESCONTOS (src/lib/clube.ts) para rota e ligação.
// 28/09/2026 — aba MAPA: pins das farmácias e o ponto azul da pessoa dentro do app.
// → BLOCO: MAPA — FARMÁCIAS CONVENIADAS (src/components/MapaFarmacias.tsx)
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MapaFarmacias, temMapa, type PinFarmacia } from '@/components/MapaFarmacias';
import { abrirRota, ligarPara } from '@/lib/clube';
import {
  UFS,
  buscarCidades,
  buscarFarmacias,
  distanciaM,
  formatarDistancia,
  normalizar,
  pegarLocalizacao,
  type Farmacia,
  type ListaFarmacias,
  type Posicao,
} from '@/lib/farmacias';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronto'; lista: ListaFarmacias }
  | { fase: 'sem_cidade' }
  | { fase: 'erro'; mensagem: string };

const TODAS = 'Todas';
const MAX_CHIPS_REDE = 6;
// O erp geocodifica aos poucos (1 endereço/s): enquanto faltar coordenada, a tela pergunta de
// novo, em silêncio, algumas vezes.
const REPETIR_GEO_MS = 15_000;
const MAX_REPETICOES_GEO = 6;

type Item = Farmacia & { distancia: number | null };

// ═══ BLOCO: REGRAS DA LISTA ═══
/** Redes com mais unidades primeiro — são as que a pessoa procura. */
function redesPrincipais(farmacias: Farmacia[]): string[] {
  const contagem = new Map<string, number>();
  for (const f of farmacias) contagem.set(f.rede, (contagem.get(f.rede) ?? 0) + 1);
  return [...contagem.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CHIPS_REDE)
    .map(([rede]) => rede);
}

/** Com posição: mais perto primeiro; quem não tem coordenada vai para o fim. */
function ordenar(farmacias: Farmacia[], pos: Posicao | null): Item[] {
  const itens = farmacias.map((f): Item => ({
    ...f,
    distancia: pos && f.lat != null && f.lon != null ? distanciaM(pos, f.lat, f.lon) : null,
  }));
  if (!pos) return itens;
  return itens.sort((a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity));
}

function filtrar(farmacias: Item[], busca: string, rede: string, so24h: boolean): Item[] {
  const termo = normalizar(busca);
  return farmacias.filter((f) => {
    if (rede !== TODAS && f.rede !== rede) return false;
    if (so24h && !f.aberta24h) return false;
    if (!termo) return true;
    return normalizar(`${f.rede} ${f.endereco} ${f.bairro}`).includes(termo);
  });
}

function enderecoCompleto(f: Farmacia): string {
  return `${f.endereco}, ${f.bairro}, ${f.cidade} - ${f.uf}, ${f.cep}`;
}
// ── FIM BLOCO ──

export default function Farmacias() {
  const { clube } = useSession();
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [local, setLocal] = useState<{ uf: string; cidade: string } | undefined>(undefined);
  const [busca, setBusca] = useState('');
  const [rede, setRede] = useState(TODAS);
  const [so24h, setSo24h] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [pos, setPos] = useState<Posicao | null>(null);
  const [modo, setModo] = useState<'lista' | 'mapa'>('lista');
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [pertoDeVoce, setPertoDeVoce] = useState(false);
  const repeticoes = useRef(0);

  const carregar = useCallback(async (alvo?: { uf: string; cidade: string }, silencioso = false) => {
    if (!silencioso) setEstado({ fase: 'carregando' });
    const r = await buscarFarmacias(alvo);
    if (silencioso && !r.ok) return; // nova tentativa de coordenadas: erro não derruba a lista
    if (r.ok) {
      setEstado({ fase: 'pronto', lista: r.dados });
      setLocal({ uf: r.dados.uf, cidade: r.dados.cidade });
    } else if (r.precisaCidade) {
      setEstado({ fase: 'sem_cidade' });
      setEscolhendo(true);
    } else {
      setEstado({ fase: 'erro', mensagem: r.mensagem });
    }
  }, []);

  // Abre onde a pessoa ESTÁ. Sem permissão ou sem GPS: cidade do cadastro, como antes.
  useEffect(() => {
    void (async () => {
      const l = await pegarLocalizacao();
      if (l.tipo === 'ok') {
        setPos(l.pos);
        if (l.uf && l.cidade) {
          setPertoDeVoce(true);
          await carregar({ uf: l.uf, cidade: l.cidade });
          return;
        }
      } else if (l.tipo === 'negada') {
        setSemPermissao(true);
      }
      await carregar();
    })();
  }, [carregar]);

  // Coordenadas ainda chegando no erp: pergunta de novo, sem esqueleto e sem mexer nos filtros.
  const pendentes = estado.fase === 'pronto' ? estado.lista.geocode_pendente : 0;
  useEffect(() => {
    if (!pos || pendentes === 0 || repeticoes.current >= MAX_REPETICOES_GEO || !local) return;
    const t = setTimeout(() => {
      repeticoes.current += 1;
      void carregar(local, true);
    }, REPETIR_GEO_MS);
    return () => clearTimeout(t);
  }, [pos, pendentes, local, carregar]);

  const lista = estado.fase === 'pronto' ? estado.lista : null;
  const chipsRede = useMemo(() => (lista ? redesPrincipais(lista.farmacias) : []), [lista]);
  const tem24h = !!lista?.farmacias.some((f) => f.aberta24h);
  const ordenadas = useMemo(() => (lista ? ordenar(lista.farmacias, pos) : []), [lista, pos]);
  const visiveis = useMemo(() => filtrar(ordenadas, busca, rede, so24h), [ordenadas, busca, rede, so24h]);
  // Pins: só quem já tem coordenada; o índice é a posição em `visiveis` (o card usa o mesmo).
  const pins = useMemo<PinFarmacia[]>(
    () => visiveis.flatMap((f, i) => (f.lat != null && f.lon != null
      ? [{ i, lat: f.lat, lon: f.lon, nome: f.rede, aproximado: f.precisao === 'bairro' }] : [])),
    [visiveis],
  );
  const semPin = visiveis.length - pins.length;
  const calculandoDistancia = !!pos && pendentes > 0;

  function escolherCidade(uf: string, cidade: string) {
    setEscolhendo(false);
    setPertoDeVoce(false);
    repeticoes.current = 0;
    setBusca('');
    setRede(TODAS);
    setSo24h(false);
    void carregar({ uf, cidade });
  }

  const cabecalho = (
    <View>
      {clube?.cartao_vidalink ? <FaixaCartao numero={clube.cartao_vidalink} /> : null}

      <View style={s.localLinha}>
        <Ionicons name="location" size={18} color={color.greenDeep} />
        <View style={s.localTexto}>
          {pertoDeVoce ? <Text style={s.localRotulo}>PERTO DE VOCÊ</Text> : null}
          <Text style={s.localTxt} numberOfLines={1}>
            {local ? `${local.cidade} · ${local.uf}` : 'Escolha a cidade'}
          </Text>
        </View>
        <Pressable onPress={() => setEscolhendo(true)} style={s.trocar} hitSlop={8}>
          <Text style={s.trocarTxt}>Trocar cidade</Text>
        </Pressable>
      </View>

      {semPermissao ? (
        <Pressable onPress={() => void Linking.openSettings()} style={s.avisoLocal}>
          <Ionicons name="navigate-circle-outline" size={20} color={color.navy} />
          <Text style={s.avisoLocalTxt}>Ative a localização para ver as farmácias mais perto de você.</Text>
          <Ionicons name="chevron-forward" size={16} color={color.ink3} />
        </Pressable>
      ) : null}

      {lista ? (
        <>
          <View style={s.busca}>
            <Ionicons name="search" size={18} color={color.ink3} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por rede, rua ou bairro"
              placeholderTextColor={color.ink3}
              style={s.buscaInput}
              returnKeyType="search"
              autoCorrect={false}
            />
            {busca ? (
              <Pressable onPress={() => setBusca('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={color.ink3} />
              </Pressable>
            ) : null}
          </View>

          {chipsRede.length > 0 || tem24h ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              {tem24h ? <Chip rotulo="Aberta 24h" ativo={so24h} onPress={() => setSo24h((v) => !v)} /> : null}
              {[TODAS, ...chipsRede].map((r) => (
                <Chip key={r} rotulo={r} ativo={rede === r} onPress={() => setRede(r)} />
              ))}
            </ScrollView>
          ) : null}

          {temMapa && lista.farmacias.length > 0 ? (
            <View style={s.modos}>
              {(['lista', 'mapa'] as const).map((m) => (
                <Pressable key={m} onPress={() => { setModo(m); setSelecionada(null); }} style={[s.modo, modo === m && s.modoAtivo]}>
                  <Ionicons name={m === 'lista' ? 'list' : 'map'} size={16} color={modo === m ? color.white : color.navy} />
                  <Text style={[s.modoTxt, modo === m && s.modoTxtAtivo]}>{m === 'lista' ? 'Lista' : 'Mapa'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={s.contagem}>
            {visiveis.length === 1 ? '1 farmácia conveniada' : `${visiveis.length} farmácias conveniadas`}
            {pos && !calculandoDistancia && lista.farmacias.length > 0 ? ' · mais perto primeiro' : ''}
            {calculandoDistancia ? ' · calculando distâncias…' : ''}
            {lista.desatualizado ? ' · lista pode estar desatualizada' : ''}
          </Text>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={s.tela}>
      {estado.fase === 'carregando' ? (
        <ScrollView contentContainerStyle={s.conteudo}>
          {cabecalho}
          <Esqueleto />
        </ScrollView>
      ) : estado.fase === 'erro' ? (
        <ScrollView contentContainerStyle={s.conteudo}>
          {cabecalho}
          <Vazio
            icone="cloud-offline-outline"
            titulo="Não conseguimos carregar as farmácias agora"
            texto="Tente de novo em instantes ou consulte direto no localizador da Vidalink."
            acao={{ rotulo: 'Tentar de novo', onPress: () => void carregar(local) }}
            planoB
          />
        </ScrollView>
      ) : estado.fase === 'sem_cidade' ? (
        <ScrollView contentContainerStyle={s.conteudo}>
          {cabecalho}
          <Vazio
            icone="location-outline"
            titulo="Em qual cidade você quer procurar?"
            texto="Escolha a cidade para ver as farmácias conveniadas."
            acao={{ rotulo: 'Escolher cidade', onPress: () => setEscolhendo(true) }}
          />
        </ScrollView>
      ) : modo === 'mapa' ? (
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          {cabecalho}
          <MapaFarmacias pins={pins} eu={pos} selecionado={selecionada} onSelecionar={setSelecionada} />
          {semPin > 0 ? (
            <Text style={s.mapaNota}>
              {semPin === 1 ? '1 farmácia ainda sem localização no mapa' : `${semPin} farmácias ainda sem localização no mapa`} — estão na Lista.
            </Text>
          ) : null}
          {selecionada != null && visiveis[selecionada] ? (
            <CartaoFarmacia f={visiveis[selecionada]!} />
          ) : (
            <Text style={s.mapaNota}>Toque num pin para ver a farmácia.</Text>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={visiveis}
          keyExtractor={(f, i) => `${f.rede}-${f.endereco}-${i}`}
          renderItem={({ item }) => <CartaoFarmacia f={item} />}
          ListHeaderComponent={cabecalho}
          contentContainerStyle={s.conteudo}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            estado.lista.farmacias.length === 0 ? (
              <Vazio
                icone="medkit-outline"
                titulo={`Ainda não há farmácia conveniada em ${estado.lista.cidade}`}
                texto="Tente uma cidade vizinha."
                acao={{ rotulo: 'Trocar cidade', onPress: () => setEscolhendo(true) }}
              />
            ) : (
              <Vazio
                icone="search-outline"
                titulo="Nenhuma farmácia com esse filtro"
                texto="Limpe a busca ou escolha outra rede."
                acao={{
                  rotulo: 'Limpar filtros',
                  onPress: () => {
                    setBusca('');
                    setRede(TODAS);
                    setSo24h(false);
                  },
                }}
              />
            )
          }
          ListFooterComponent={
            estado.lista.farmacias.length > 0 ? (
              <Pressable onPress={() => router.push('/farmacias-vidalink' as never)} style={s.rodape}>
                <Text style={s.rodapeTxt}>Dados da rede Vidalink · ver no site da Vidalink</Text>
              </Pressable>
            ) : null
          }
        />
      )}

      <SeletorCidade
        visivel={escolhendo}
        ufInicial={local?.uf ?? 'SP'}
        onFechar={() => setEscolhendo(false)}
        onEscolher={escolherCidade}
      />
    </View>
  );
}

// ═══ BLOCO: COMPONENTES DA TELA ═══
function FaixaCartao({ numero }: { numero: string }) {
  const d = numero.replace(/\D/g, '');
  const formatado = d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : numero;
  return (
    <Pressable onPress={() => router.push('/clube' as never)} style={s.cartao}>
      <View style={s.cartaoIcone}>
        <Ionicons name="card" size={20} color={color.navy} />
      </View>
      <View style={s.cartaoTexto}>
        <Text style={s.cartaoRotulo}>SEU CARTÃO FARMÁCIA</Text>
        <Text style={s.cartaoNumero}>{formatado}</Text>
        <Text style={s.cartaoDica}>Informe o CPF no balcão da farmácia</Text>
      </View>
      <View style={s.cartaoBotao}>
        <Text style={s.cartaoBotaoTxt}>Ver cartão</Text>
      </View>
    </Pressable>
  );
}

function Chip({ rotulo, ativo, onPress }: { rotulo: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, ativo ? s.chipAtivo : null]}>
      <Text style={[s.chipTxt, ativo ? s.chipTxtAtivo : null]}>{rotulo}</Text>
    </Pressable>
  );
}

function CartaoFarmacia({ f }: { f: Item }) {
  const tel = f.telefone?.replace(/\D/g, '') ?? '';
  return (
    <View style={s.farmacia}>
      <View style={s.farmaciaTopo}>
        <View style={s.farmaciaIcone}>
          <Ionicons name="medkit" size={18} color={color.greenDeep} />
        </View>
        <View style={s.farmaciaTexto}>
          <Text style={s.farmaciaRede} numberOfLines={2}>
            {f.rede}
          </Text>
          <Text style={s.farmaciaEndereco}>{f.endereco}</Text>
          <Text style={s.farmaciaBairro}>
            {f.bairro} · {f.cep}
          </Text>
          {f.referencia ? <Text style={s.farmaciaBairro}>{f.referencia}</Text> : null}
        </View>
        <View style={s.lado}>
          {f.distancia != null ? (
            <Text style={s.distancia}>{formatarDistancia(f.distancia, f.precisao === 'bairro')}</Text>
          ) : null}
          {f.aberta24h ? (
            <View style={s.selo}>
              <Text style={s.seloTxt}>24h</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={s.acoes}>
        <Pressable onPress={() => abrirRota(enderecoCompleto(f))} style={[s.acao, s.acaoPrimaria]}>
          <Ionicons name="navigate" size={16} color={color.navy} />
          <Text style={s.acaoPrimariaTxt}>Como chegar</Text>
        </Pressable>
        {tel.length >= 10 ? (
          <Pressable onPress={() => ligarPara(tel)} style={[s.acao, s.acaoSecundaria]}>
            <Ionicons name="call" size={16} color={color.navy} />
            <Text style={s.acaoSecundariaTxt}>Ligar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Esqueleto() {
  return (
    <View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[s.farmacia, s.esqueleto]}>
          <View style={s.esqLinhaGrande} />
          <View style={s.esqLinha} />
          <View style={s.esqLinhaCurta} />
        </View>
      ))}
    </View>
  );
}

function Vazio({
  icone,
  titulo,
  texto,
  acao,
  planoB,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  texto: string;
  acao: { rotulo: string; onPress: () => void };
  planoB?: boolean;
}) {
  return (
    <View style={s.vazio}>
      <View style={s.vazioIcone}>
        <Ionicons name={icone} size={28} color={color.navy} />
      </View>
      <Text style={s.vazioTitulo}>{titulo}</Text>
      <Text style={s.vazioTexto}>{texto}</Text>
      <Pressable onPress={acao.onPress} style={s.vazioBotao}>
        <Text style={s.vazioBotaoTxt}>{acao.rotulo}</Text>
      </Pressable>
      {planoB ? (
        <Pressable onPress={() => router.push('/farmacias-vidalink' as never)} hitSlop={8}>
          <Text style={s.vazioLink}>Abrir o localizador da Vidalink</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SeletorCidade({
  visivel,
  ufInicial,
  onFechar,
  onEscolher,
}: {
  visivel: boolean;
  ufInicial: string;
  onFechar: () => void;
  onEscolher: (uf: string, cidade: string) => void;
}) {
  const [uf, setUf] = useState(ufInicial);
  const [cidades, setCidades] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    if (visivel) setUf(ufInicial);
  }, [visivel, ufInicial]);

  useEffect(() => {
    if (!visivel) return;
    let vivo = true;
    setCidades(null);
    setErro(null);
    setFiltro('');
    void buscarCidades(uf).then((r) => {
      if (!vivo) return;
      if (r.ok) setCidades(r.cidades);
      else setErro(r.mensagem);
    });
    return () => {
      vivo = false;
    };
  }, [visivel, uf]);

  const lista = useMemo(() => {
    const t = normalizar(filtro);
    return (cidades ?? []).filter((c) => !t || normalizar(c).includes(t));
  }, [cidades, filtro]);

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <View style={s.modal}>
        <View style={s.modalTopo}>
          <Text style={s.modalTitulo}>Escolha a cidade</Text>
          <Pressable onPress={onFechar} hitSlop={10}>
            <Ionicons name="close" size={24} color={color.navy} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.ufs}>
          {UFS.map((u) => (
            <Chip key={u} rotulo={u} ativo={uf === u} onPress={() => setUf(u)} />
          ))}
        </ScrollView>

        <View style={[s.busca, s.modalBusca]}>
          <Ionicons name="search" size={18} color={color.ink3} />
          <TextInput
            value={filtro}
            onChangeText={setFiltro}
            placeholder="Digite o nome da cidade"
            placeholderTextColor={color.ink3}
            style={s.buscaInput}
            autoCorrect={false}
          />
        </View>

        {erro ? (
          <Text style={s.modalAviso}>{erro}</Text>
        ) : cidades === null ? (
          <ActivityIndicator color={color.navy} style={s.modalCarregando} />
        ) : (
          <FlatList
            data={lista}
            keyExtractor={(c) => c}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable onPress={() => onEscolher(uf, item)} style={s.cidade}>
                <Text style={s.cidadeTxt}>{item}</Text>
                <Ionicons name="chevron-forward" size={16} color={color.ink3} />
              </Pressable>
            )}
            ListEmptyComponent={<Text style={s.modalAviso}>Nenhuma cidade com farmácia conveniada.</Text>}
          />
        )}
      </View>
    </Modal>
  );
}
// ── FIM BLOCO ──

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: color.offwhite },
  conteudo: { padding: space.lg, paddingBottom: space.xxl },

  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.navy,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    marginBottom: space.lg,
  },
  cartaoIcone: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartaoTexto: { flex: 1 },
  cartaoRotulo: { fontFamily: font.bold, fontSize: size.xs, color: color.green, letterSpacing: 0.6 },
  cartaoNumero: { fontFamily: font.black, fontSize: size.lg, color: color.white, marginTop: 2 },
  cartaoDica: { fontFamily: font.regular, fontSize: size.xs, color: color.sky, marginTop: 2 },
  cartaoBotao: {
    borderWidth: 1,
    borderColor: color.green,
    borderRadius: radius.pill,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.md,
  },
  cartaoBotaoTxt: { fontFamily: font.bold, fontSize: size.xs, color: color.green },

  localLinha: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: space.md },
  localTexto: { flex: 1 },
  localRotulo: { fontFamily: font.bold, fontSize: size.xs, color: color.greenDeep, letterSpacing: 0.6 },
  localTxt: { fontFamily: font.black, fontSize: size.lg, color: color.navy },
  avisoLocal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.md,
    marginBottom: space.md,
  },
  avisoLocalTxt: { flex: 1, fontFamily: font.medium, fontSize: size.sm, color: color.ink },
  trocar: { backgroundColor: color.greenBg, borderRadius: radius.pill, paddingVertical: space.xs, paddingHorizontal: space.md },
  trocarTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.greenDeep },

  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    height: 46,
  },
  buscaInput: { flex: 1, fontFamily: font.regular, fontSize: size.base, color: color.ink },

  chips: { gap: space.sm, paddingVertical: space.md },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.white,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.md,
  },
  chipAtivo: { backgroundColor: color.navy, borderColor: color.navy },
  chipTxt: { fontFamily: font.medium, fontSize: size.sm, color: color.ink2 },
  chipTxtAtivo: { color: color.white },

  contagem: { fontFamily: font.medium, fontSize: size.sm, color: color.ink2, marginBottom: space.md },
  modos: { flexDirection: 'row', backgroundColor: color.white, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, padding: 3, marginBottom: space.md, alignSelf: 'flex-start' },
  modo: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.xs + 2, paddingHorizontal: space.lg, borderRadius: radius.pill },
  modoAtivo: { backgroundColor: color.navy },
  modoTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.navy },
  modoTxtAtivo: { color: color.white },
  mapaNota: { fontFamily: font.regular, fontSize: size.xs, color: color.ink2, textAlign: 'center', marginBottom: space.md },

  farmacia: {
    backgroundColor: color.white,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  farmaciaTopo: { flexDirection: 'row', gap: space.md },
  farmaciaIcone: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: color.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmaciaTexto: { flex: 1 },
  farmaciaRede: { fontFamily: font.black, fontSize: size.base, color: color.navy },
  farmaciaEndereco: { fontFamily: font.regular, fontSize: size.sm, color: color.ink, marginTop: 2 },
  farmaciaBairro: { fontFamily: font.regular, fontSize: size.xs, color: color.ink2, marginTop: 2 },
  lado: { alignItems: 'flex-end', gap: space.xs },
  distancia: { fontFamily: font.black, fontSize: size.sm, color: color.greenDeep },
  selo: {
    backgroundColor: color.navy,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: space.sm,
  },
  seloTxt: { fontFamily: font.black, fontSize: size.xs, color: color.green },

  acoes: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  acao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
    paddingVertical: space.sm + 2,
  },
  acaoPrimaria: { backgroundColor: color.green },
  acaoPrimariaTxt: { fontFamily: font.black, fontSize: size.sm, color: color.navy },
  acaoSecundaria: { borderWidth: 1, borderColor: color.navy },
  acaoSecundariaTxt: { fontFamily: font.bold, fontSize: size.sm, color: color.navy },

  esqueleto: { gap: space.sm },
  esqLinhaGrande: { height: 16, width: '55%', borderRadius: radius.sm, backgroundColor: color.border },
  esqLinha: { height: 12, width: '85%', borderRadius: radius.sm, backgroundColor: color.offwhite },
  esqLinhaCurta: { height: 12, width: '40%', borderRadius: radius.sm, backgroundColor: color.offwhite },

  vazio: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.lg },
  vazioIcone: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: color.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  vazioTitulo: { fontFamily: font.black, fontSize: size.lg, color: color.navy, textAlign: 'center' },
  vazioTexto: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, textAlign: 'center', marginTop: space.sm },
  vazioBotao: {
    marginTop: space.lg,
    backgroundColor: color.green,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
  },
  vazioBotaoTxt: { fontFamily: font.black, fontSize: size.base, color: color.navy },
  vazioLink: { fontFamily: font.bold, fontSize: size.sm, color: color.navy600, marginTop: space.lg, textDecorationLine: 'underline' },

  rodape: { paddingVertical: space.lg, alignItems: 'center' },
  rodapeTxt: { fontFamily: font.regular, fontSize: size.xs, color: color.ink3 },

  modal: { flex: 1, backgroundColor: color.offwhite, paddingTop: space.lg },
  modalTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  modalTitulo: { fontFamily: font.black, fontSize: size.xl, color: color.navy },
  ufs: { flexGrow: 0, paddingHorizontal: space.lg },
  modalBusca: { marginHorizontal: space.lg, marginBottom: space.sm },
  modalCarregando: { marginTop: space.xxl },
  modalAviso: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, textAlign: 'center', marginTop: space.xl },
  cidade: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    backgroundColor: color.white,
  },
  cidadeTxt: { fontFamily: font.medium, fontSize: size.base, color: color.ink },
});
// ── FIM BLOCO ──
