import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, Keyboard, PermissionsAndroid, Platform, ScrollView } from 'react-native';
import { NativeModules } from 'react-native';

const { YoutubeDlModule } = NativeModules;

export default function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('> system init...');
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('high');
  const [folder, setFolder] = useState('Downloads');

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
    setStatus(`> fetching ${format.toUpperCase()} at ${quality} quality...\n> routing to /${folder}`);
    try {
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
          onChangeText={setUrl}
          editable={!isLoading && isReady}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor="#FFF"
        />

        <SelectionRow 
          title="FORMAT" 
          selected={format} 
          onSelect={setFormat}
          options={[{label: 'MP4', value: 'mp4'}, {label: 'MP3', value: 'mp3'}]} 
        />
        
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
            <Text style={styles.buttonText}>EXECUTE</Text>
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
