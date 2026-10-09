import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, Keyboard, PermissionsAndroid, Platform, ScrollView } from 'react-native';
import { NativeModules } from 'react-native';

const { YoutubeDlModule } = NativeModules;

const dims = variant => (variant.width && variant.height) ? `${variant.width}x${variant.height}` : 'MAX';

export default function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('> system init...');
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // User selections
  const [format, setFormat] = useState('mp4'); // mp4 or mp3 (for video media types)
  const [quality, setQuality] = useState('high');
  const [folder, setFolder] = useState('Downloads');

  // Media state
  const [mediaType, setMediaType] = useState(null); // 'image', 'video', or null
  const [scan, setScan] = useState(null);
  const [picked, setPicked] = useState([]);
  const [variantOf, setVariantOf] = useState({});

  const isImage = mediaType === 'image';
  const isVideo = mediaType === 'video';

  const resetScan = () => {
    setMediaType(null);
    setScan(null);
    setPicked([]);
    setVariantOf({});
    setFormat('mp4');
  };

  useEffect(() => {
    async function setup() {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        }
        const engine = await YoutubeDlModule.initialize();
        const updateNote = engine.updateWarning  ? '\n> update unavailable; bundled engine active.' : '';
        setStatus(`> ready. ${engine.version}.${updateNote}\n> awaiting input.`);
        setIsReady(true);
      } catch (e) {
        setStatus('> error: init failed.');
      }
    }
    setup();
  }, []);

  const analyzeUrl = async (targetUrl) => {
    Keyboard.dismiss();
    setIsLoading(true);
    setStatus('> analyzing link...');
    try {
      const result = await YoutubeDlModule.analyzeLink(targetUrl);
      setMediaType(result.type);
      setFormat(result.type === 'image' ? 'image' : 'mp4');
      setScan(result);
      setPicked(result.entries.map(e => e.index));
      setVariantOf({});
      
      if (result.type === 'image') {
        const lines = result.entries.map(entry => {
          const variants = entry.variants.length;
          return `  [${entry.index}] ${dims(entry.variants[0])} ${String(entry.variants[0].ext).toUpperCase()}`
            + (variants > 1 ? `  (${variants} resolutions)` : '');
        });
        setStatus(`> scan complete. ${result.count} image(s) found.\n${lines.join('\n')}\n> toggle what you want, then SAVE.`);
      } else {
        setStatus(`> ${result.count} video/audio source(s) found.\n> configure options, then SAVE.`);
      }
    } catch (e) {
      resetScan();
      setStatus(`> error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isReady || !url.startsWith('http')) {
      if (url === '') {
        resetScan();
        if (isReady) setStatus('> awaiting input.');
      }
      return;
    }
    if (!mediaType && !isLoading) {
      analyzeUrl(url);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, isReady]);

  const toggleEntry = index => setPicked(previous =>
    previous.includes(index) ? previous.filter(entry => entry !== index) : [...previous, index]
  );

  const chooseVariant = (index, variant) => setVariantOf(previous => ({ ...previous, [index]: variant }));

  const handleSave = async () => {
    if (!url || !mediaType || !scan) return;
    Keyboard.dismiss();
    setIsLoading(true);

    try {
      if (picked.length === 0 && (isImage || scan.count > 1)) {
        setStatus('> nothing selected.\n> enable at least one item.');
        return;
      }

      if (isImage) {
        const picks = picked.map(index => ({ entry: index, variant: variantOf[index] || 0 }));
        setStatus(`> downloading ${picks.length} image(s)...\n> routing to /${folder}`);
        const result = await YoutubeDlModule.downloadImages(url, { folder, picks });
        const failed = result.failed ? `
> 
> failed: ${result.failed}` : '';
        setStatus(`> success. ${result.count} image(s) saved.\n> ${result.folder}
${failed}`);
      } else {
        setStatus(`> fetching ${format.toUpperCase()} at ${quality} quality...\n> routing to /${folder}`);
        const options = scan.count > 1 ? { format, quality, folder, items: picked } : { format, quality, folder };
        const result = await YoutubeDlModule.download(url, options);
        setStatus(`> success.\n> ${result}`);
      }
      resetScan();
      setUrl('');
    } catch (e) {
      setStatus(`> error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const SelectionRow = ({ title, options, selected, onSelect }) => (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.buttonGroup}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optButton, selected === opt.value && styles.optButtonSelected]}
            onPress={() => onSelect(opt.value)}
            disabled={isLoading}
          >
            <Text style={[styles.optText, selected === opt.value && styles.optTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.title}>YOINK</Text>
          <Text style={styles.subtitle}>opencode // extractor</Text>
        </View>

                <TextInput
          style={styles.input}
          placeholder="target url..."
          placeholderTextColor="#555"
          value={url}
          onChangeText={text => { setUrl(text); resetScan(); }}
          editable={!isLoading && isReady}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor="#FFF"
        />

        {mediaType === 'video' && (
          <SelectionRow
            title="FORMAT"
            selected={format}
            onSelect={setFormat}
            options={[
              {label: 'MP4', value: 'mp4'},
              {label: 'MP3', value: 'mp3'}
            ]}
          />
        )}

        {mediaType === 'video' && (
          <SelectionRow
            title="QUALITY"
            selected={quality}
            onSelect={setQuality}
            options={[
              {label: 'MAX', value: 'high'},
              {label: 'MID', value: 'medium'},
              {label: 'LOW', value: 'low'}
            ]}
          />
        )}

        {mediaType && scan && (mediaType === 'image' || scan.count > 1) && (
          <View style={styles.pickerBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.rowLabel}>{isImage ? 'IMAGES' : 'SLIDES'}</Text>
              <Text style={styles.autoNote}>{`> ${picked.length}/${scan.count} selected`}</Text>
            </View>
            
            {scan.entries.map(entry => {
              const chosen = picked.includes(entry.index);
              const variant = variantOf[entry.index] || 0;
              const current = isImage ? (entry.variants[variant] || entry.variants[0]) : null;
              
              return (
                <View key={entry.index} style={styles.entryBlock}>
                  <TouchableOpacity
                    style={styles.entryRow}
                    onPress={() => toggleEntry(entry.index)}
                    disabled={isLoading}
                  >
                    <Text style={[styles.entryFlag, chosen && styles.entryFlagOn]}>
                      {chosen ? '[x]' : '[ ]'}
                    </Text>
                    <Text style={styles.entryIndex}>
                      {isImage ? `[${entry.index}]` : `SLIDE ${String(entry.index).padStart(2, '0')}`}
                    </Text>
                    <Text style={[styles.entryMeta, !chosen && styles.entryMetaOff]} numberOfLines={1}>
                      {isImage 
                        ? `${dims(current)} ${String(current.ext).toUpperCase()}`
                        : entry.title + (entry.duration > 0 ? ` // ${entry.duration}s` : '')}
                    </Text>
                  </TouchableOpacity>
                  {isImage && entry.variants.length > 1 && (
                    <View style={styles.variantRow}>
                      {entry.variants.map((option, position) => (
                        <TouchableOpacity
                          key={position}
                          style={[styles.variantChip, position === variant && styles.variantChipOn]}
                          onPress={() => chooseVariant(entry.index, position)}
                          disabled={isLoading || !chosen}
                        >
                          <Text style={[styles.variantText, position === variant && styles.variantTextOn]}>
                            {dims(option)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {mediaType && (
          <SelectionRow
            title="OUTPUT"
            selected={folder}
            onSelect={setFolder}
            options={[
              {label: 'DOWNLOADS', value: 'Downloads'},
              {label: 'MUSIC', value: 'Music'},
              {label: 'MOVIES', value: 'Movies'}
            ]}
          />
        )}

        {mediaType && (
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" size="large" />
            ) : (
              <Text style={styles.buttonText}>
                {scan.count > 1 ? `SAVE (${picked.length})` : 'SAVE'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.consoleBox}>
          <Text style={styles.statusText}>{status}</Text>
        </View>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            // DISCLAIMER: This application is heavily inspired by, based on, and acts as a mobile plagiarism of the 'yoinks' CLI from GitHub (github.com/pablostanley/yoinks).
            All credit for the original concept goes to its creator.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { marginBottom: 30 },
  title: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', letterSpacing: -2 },
  subtitle: { fontSize: 14, color: '#777777', marginTop: -4, fontFamily: 'monospace', letterSpacing: 1 },
  input: { backgroundColor: '#0A0A0A', color: '#FFFFFF', fontFamily: 'monospace', fontSize: 16, padding: 16, borderRadius: 0, borderWidth: 1, borderColor: '#333333', marginBottom: 24 },
  rowContainer: { marginBottom: 16 },
  rowLabel: { color: '#777777', fontSize: 12, marginBottom: 8, fontFamily: 'monospace', letterSpacing: 1 },
  autoNote: { color: '#555555', fontSize: 12, fontFamily: 'monospace', letterSpacing: 1 },
  pickerBox: { borderWidth: 1, borderColor: '#222222', padding: 12, marginBottom: 20 },
  entryBlock: { marginBottom: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  entryFlag: { color: '#555555', fontSize: 14, fontFamily: 'monospace', marginRight: 10 },
  entryFlagOn: { color: '#FFFFFF' },
  entryIndex: { color: '#FFFFFF', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold', marginRight: 10 },
  entryMeta: { color: '#CCCCCC', fontSize: 13, fontFamily: 'monospace', flex: 1 },
  entryMetaOff: { color: '#444444' },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 24 },
  variantChip: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#050505', borderWidth: 1, borderColor: '#333333' },
  variantChipOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  variantText: { color: '#777777', fontSize: 11, fontFamily: 'monospace' },
  variantTextOn: { color: '#000000', fontWeight: 'bold' },
  buttonGroup: { flexDirection: 'row', gap: 8 },
  optButton: { flex: 1, paddingVertical: 12, backgroundColor: '#050505', borderRadius: 0, alignItems: 'center', borderWidth: 1, borderColor: '#333333' },
  optButtonSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  optText: { color: '#777777', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' },
  optTextSelected: { color: '#000000' },
  button: { backgroundColor: '#FFFFFF', paddingVertical: 18, borderRadius: 0, alignItems: 'center', marginTop: 10 },
  buttonDisabled: { backgroundColor: '#222222' },
  buttonText: { color: '#000000', fontSize: 16, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 2 },
  consoleBox: { marginTop: 30, backgroundColor: '#000000', padding: 16, borderWidth: 1, borderColor: '#222222' },
  statusText: { color: '#CCCCCC', fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },
  disclaimerBox: { marginTop: 40, borderTopWidth: 1, borderTopColor: '#222222', paddingTop: 20 },
  disclaimerText: { color: '#444444', fontFamily: 'monospace', fontSize: 10, lineHeight: 14, textAlign: 'justify' }
});
