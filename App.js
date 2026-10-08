import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, Keyboard, PermissionsAndroid, Platform, ScrollView } from 'react-native';
import { NativeModules } from 'react-native';

const { YoutubeDlModule } = NativeModules;

const dims = variant => `${variant.width || '?'}x${variant.height || '?'}`;

export default function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('> system init...');
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('high');
  const [folder, setFolder] = useState('Downloads');
  const [scan, setScan] = useState(null);
  const [picked, setPicked] = useState([]);
  const [variantOf, setVariantOf] = useState({});

  const isImage = format === 'image';

  const resetScan = () => {
    setScan(null);
    setPicked([]);
    setVariantOf({});
  };

  const selectFormat = value => {
    setFormat(value);
    resetScan();
  };

  const toggleEntry = index => setPicked(previous =>
    previous.includes(index) ? previous.filter(entry => entry !== index) : [...previous, index]
  );

  const chooseVariant = (index, variant) => setVariantOf(previous => ({ ...previous, [index]: variant }));

  useEffect(() => {
    async function setup() {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        }
        await YoutubeDlModule.initialize();
        setStatus('> ready. awaiting input.');
        setIsReady(true);
      } catch (e) {
        setStatus('> error: init failed.');
      }
    }
    setup();
  }, []);

  const handleYoink = async () => {
    if (!url) return;
    Keyboard.dismiss();
    setIsLoading(true);

    try {
      if (isImage) {
        if (!scan) {
          setStatus('> scanning images...\n> resolving available resolutions...');
          const result = await YoutubeDlModule.scanImages(url);
          if (result.count === 0) {
            resetScan();
            setStatus('> no images found.\n> this link looks video or audio only.');
            return;
          }
          setScan(result);
          setPicked(result.entries.map(entry => entry.index));
          setVariantOf({});
          const lines = result.entries.map(entry => {
            const variants = entry.variants.length;
            return `  [${entry.index}] ${dims(entry.variants[0])} ${String(entry.variants[0].ext).toUpperCase()}`
              + (variants > 1 ? `  (${variants} resolutions)` : '');
          });
          setStatus(`> scan complete. ${result.count} image(s) found.\n${lines.join('\n')}\n> toggle what you want, then SAVE.`);
          return;
        }

        if (picked.length === 0) {
          setStatus('> nothing selected.\n> enable at least one image.');
          return;
        }

        const picks = picked.map(index => ({ entry: index, variant: variantOf[index] || 0 }));
        setStatus(`> downloading ${picks.length} image(s)...\n> routing to /${folder}`);
        const result = await YoutubeDlModule.downloadImages(url, { folder, picks });
        const failed = result.failed ? `\n> failed: ${result.failed}` : '';
        setStatus(`> success. ${result.count} image(s) saved.\n> ${result.folder}\n${failed}`);
        resetScan();
        setUrl('');
        return;
      }

      setStatus(`> fetching ${format.toUpperCase()} at ${quality} quality...\n> routing to /${folder}`);
      const options = { format, quality, folder };
      const result = await YoutubeDlModule.download(url, options);
      setStatus(`> success.\n> ${result}`);
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

        <SelectionRow
          title="FORMAT"
          selected={format}
          onSelect={selectFormat}
          options={[
            {label: 'MP4', value: 'mp4'},
            {label: 'MP3', value: 'mp3'},
            {label: 'IMG', value: 'image'}
          ]}
        />

        {isImage ? (
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>RESOLUTION</Text>
            <Text style={styles.autoNote}>
              {scan ? `> ${picked.length}/${scan.count} selected // PER IMAGE BELOW` : '> SCAN TO CHOOSE'}
            </Text>
          </View>
        ) : (
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

        {isImage && scan && (
          <View style={styles.pickerBox}>
            {scan.entries.map(entry => {
              const chosen = picked.includes(entry.index);
              const variant = variantOf[entry.index] || 0;
              const current = entry.variants[variant] || entry.variants[0];
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
                    <Text style={styles.entryIndex}>[{entry.index}]</Text>
                    <Text style={[styles.entryMeta, !chosen && styles.entryMetaOff]}>
                      {dims(current)} {String(current.ext).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                  {entry.variants.length > 1 && (
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

        <SelectionRow
          title="OUTPUT"
          selected={folder}
          onSelect={setFolder}
          options={[
            {label: 'DL', value: 'Downloads'},
            {label: 'MSC', value: 'Music'},
            {label: 'VID', value: 'Movies'}
          ]}
        />

        <TouchableOpacity
          style={[styles.button, (!isReady || isLoading || !url) && styles.buttonDisabled]}
          onPress={handleYoink}
          disabled={!isReady || isLoading || !url}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" size="large" />
          ) : (
            <Text style={styles.buttonText}>
              {isImage ? (scan ? `SAVE (${picked.length})` : 'SCAN') : 'EXECUTE'}
            </Text>
          )}
        </TouchableOpacity>

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