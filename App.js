import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, Keyboard, PermissionsAndroid, Platform, ScrollView } from 'react-native';
import { NativeModules, NativeEventEmitter } from 'react-native';

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

  // Queue state
  const [queue, setQueue] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);

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
    const eventEmitter = new NativeEventEmitter(YoutubeDlModule);
    const subscription = eventEmitter.addListener('DownloadProgress', (event) => {
      setQueue(prev => prev.map(j => 
        j.status === 'downloading' ? { ...j, progress: event.progress, eta: event.eta } : j
      ));
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const processNext = async () => {
      if (activeJobId) return;
      const next = queue.find(j => j.status === 'pending');
      if (!next) return;

      setActiveJobId(next.id);
      setQueue(prev => prev.map(j => j.id === next.id ? { ...j, status: 'downloading' } : j));
      setStatus(`> downloading: ${next.title}`);

      try {
        if (next.type === 'image') {
          await YoutubeDlModule.downloadImages(next.url, next.options);
        } else {
          await YoutubeDlModule.download(next.url, next.options);
        }
        if (isMounted) {
          setQueue(prev => prev.map(j => j.id === next.id ? { ...j, status: 'done', progress: 100 } : j));
          setStatus(`> finished: ${next.title}`);
        }
      } catch (e) {
        if (isMounted) {
          setQueue(prev => prev.map(j => j.id === next.id ? { ...j, status: 'error', error: e.message } : j));
          setStatus(`> error on ${next.title}: ${e.message}`);
        }
      } finally {
        if (isMounted) {
          setActiveJobId(null);
        }
      }
    };
    processNext();
    return () => { isMounted = false; };
  }, [queue, activeJobId]);

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

  
  const getSpotifyToken = async () => {
    const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Missing Spotify credentials in .env");

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`
    });
    const data = await response.json();
    if (!data.access_token) throw new Error("Spotify Auth Failed");
    return data.access_token;
  };


  const resolveTwitterViaProxy = async (targetUrl) => {
    const proxyUrl = process.env.EXPO_PUBLIC_X_PROXY_URL;
    const apiKey = process.env.EXPO_PUBLIC_X_PROXY_KEY;
    
    const res = await fetch(`${proxyUrl}?url=${encodeURIComponent(targetUrl)}`, {
      headers: { 'x-api-key': apiKey }
    });
    
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Proxy failed to resolve Twitter link');
    }
    
    return {
      type: 'video',
      count: 1,
      isProxy: true,
      entries: [{
        index: 0,
        id: 'twitter_proxied',
        title: data.title || 'X Video',
        directUrl: data.download_url,
        variants: [{ format_id: 'best', ext: 'mp4', resolution: 'proxy-best' }]
      }]
    };
  };

  const searchSpotify = async (query) => {
    const token = await getSpotifyToken();
    const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.tracks || data.tracks.items.length === 0) throw new Error("No tracks found");
    
    return {
      type: 'video',
      count: data.tracks.items.length,
      isSpotify: true,
      isSearch: true,
      entries: data.tracks.items.map((track, idx) => ({
        index: idx + 1,
        title: `${track.name} - ${track.artists[0].name}`,
        _query: `ytsearch1:${track.name} ${track.artists[0].name}`
      }))
    };
  };

  const parseSpotifyUrl = async (targetUrl) => {

    const token = await getSpotifyToken();
    const headers = { 'Authorization': `Bearer ${token}` };
    const queries = [];
    
    const getID = (url) => {
      const match = url.match(/(track|album|playlist)\/([a-zA-Z0-9]+)/);
      return match ? { type: match[1], id: match[2] } : null;
    };

    const parsed = getID(targetUrl);
    if (!parsed) throw new Error("Invalid Spotify link");

    if (parsed.type === 'track') {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${parsed.id}`, { headers });
      const track = await res.json();
      queries.push({ title: track.name, artist: track.artists[0].name });
    } else if (parsed.type === 'album') {
      const res = await fetch(`https://api.spotify.com/v1/albums/${parsed.id}/tracks`, { headers });
      const album = await res.json();
      album.items.forEach(track => {
        queries.push({ title: track.name, artist: track.artists[0].name });
      });
    } else if (parsed.type === 'playlist') {
      let nextUrl = `https://api.spotify.com/v1/playlists/${parsed.id}/tracks`;
      while (nextUrl) {
        const res = await fetch(nextUrl, { headers });
        const playlist = await res.json();
        playlist.items.forEach(item => {
          if (item.track) {
            queries.push({ title: item.track.name, artist: item.track.artists[0].name });
          }
        });
        nextUrl = playlist.next; 
      }
    }

    if (queries.length === 0) throw new Error("No tracks found");
    
    return {
      type: 'video',
      count: queries.length,
      isSpotify: true,
      isSearch: true,
      entries: queries.map((q, idx) => ({
        index: idx + 1,
        title: `${q.title} - ${q.artist}`,
        _query: `ytsearch1:${q.title} ${q.artist}`
      }))
    };
  };

const analyzeUrl = async (targetUrl) => {
    Keyboard.dismiss();
    setIsLoading(true);
    setStatus('> analyzing link...');
    
    try {
      let result;
      if (!targetUrl.startsWith('http')) {
        setStatus('> searching spotify for: ' + targetUrl + '...');
        result = await searchSpotify(targetUrl);
      } else if (targetUrl.includes('spotify.com')) {

        setStatus('> spotify detected. resolving via API...');
        result = await parseSpotifyUrl(targetUrl);
      } else if ((targetUrl.includes('twitter.com') || targetUrl.includes('x.com')) && process.env.EXPO_PUBLIC_X_PROXY_URL) {
        setStatus('> restricted X/Twitter detected. resolving via proxy...');
        result = await resolveTwitterViaProxy(targetUrl);
      } else {
        result = await YoutubeDlModule.analyzeLink(targetUrl);
      }

      setMediaType(result.type);
      if (result.type === 'image') {
        setFormat('image');
      } else if (result.isSpotify) {
        setFormat('mp3');
      } else {
        setFormat('mp4');
      }
      setScan(result);
      setPicked(result.isSearch ? [] : result.entries.map(e => e.index));
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
        if (isReady && !activeJobId) setStatus('> awaiting input.');
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

  const handleSave = () => {
    if (!url || !mediaType || !scan) return;
    Keyboard.dismiss();

    if (picked.length === 0 && (isImage || scan.count > 1)) {
      setStatus('> nothing selected.\n> enable at least one item.');
      return;
    }

    if (isImage) {
      const picks = picked.map(index => ({ entry: index, variant: variantOf[index] || 0 }));
      const newJob = {
        id: Date.now().toString(),
        title: `${picks.length} Image(s)`,
        type: 'image',
        url,
        options: { folder, picks },
        status: 'pending',
        progress: 0
      };
      setQueue(prev => [...prev, newJob]);
      setStatus(`> queued ${picks.length} image(s).`);
    } else if (scan.isSpotify) {
      const newJobs = picked.map(index => {
        const entry = scan.entries.find(e => e.index === index);
        return {
          id: Date.now().toString() + index,
          title: entry.title,
          type: 'spotify',
          url: entry._query,
          options: { format, quality, folder },
          status: 'pending',
          progress: 0
        };
      });
      setQueue(prev => [...prev, ...newJobs]);
      setStatus(`> queued ${newJobs.length} track(s).`);
    } else {
      const newJob = {
        id: Date.now().toString(),
        title: scan.count > 1 ? `${picked.length} Video(s) from Playlist` : (scan.entries[0]?.title || 'Video'),
        type: 'video',
        url: scan.isProxy ? scan.entries[0].directUrl : url,
        options: scan.count > 1 ? { format, quality, folder, items: picked } : { format, quality, folder },
        status: 'pending',
        progress: 0
      };
      setQueue(prev => [...prev, newJob]);
      setStatus(`> queued ${scan.count > 1 ? picked.length + ' item(s)' : 'video'}.`);
    }
    
    resetScan();
    setUrl('');
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
      <StatusBar barStyle="light-content" backgroundColor="#0B5497" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.title}>YOINK</Text>
          <Text style={styles.subtitle}>opencode // extractor</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="target url or search song..."
          placeholderTextColor="#555"
          value={url}
          onChangeText={text => { setUrl(text); resetScan(); }}
          onSubmitEditing={() => {
            if (!url.startsWith('http') && url.trim().length > 0) {
              analyzeUrl(url);
            }
          }}
          returnKeyType="search"
          editable={!isLoading && isReady}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor="#68C7EC"
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
              <Text style={styles.rowLabel}>{isImage ? 'IMAGES' : (scan.isSpotify ? 'TRACKS' : 'MEDIA')}</Text>
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
                      {isImage ? `[${entry.index}]` : (scan.isSpotify ? `TRACK ${String(entry.index).padStart(2, '0')}` : `ITEM ${String(entry.index).padStart(2, '0')}`)}
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
                {scan.count > 1 ? `YOINK! (${picked.length})` : 'YOINK!'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.consoleBox}>
          <Text style={styles.statusText}>{status}</Text>
        </View>

        {queue.length > 0 && (
          <View style={styles.queueBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={styles.queueHeader}>QUEUE ({queue.filter(j => j.status === 'pending').length} PENDING)</Text>
              <TouchableOpacity onPress={() => setQueue(q => q.filter(j => j.status !== 'done' && j.status !== 'error'))}>
                <Text style={styles.clearText}>[CLEAR]</Text>
              </TouchableOpacity>
            </View>
            {queue.map(job => (
              <View key={job.id} style={styles.jobRow}>
                <Text style={styles.jobStatus}>
                  {job.status === 'pending' ? '[WAIT]' : job.status === 'downloading' ? '[DOWN]' : job.status === 'done' ? '[DONE]' : '[FAIL]'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  {job.status === 'downloading' && (
                    <Text style={styles.jobProgress}>
                      {job.progress.toFixed(1)}% {job.eta > 0 ? `(ETA: ${job.eta}s)` : ''}
                    </Text>
                  )}
                  {job.status === 'error' && (
                    <Text style={styles.jobError} numberOfLines={1}>{job.error}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

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
  container: { flex: 1, backgroundColor: '#0B5497' },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { marginBottom: 30 },
  title: { fontSize: 48, fontWeight: '900', color: '#FFFEF9', letterSpacing: -2 },
  subtitle: { fontSize: 14, color: '#D0DCE5', marginTop: -4, fontFamily: 'monospace', letterSpacing: 1 },
  input: { backgroundColor: '#0B5497', color: '#FFFEF9', fontFamily: 'monospace', fontSize: 16, padding: 16, borderRadius: 0, borderWidth: 1, borderColor: '#FFFEF9', marginBottom: 24 },
  rowContainer: { marginBottom: 16 },
  rowLabel: { color: '#FFFEF9', fontSize: 12, marginBottom: 8, fontFamily: 'monospace', letterSpacing: 1 },
  autoNote: { color: '#D0DCE5', fontSize: 12, fontFamily: 'monospace', letterSpacing: 1 },
  pickerBox: { borderWidth: 1, borderColor: '#FFFEF9', padding: 12, marginBottom: 20 },
  entryBlock: { marginBottom: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  entryFlag: { color: '#D0DCE5', fontSize: 14, fontFamily: 'monospace', marginRight: 10 },
  entryFlagOn: { color: '#FFFEF9' },
  entryIndex: { color: '#FFFEF9', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold', marginRight: 10 },
  entryMeta: { color: '#FFFEF9', fontSize: 13, fontFamily: 'monospace', flex: 1 },
  entryMetaOff: { color: '#84A9CB' },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 24 },
  variantChip: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#0B5497', borderWidth: 1, borderColor: '#FFFEF9' },
  variantChipOn: { backgroundColor: '#FFFEF9', borderColor: '#FFFEF9' },
  variantText: { color: '#FFFEF9', fontSize: 11, fontFamily: 'monospace' },
  variantTextOn: { color: '#0B5497', fontWeight: 'bold' },
  buttonGroup: { flexDirection: 'row', gap: 8 },
  optButton: { flex: 1, paddingVertical: 12, backgroundColor: '#0B5497', borderRadius: 0, alignItems: 'center', borderWidth: 1, borderColor: '#FFFEF9' },
  optButtonSelected: { backgroundColor: '#FFFEF9', borderColor: '#FFFEF9' },
  optText: { color: '#FFFEF9', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' },
  optTextSelected: { color: '#0B5497' },
  button: { backgroundColor: '#FFFEF9', paddingVertical: 18, borderRadius: 0, alignItems: 'center', marginTop: 10 },
  buttonDisabled: { backgroundColor: '#5582A9' },
  buttonText: { color: '#0B5497', fontSize: 16, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 2 },
  consoleBox: { marginTop: 30, backgroundColor: '#0B5497', padding: 16, borderWidth: 1, borderColor: '#FFFEF9' },
  statusText: { color: '#FFFEF9', fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },
  queueBox: { marginTop: 20, borderWidth: 1, borderColor: '#FFFEF9', padding: 12, backgroundColor: '#0B5497' },
  queueHeader: { color: '#FFFEF9', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  clearText: { color: '#D0DCE5', fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' },
  jobRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  jobStatus: { color: '#D0DCE5', fontFamily: 'monospace', fontSize: 12, marginRight: 8, width: 50 },
  jobTitle: { color: '#FFFEF9', fontFamily: 'monospace', fontSize: 12 },
  jobProgress: { color: '#FFFEF9', fontFamily: 'monospace', fontSize: 10, marginTop: 2 },
  jobError: { color: '#FF5555', fontFamily: 'monospace', fontSize: 10, marginTop: 2 },
  disclaimerBox: { marginTop: 40, borderTopWidth: 1, borderTopColor: '#84A9CB', paddingTop: 20 },
  disclaimerText: { color: '#D0DCE5', fontFamily: 'monospace', fontSize: 10, lineHeight: 14, textAlign: 'justify' }
});
