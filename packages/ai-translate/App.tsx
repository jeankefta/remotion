// ============================================================
//  AI TRANSLATE — App React Native complète
//  Fonctionne sur iPhone & Android
//  Micro natif + TTS natif → sort dans les AirPods Bluetooth
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Animated, StatusBar, Alert,
  SafeAreaView, Platform,
} from 'react-native';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';

// ── Ta clé API Anthropic ──────────────────────────────────
const ANTHROPIC_KEY = 'sk-ant-METS-TA-CLE-ICI';
// ─────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'fr-FR', tts: 'fr-FR', label: 'Français',  flag: '🇫🇷' },
  { code: 'en-US', tts: 'en-US', label: 'English',   flag: '🇺🇸' },
  { code: 'es-ES', tts: 'es-ES', label: 'Español',   flag: '🇪🇸' },
  { code: 'ar-SA', tts: 'ar-SA', label: 'العربية',   flag: '🇸🇦' },
  { code: 'zh-CN', tts: 'zh-CN', label: '中文',      flag: '🇨🇳' },
  { code: 'de-DE', tts: 'de-DE', label: 'Deutsch',   flag: '🇩🇪' },
  { code: 'it-IT', tts: 'it-IT', label: 'Italiano',  flag: '🇮🇹' },
  { code: 'pt-BR', tts: 'pt-BR', label: 'Português', flag: '🇧🇷' },
  { code: 'ru-RU', tts: 'ru-RU', label: 'Русский',   flag: '🇷🇺' },
  { code: 'ja-JP', tts: 'ja-JP', label: '日本語',    flag: '🇯🇵' },
];

// ── Traduire via Claude ───────────────────────────────────
async function claudeTranslate(text: string, targetLabel: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: `Translate to ${targetLabel}. Reply ONLY with the translation:\n\n${text}` }],
    }),
  });
  const d = await res.json();
  return d.content?.[0]?.text?.trim() || '';
}

// ── Lire le texte (sort dans AirPods si connectés) ───────
function speakText(text: string, langCode: string): void {
  Tts.stop();
  Tts.setDefaultLanguage(langCode);
  Tts.speak(text);
}

// ── Ondes sonores animées ─────────────────────────────────
function SoundWave({ active, color }: { active: boolean; color: string }) {
  const anims = useRef([...Array(9)].map(() => new Animated.Value(3))).current;
  const heights = [3, 9, 16, 22, 28, 22, 16, 9, 3];

  React.useEffect(() => {
    if (active) {
      const loops = anims.map((a, i) =>
        Animated.loop(Animated.sequence([
          Animated.timing(a, { toValue: heights[i], duration: 300 + i * 40, useNativeDriver: false }),
          Animated.timing(a, { toValue: 3,          duration: 300 + i * 40, useNativeDriver: false }),
        ]))
      );
      loops.forEach(l => l.start());
      return () => loops.forEach(l => l.stop());
    } else {
      anims.forEach(a => a.setValue(3));
    }
  }, [active]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 32 }}>
      {anims.map((a, i) => (
        <Animated.View key={i} style={{ width: 3, borderRadius: 99, backgroundColor: color, height: a }} />
      ))}
    </View>
  );
}

type Language = typeof LANGUAGES[number];

type HistoryEntry = {
  id: number;
  side: 'A' | 'B';
  original: string;
  translated: string;
  from: Language;
  to: Language;
};

// ── Composant principal ───────────────────────────────────
export default function App() {
  const [screen,   setScreen]   = useState<'airpods' | 'convo'>('airpods');
  const [langFrom, setLangFrom] = useState<Language>(LANGUAGES[0]);
  const [langTo,   setLangTo]   = useState<Language>(LANGUAGES[1]);
  const [picker,   setPicker]   = useState<null | 'from' | 'to'>(null);

  // AirPods state
  const [apOn,         setApOn]         = useState(false);
  const [apStatus,     setApStatus]     = useState<'idle' | 'listening' | 'translating'>('idle');
  const [apOriginal,   setApOriginal]   = useState('');
  const [apTranslated, setApTranslated] = useState('');
  const apAlive = useRef(false);

  // Conversation state
  const [convSide,   setConvSide]   = useState<'A' | 'B' | null>(null);
  const [convTextA,  setConvTextA]  = useState('');
  const [convTextB,  setConvTextB]  = useState('');
  const [convTransA, setConvTransA] = useState('');
  const [convTransB, setConvTransB] = useState('');
  const [convLoadA,  setConvLoadA]  = useState(false);
  const [convLoadB,  setConvLoadB]  = useState(false);
  const [history,    setHistory]    = useState<HistoryEntry[]>([]);

  // ── AIRPODS: démarrer une session d'écoute ──
  const runAirpodsSession = useCallback(async () => {
    if (!apAlive.current) return;

    setApStatus('listening');

    Voice.onSpeechPartialResults = (e) => {
      const t = e.value?.[0] || '';
      setApOriginal(t);
    };

    Voice.onSpeechResults = async (e) => {
      const final = e.value?.[0] || '';
      if (!final.trim()) { runAirpodsSession(); return; }

      setApOriginal(final);
      setApStatus('translating');

      try {
        const tr = await claudeTranslate(final, langTo.label);
        setApTranslated(tr);
        setApStatus('listening');
        // 🔊 Joue DANS les AirPods (Bluetooth audio par défaut)
        speakText(tr, langTo.tts);
      } catch (err) {
        console.error(err);
        setApStatus('listening');
      }

      // Redémarre automatiquement
      setTimeout(() => runAirpodsSession(), 500);
    };

    Voice.onSpeechError = () => {
      if (apAlive.current) setTimeout(() => runAirpodsSession(), 500);
    };

    try {
      await Voice.start(langFrom.code);
    } catch (e) {
      Alert.alert('Erreur micro', 'Autorise le micro dans les réglages de ton iPhone.');
    }
  }, [langFrom, langTo]);

  const startAirpods = () => {
    apAlive.current = true;
    setApOn(true);
    setApOriginal('');
    setApTranslated('');
    runAirpodsSession();
  };

  const stopAirpods = async () => {
    apAlive.current = false;
    try { await Voice.stop(); await Voice.destroy(); } catch {}
    Tts.stop();
    setApOn(false);
    setApStatus('idle');
  };

  // ── CONVERSATION ──
  const startConvMic = async (side: 'A' | 'B') => {
    if (convSide === side) {
      try { await Voice.stop(); } catch {}
      setConvSide(null);
      return;
    }
    try { await Voice.stop(); } catch {}
    setConvSide(side);
    if (side === 'A') { setConvTextA(''); setConvTransA(''); }
    else              { setConvTextB(''); setConvTransB(''); }

    const fromCode = side === 'A' ? langFrom.code  : langTo.code;
    const toLang   = side === 'A' ? langTo.label   : langFrom.label;
    const toTts    = side === 'A' ? langTo.tts     : langFrom.tts;
    const fromObj  = side === 'A' ? langFrom : langTo;
    const toObj    = side === 'A' ? langTo   : langFrom;
    const setTxt   = side === 'A' ? setConvTextA  : setConvTextB;
    const setTrans = side === 'A' ? setConvTransA : setConvTransB;
    const setLoad  = side === 'A' ? setConvLoadA  : setConvLoadB;

    Voice.onSpeechPartialResults = (e) => setTxt(e.value?.[0] || '');
    Voice.onSpeechResults = async (e) => {
      const final = e.value?.[0] || '';
      setTxt(final);
      if (!final.trim()) { setConvSide(null); return; }
      setLoad(true);
      try {
        const tr = await claudeTranslate(final, toLang);
        setTrans(tr);
        setHistory(h => [{ id: Date.now(), side, original: final, translated: tr, from: fromObj, to: toObj }, ...h]);
        speakText(tr, toTts);
      } catch {}
      setLoad(false);
      setConvSide(null);
    };
    Voice.onSpeechError = () => setConvSide(null);

    try { await Voice.start(fromCode); }
    catch { Alert.alert('Erreur micro', 'Autorise le micro dans les réglages.'); }
  };

  const swapLangs = () => {
    setLangFrom(langTo); setLangTo(langFrom);
    setConvTextA(''); setConvTextB(''); setConvTransA(''); setConvTransB('');
    setApOriginal(''); setApTranslated('');
    if (apOn) stopAirpods();
  };

  // ── RENDER ──
  return (
    <SafeAreaView style={S.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#07090f" />
      <ScrollView style={S.scroll} contentContainerStyle={S.container} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={S.header}>
          <View>
            <Text style={S.eyebrow}>◈ AI TRANSLATE</Text>
            <Text style={S.title}>Parle · <Text style={S.titleAccent}>Comprends.</Text></Text>
          </View>
          <View style={S.headerIcon}><Text style={{ fontSize: 26 }}>🌍</Text></View>
        </View>

        {/* AIRPODS NOTICE */}
        <View style={S.notice}>
          <Text style={{ fontSize: 18 }}>🎧</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.noticeTitle}>Connecte tes AirPods en Bluetooth</Text>
            <Text style={S.noticeText}>Réglages → Bluetooth → AirPods. La traduction jouera directement dans tes oreilles.</Text>
          </View>
        </View>

        {/* LANG ROW */}
        <View style={S.langRow}>
          <TouchableOpacity style={S.langPill} onPress={() => setPicker(picker === 'from' ? null : 'from')}>
            <Text style={S.langFlag}>{langFrom.flag}</Text>
            <Text style={S.langLabel}>{langFrom.label}</Text>
            <Text style={S.langArrow}>▾</Text>
          </TouchableOpacity>

          <TouchableOpacity style={S.swapBtn} onPress={swapLangs}>
            <Text style={{ color: '#63b3ed', fontSize: 18 }}>⇄</Text>
          </TouchableOpacity>

          <TouchableOpacity style={S.langPill} onPress={() => setPicker(picker === 'to' ? null : 'to')}>
            <Text style={S.langFlag}>{langTo.flag}</Text>
            <Text style={S.langLabel}>{langTo.label}</Text>
            <Text style={S.langArrow}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* LANGUAGE PICKER */}
        {picker && (
          <View style={S.dropdown}>
            <Text style={S.dropdownLabel}>{picker === 'from' ? 'Langue source' : 'Langue cible'}</Text>
            {LANGUAGES.map(l => (
              <TouchableOpacity key={l.code} style={[S.dropItem, (picker === 'from' ? langFrom : langTo).code === l.code && S.dropItemSel]}
                onPress={() => { picker === 'from' ? setLangFrom(l) : setLangTo(l); setPicker(null); }}>
                <Text style={{ fontSize: 22 }}>{l.flag}</Text>
                <Text style={[S.dropItemText, (picker === 'from' ? langFrom : langTo).code === l.code && { color: '#63b3ed' }]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* NAV */}
        <View style={S.nav}>
          <TouchableOpacity style={[S.navItem, screen === 'airpods' && S.navItemOn]} onPress={() => { setScreen('airpods'); }}>
            <Text style={[S.navText, screen === 'airpods' && S.navTextOn]}>🎧  AirPods</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.navItem, screen === 'convo' && S.navItemOn]} onPress={() => { setScreen('convo'); stopAirpods(); }}>
            <Text style={[S.navText, screen === 'convo' && S.navTextOn]}>💬  Conversation</Text>
          </TouchableOpacity>
        </View>

        {/* ════ AIRPODS SCREEN ════ */}
        {screen === 'airpods' && (
          <View>
            {/* STATUS */}
            <View style={S.chipRow}>
              {!apOn && <View style={[S.chip, S.chipIdle]}><View style={[S.dot, { backgroundColor: '#2d4060' }]} /><Text style={[S.chipText, { color: '#2d4060' }]}>Prêt</Text></View>}
              {apStatus === 'listening'   && <View style={[S.chip, S.chipListen]}><View style={[S.dot, { backgroundColor: '#63b3ed' }]} /><Text style={[S.chipText, { color: '#63b3ed' }]}>En écoute…</Text></View>}
              {apStatus === 'translating' && <View style={[S.chip, S.chipTranslate]}><Text style={[S.chipText, { color: '#9f7aea' }]}>⏳  Claude traduit…</Text></View>}
            </View>

            {/* BIG MIC */}
            <View style={S.bigMicContainer}>
              <TouchableOpacity
                style={[S.bigMic, apOn && S.bigMicOn]}
                onPress={() => apOn ? stopAirpods() : startAirpods()}
                activeOpacity={0.8}>
                <Text style={{ fontSize: 52 }}>{apOn ? '⏹' : '🎤'}</Text>
              </TouchableOpacity>
            </View>

            {apStatus === 'listening' && (
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <SoundWave active color="#63b3ed" />
              </View>
            )}

            {!apOn && (
              <Text style={S.hint}>Appuie → écoute instantanée dans tes AirPods</Text>
            )}

            {/* RESULT CARDS */}
            {apOriginal !== '' && (
              <View style={S.card}>
                <View style={S.cardHeader}>
                  <Text style={{ fontSize: 18 }}>{langFrom.flag}</Text>
                  <Text style={S.cardLabel}>VOUS DITES</Text>
                </View>
                <Text style={S.cardText}>{apOriginal}</Text>
              </View>
            )}

            {apTranslated !== '' && (
              <View style={[S.card, S.cardBlue]}>
                <View style={S.cardHeader}>
                  <Text style={{ fontSize: 18 }}>{langTo.flag}</Text>
                  <Text style={[S.cardLabel, { color: '#63b3ed' }]}>TRADUCTION IA</Text>
                  <View style={S.liveChip}><Text style={{ fontSize: 10, color: '#48bb78', fontWeight: '800' }}>🔊 AIRPODS</Text></View>
                </View>
                <Text style={[S.cardText, { color: '#fff', fontSize: 22 }]}>{apTranslated}</Text>
                <TouchableOpacity style={S.speakBtn} onPress={() => speakText(apTranslated, langTo.tts)}>
                  <Text style={S.speakBtnText}>🔊  Réécouter</Text>
                </TouchableOpacity>
              </View>
            )}

            {apOriginal === '' && !apOn && (
              <View style={[S.card, { alignItems: 'center', paddingVertical: 36 }]}>
                <Text style={{ fontSize: 52, marginBottom: 16 }}>🎧</Text>
                <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginBottom: 6 }}>Mode AirPods Live</Text>
                <Text style={{ color: '#1e3a55', fontSize: 13, lineHeight: 22, textAlign: 'center' }}>
                  1. Connecte tes AirPods en Bluetooth{'\n'}
                  2. Appuie sur le bouton 🎤{'\n'}
                  3. Parle — <Text style={{ color: '#63b3ed', fontWeight: '600' }}>traduction dans tes oreilles</Text>
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ════ CONVERSATION SCREEN ════ */}
        {screen === 'convo' && (
          <View>
            {/* PERSON A */}
            <View style={S.card}>
              <View style={S.personRow}>
                <View>
                  <Text style={[S.personLabel, { color: '#63b3ed' }]}>PERSONNE A</Text>
                  <Text style={S.personLang}>{langFrom.flag}  {langFrom.label}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {convSide === 'A' && <SoundWave active color="#63b3ed" />}
                  <TouchableOpacity
                    style={[S.micSm, convSide === 'A' && S.micSmOn]}
                    onPress={() => startConvMic('A')}>
                    <Text style={{ fontSize: 20 }}>{convSide === 'A' ? '⏹' : '🎤'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {convTextA !== '' && <Text style={S.cardText}>{convTextA}</Text>}
              {convLoadA && <Text style={{ color: '#63b3ed', fontSize: 12, marginTop: 4 }}>⏳ Traduction…</Text>}
              {convTransA !== '' && (
                <View style={S.transBox}>
                  <Text style={[S.cardLabel, { color: '#63b3ed', marginBottom: 4 }]}>→ {langTo.flag} {langTo.label}</Text>
                  <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22 }}>{convTransA}</Text>
                  <TouchableOpacity style={S.speakBtn} onPress={() => speakText(convTransA, langTo.tts)}>
                    <Text style={S.speakBtnText}>🔊  Écouter</Text>
                  </TouchableOpacity>
                </View>
              )}
              {convTextA === '' && convSide !== 'A' && <Text style={S.hint}>Appuie 🎤 pour parler</Text>}
            </View>

            <View style={S.divider}><Text style={{ color: '#1e3a55', fontSize: 16 }}>↕</Text></View>

            {/* PERSON B */}
            <View style={S.card}>
              <View style={S.personRow}>
                <View>
                  <Text style={[S.personLabel, { color: '#9f7aea' }]}>PERSONNE B</Text>
                  <Text style={S.personLang}>{langTo.flag}  {langTo.label}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {convSide === 'B' && <SoundWave active color="#9f7aea" />}
                  <TouchableOpacity
                    style={[S.micSm, convSide === 'B' && S.micSmOnPurple]}
                    onPress={() => startConvMic('B')}>
                    <Text style={{ fontSize: 20 }}>{convSide === 'B' ? '⏹' : '🎤'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {convTextB !== '' && <Text style={S.cardText}>{convTextB}</Text>}
              {convLoadB && <Text style={{ color: '#9f7aea', fontSize: 12, marginTop: 4 }}>⏳ Traduction…</Text>}
              {convTransB !== '' && (
                <View style={[S.transBox, { backgroundColor: 'rgba(159,122,234,.08)' }]}>
                  <Text style={[S.cardLabel, { color: '#9f7aea', marginBottom: 4 }]}>→ {langFrom.flag} {langFrom.label}</Text>
                  <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22 }}>{convTransB}</Text>
                  <TouchableOpacity style={S.speakBtn} onPress={() => speakText(convTransB, langFrom.tts)}>
                    <Text style={S.speakBtnText}>🔊  Écouter</Text>
                  </TouchableOpacity>
                </View>
              )}
              {convTextB === '' && convSide !== 'B' && <Text style={S.hint}>Appuie 🎤 pour parler</Text>}
            </View>

            {/* HISTORY */}
            {history.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={[S.cardLabel, { color: '#1e3a55' }]}>HISTORIQUE</Text>
                  <TouchableOpacity onPress={() => setHistory([])}><Text style={{ color: '#fc8181', fontSize: 11, fontWeight: '700' }}>Effacer</Text></TouchableOpacity>
                </View>
                {history.map(h => (
                  <View key={h.id} style={[S.histItem, { borderColor: h.side === 'A' ? 'rgba(99,179,237,.1)' : 'rgba(159,122,234,.1)' }]}>
                    <Text style={[S.cardLabel, { color: h.side === 'A' ? '#63b3ed' : '#9f7aea', marginBottom: 4 }]}>{h.from.flag} → {h.to.flag}</Text>
                    <Text style={{ color: '#4a6080', fontSize: 13, marginBottom: 3 }}>{h.original}</Text>
                    <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '500' }}>{h.translated}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <Text style={S.footer}>Claude AI · @react-native-voice/voice · react-native-tts</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────
const S = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#07090f' },
  scroll:      { flex: 1 },
  container:   { padding: 20, paddingBottom: 50 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow:     { fontSize: 10, fontWeight: '800', letterSpacing: 3, color: '#1e3a55', textTransform: 'uppercase', marginBottom: 3 },
  title:       { fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  titleAccent: { color: '#63b3ed' },
  headerIcon:  { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(99,179,237,.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,.09)', alignItems: 'center', justifyContent: 'center' },

  notice:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(99,179,237,.06)', borderWidth: 1, borderColor: 'rgba(99,179,237,.15)', borderRadius: 14, padding: 14, marginBottom: 16 },
  noticeTitle: { fontSize: 12, color: '#63b3ed', fontWeight: '700', marginBottom: 3 },
  noticeText:  { fontSize: 11, color: '#2d4a6e', lineHeight: 16 },

  langRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  langPill:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,.07)', borderRadius: 16, padding: 13, justifyContent: 'center' },
  langFlag:    { fontSize: 20 },
  langLabel:   { fontSize: 14, fontWeight: '600', color: '#e2e8f0' },
  langArrow:   { fontSize: 9, color: 'rgba(255,255,255,.3)', marginLeft: 'auto' },
  swapBtn:     { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(99,179,237,.09)', borderWidth: 1, borderColor: 'rgba(99,179,237,.2)', alignItems: 'center', justifyContent: 'center' },

  dropdown:    { backgroundColor: '#0b0e1a', borderWidth: 1, borderColor: 'rgba(255,255,255,.09)', borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  dropdownLabel:{ fontSize: 9, color: '#2d4a6e', fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', padding: 12, paddingBottom: 4 },
  dropItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, paddingHorizontal: 18 },
  dropItemSel: { backgroundColor: 'rgba(99,179,237,.11)' },
  dropItemText:{ fontSize: 14, fontWeight: '500', color: '#e2e8f0' },

  nav:         { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,.055)', borderRadius: 18, padding: 5, marginBottom: 24 },
  navItem:     { flex: 1, paddingVertical: 11, borderRadius: 13, alignItems: 'center' },
  navItemOn:   { backgroundColor: 'rgba(99,179,237,.14)' },
  navText:     { fontSize: 12, fontWeight: '700', color: '#2d3f55', letterSpacing: 0.4, textTransform: 'uppercase' },
  navTextOn:   { color: '#63b3ed' },

  chipRow:     { alignItems: 'center', marginBottom: 20 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
  chipIdle:    { backgroundColor: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.06)' },
  chipListen:  { backgroundColor: 'rgba(99,179,237,.1)',   borderColor: 'rgba(99,179,237,.22)' },
  chipTranslate:{ backgroundColor: 'rgba(159,122,234,.1)', borderColor: 'rgba(159,122,234,.22)' },
  chipText:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  dot:         { width: 7, height: 7, borderRadius: 99 },

  bigMicContainer: { alignItems: 'center', marginBottom: 20 },
  bigMic:      { width: 150, height: 150, borderRadius: 75, backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' },
  bigMicOn:    { backgroundColor: '#1a4a8a', borderColor: 'rgba(99,179,237,.4)', shadowColor: '#63b3ed', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 30, elevation: 20 },

  hint:        { textAlign: 'center', color: '#1e2d45', fontSize: 14, fontWeight: '500', marginBottom: 20 },

  card:        { backgroundColor: 'rgba(255,255,255,.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,.075)', borderRadius: 22, padding: 20, marginBottom: 12 },
  cardBlue:    { backgroundColor: 'rgba(37,99,235,.14)', borderColor: 'rgba(99,179,237,.22)' },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardLabel:   { fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: '#1e3a55' },
  cardText:    { fontSize: 17, color: '#cbd5e0', lineHeight: 26 },
  liveChip:    { marginLeft: 'auto', backgroundColor: 'rgba(72,187,120,.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },

  speakBtn:    { marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,.09)', alignSelf: 'flex-start' },
  speakBtnText:{ color: '#718096', fontSize: 11, fontWeight: '700' },

  personRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  personLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  personLang:  { fontSize: 13, color: '#2d4060', marginTop: 2 },

  micSm:        { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,.09)', alignItems: 'center', justifyContent: 'center' },
  micSmOn:      { backgroundColor: '#1a4a8a', borderColor: 'rgba(99,179,237,.45)', shadowColor: '#63b3ed', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },
  micSmOnPurple:{ backgroundColor: '#4c1d95', borderColor: 'rgba(159,122,234,.45)', shadowColor: '#9f7aea', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },

  transBox:    { backgroundColor: 'rgba(99,179,237,.06)', borderRadius: 14, padding: 14, marginTop: 10 },

  divider:     { alignItems: 'center', marginVertical: 8 },
  histItem:    { backgroundColor: 'rgba(255,255,255,.027)', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 8 },

  footer:      { textAlign: 'center', marginTop: 28, fontSize: 10, color: '#111827', fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
});
