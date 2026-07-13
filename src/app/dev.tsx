// ═══ BLOCO: PAINEL DE DEV ═══
//
// Equivale aos switches do mockup aprovado. Existe para você exercitar o gate NO CELULAR
// sem depender de dado de produção. Só aparece em __DEV__ (ver Perfil).
//
// ⚠️  ESTE ARQUIVO MORRE NA FASE 1b. Quando o gate real (RLS + fn_cliente_pode) estiver
//     no caminho, simular acesso pela UI deixa de fazer sentido — e vira risco.

import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Aviso, Card, Screen, Titulo } from '@/components/ui';
import type { AppAcesso } from '@/lib/types';
import { useSession } from '@/state/session';
import { color, font, radius, size, space } from '@/theme/tokens';

const ACESSOS: AppAcesso[] = ['liberado', 'suspenso', 'bloqueado'];

export default function Dev() {
  const {
    acesso,
    setAcessoDev,
    adimplente,
    forcarInadimplencia,
    setForcarInadimplencia,
    modulos,
    toggleModuloDev,
  } = useSession();

  return (
    <Screen>
      <Aviso
        tom="info"
        icone="information-circle"
        texto="Simulação local. Nada aqui toca o banco — o gate real vive no Supabase (RLS)."
      />

      <Titulo>app_acesso</Titulo>
      <View style={s.linhaBotoes}>
        {ACESSOS.map((a) => (
          <Pressable key={a} onPress={() => setAcessoDev(a)} style={{ flex: 1 }}>
            <View style={[s.botao, acesso === a && s.botaoOn]}>
              <Text style={[s.botaoTxt, acesso === a && s.botaoTxtOn]}>{a}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Titulo>Pagamento</Titulo>
      <Card style={s.sw}>
        <View style={{ flex: 1 }}>
          <Text style={s.swTitulo}>Forçar inadimplência</Text>
          <Text style={s.swSub}>
            Estado atual: {adimplente ? 'adimplente' : 'inadimplente'}
          </Text>
        </View>
        <Switch
          value={forcarInadimplencia}
          onValueChange={setForcarInadimplencia}
          trackColor={{ true: color.green, false: color.border }}
        />
      </Card>

      <Titulo>Módulos (app_features.ativo)</Titulo>
      {modulos.map((m) => (
        <Card key={m.key} style={s.sw}>
          <View style={{ flex: 1 }}>
            <Text style={s.swTitulo}>{m.nome}</Text>
            <Text style={s.swSub}>
              {m.exige_pagamento ? 'exige pagamento' : 'livre (abre para inadimplente)'}
            </Text>
          </View>
          <Switch
            value={m.ativo}
            onValueChange={() => toggleModuloDev(m.key)}
            trackColor={{ true: color.green, false: color.border }}
          />
        </Card>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  linhaBotoes: { flexDirection: 'row', gap: space.sm },
  botao: {
    paddingVertical: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
  },
  botaoOn: { backgroundColor: color.navy, borderColor: color.navy },
  botaoTxt: { fontFamily: font.medium, fontSize: size.sm, color: color.ink2 },
  botaoTxtOn: { color: color.white },

  sw: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  swTitulo: { fontFamily: font.bold, fontSize: size.base, color: color.ink },
  swSub: { fontFamily: font.regular, fontSize: size.sm, color: color.ink2, marginTop: 2 },
});
// ── FIM BLOCO ──
