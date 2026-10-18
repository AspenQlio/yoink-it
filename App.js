import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Keyboard,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Image,
  NativeModules,
  NativeEventEmitter,
  Vibration,
} from 'react-native';
import { File, Paths } from 'expo-file-system';

const { YoutubeDlModule } = NativeModules;

const THEME = {
  ink: '#003049',           // Canvas background (Deep Space Blue)
  navy: '#002337',          // Secondary plane / surface cards
  navyDeep: '#001927',      // Deep terminal / embedded wells
  paper: '#FDF0D5',         // Papaya Whip (cream surfaces, selected text)
  white: '#FFFFFF',         // Pure white highlights
  brickRed: '#C1121F',      // Primary highlight & actions
  brickRedHot: '#E03E3E',   // Hover / active touch
  moltenLava: '#780000',    // Deep border & shadow depth
  steelBlue: '#669BBC',     // Secondary accents / badges
  steelBlueDeep: '#4A7A9A', // Muted borders / dividers
  textMuted: '#8B7D6B',     // Tertiary copy
  disabled: '#2A4356',      // Disabled button surface
  success: '#50FA7B',       // Completed / ok
  error: '#FF5555',         // Error / alert
};

const dims = variant => (variant.width && variant.height) ? `${variant.width}x${variant.height}` : 'MAX';
const dataFile = new File(Paths.document, 'yoink_data.json');
const cookiesFile = new File(Paths.document, 'cookies.txt');

const formatDuration = sec => {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const renderAsciiBar = (progress = 0) => {
  const total = 12;
  const safeProgress = Math.max(0, Math.min(100, progress));
  const filled = Math.round((safeProgress / 100) * total);
  return '█'.repeat(filled) + '░'.repeat(total - filled);
};

const detectPlatform = (targetUrl) => {
  if (!targetUrl || typeof targetUrl !== 'string') return null;
  const lower = targetUrl.toLowerCase().trim();
  if (!lower) return null;
  if (lower.includes('spotify.com')) return { name: 'SPOTIFY', tag: 'MUSIC / PLAYLIST' };
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return { name: 'YOUTUBE', tag: 'VIDEO / AUDIO' };
  if (lower.includes('instagram.com')) return { name: 'INSTAGRAM', tag: 'CAROUSEL / REEL' };
  if (lower.includes('twitter.com') || lower.includes('x.com')) return { name: 'X / TWITTER', tag: 'POST / CLIP' };
  if (lower.includes('tiktok.com')) return { name: 'TIKTOK', tag: 'SHORT VIDEO' };
  if (lower.includes('soundcloud.com')) return { name: 'SOUNDCLOUD', tag: 'AUDIO TRACK' };
  if (lower.startsWith('http')) return { name: 'WEB STREAM', tag: 'DIRECT MEDIA' };
  return { name: 'SPOTIFY SEARCH', tag: 'SONG QUERY' };
};

const triggerHaptic = (style = 'light') => {
  try {
    if (Platform.OS === 'android') {
      if (style === 'heavy') Vibration.vibrate([0, 25]);
      else if (style === 'success') Vibration.vibrate([0, 15, 35, 15]);
      else Vibration.vibrate(10);
    }
  } catch {
    // safe fallback
  }
};

const defaultSettings = {
  xMode: 'proxy',
  proxyUrl: process.env.EXPO_PUBLIC_X_PROXY_URL || '',
  proxyKey: '',
  spotifyClientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '',
  spotifyClientSecret: '',
  cookiesText: '',
};

const readLocalData = () => {
  try {
    if (!dataFile.exists) return { settings: defaultSettings, history: [] };
    const parsed = JSON.parse(dataFile.textSync());
    return {
      settings: { ...defaultSettings, ...(parsed.settings || {}) },
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { settings: defaultSettings, history: [] };
  }
};

const writeLocalData = (settings, history) => {
  dataFile.write(JSON.stringify({ settings: { ...settings, cookiesText: '' }, history }, null, 2));
  if (settings.cookiesText.trim()) {
    cookiesFile.write(settings.cookiesText.trim() + '\n');
  } else if (cookiesFile.exists) {
    cookiesFile.delete();
  }
};

const readJsonResponse = async (response, label) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || `${label} failed (${response.status})`);
  }
  return data;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [url, setUrl] = useState('');
  const [status, setStatusRaw] = useState('> system init...');
  const [logHistory, setLogHistory] = useState([
    { id: '1', time: new Date().toLocaleTimeString().slice(0, 5), text: 'system initialized. ready.' }
  ]);
  const [cursor, setCursor] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [history, setHistory] = useState([]);

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
  const [isQueueRunning, setIsQueueRunning] = useState(false);

  const isImage = mediaType === 'image';
  const cookieOptions = () => settings.xMode === 'cookies' && settings.cookiesText.trim() && cookiesFile.exists
    ? { cookies: cookiesFile.uri }
    : {};

  const detected = detectPlatform(url);

  // Blinking terminal cursor
  useEffect(() => {
    const timer = setInterval(() => setCursor(c => !c), 600);
    return () => clearInterval(timer);
  }, []);

  const setStatus = (msg) => {
    setStatusRaw(msg);
    const cleanMsg = msg.replace(/^>\s*/, '');
    const nowTime = new Date().toLocaleTimeString().slice(0, 5);
    setLogHistory(prev => [
      { id: `${Date.now()}-${Math.random()}`, time: nowTime, text: cleanMsg },
      ...prev
    ].slice(0, 5));
  };

  const persistLocalData = (nextSettings = settings, nextHistory = history) => {
    writeLocalData(nextSettings, nextHistory);
  };

  const appendHistory = job => {
    const entry = {
      id: `${job.id}-${Date.now()}`,
      title: job.title,
      type: job.type,
      sourceUrl: job.sourceUrl || job.url,
      thumbnail: job.thumbnail || '',
      completedAt: new Date().toISOString(),
    };
    const next = [entry, ...history].slice(0, 200);
    setHistory(next);
    persistLocalData(settings, next);
  };

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
    const processNext = async () => {
      if (!isQueueRunning || activeJobId) return;
      
      const nextJob = queue.find(j => j.status === 'pending');
      if (!nextJob) {
        setIsQueueRunning(false);
        triggerHaptic('success');
        return;
      }

      setActiveJobId(nextJob.id);
      setQueue(prev => prev.map(j => j.id === nextJob.id ? { ...j, status: 'downloading' } : j));
      setStatus(`> downloading: ${nextJob.title}`);

      try {
        if (nextJob.type === 'image') {
          await YoutubeDlModule.downloadImages(nextJob.url, nextJob.options);
        } else {
          await YoutubeDlModule.download(nextJob.url, nextJob.options);
        }
        setQueue(prev => prev.map(j => j.id === nextJob.id ? { ...j, status: 'done', progress: 100 } : j));
        appendHistory(nextJob);
        triggerHaptic('light');
        setStatus(`> finished: ${nextJob.title}`);
      } catch (e) {
        setQueue(prev => prev.map(j => j.id === nextJob.id ? { ...j, status: 'error', error: e.message } : j));
        triggerHaptic('heavy');
        setStatus(`> error on ${nextJob.title}: ${e.message}`);
      } finally {
        setActiveJobId(null);
      }
    };
    processNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, activeJobId, isQueueRunning]);

  useEffect(() => {
    async function setup() {
      try {
        const localData = readLocalData();
        if (cookiesFile.exists) {
          localData.settings.cookiesText = cookiesFile.textSync();
        }
        setSettings(localData.settings);
        setHistory(localData.history);
        if (Platform.OS === 'android') {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        }
        const engine = await YoutubeDlModule.initialize();
        const updateNote = engine.updateWarning ? '\n> update unavailable; bundled engine active.' : '';
        setStatus(`> ready. ${engine.version}.${updateNote}\n> awaiting input.`);
        setIsReady(true);
      } catch (_error) {
        setStatus('> error: init failed.');
      }
    }
    setup();
  }, []);

  const getSpotifyToken = async () => {
    const clientId = settings.spotifyClientId;
    const clientSecret = settings.spotifyClientSecret;
    if (!clientId || !clientSecret) throw new Error('Missing Spotify credentials in Settings');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`
    });
    const data = await readJsonResponse(response, 'Spotify authentication');
    if (!data.access_token) throw new Error('Spotify Auth Failed');
    return data.access_token;
  };

  const resolveTwitterViaProxy = async (targetUrl) => {
    const proxyUrl = settings.proxyUrl;
    const apiKey = settings.proxyKey;
    
    const res = await fetch(`${proxyUrl}?url=${encodeURIComponent(targetUrl)}`, {
      headers: { 'x-api-key': apiKey }
    });
    
    const data = await readJsonResponse(res, 'X proxy');
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Proxy failed to resolve Twitter link');
    }
    
    return {
      type: 'video',
      count: 1,
      isProxy: true,
      thumbnail: data.thumbnail || '',
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
    const data = await readJsonResponse(res, 'Spotify search');
    if (!data.tracks || data.tracks.items.length === 0) throw new Error('No tracks found');
    
    return {
      type: 'video',
      count: data.tracks.items.length,
      isSpotify: true,
      isSearch: true,
      entries: data.tracks.items.map((track, idx) => ({
        index: idx + 1,
        title: `${track.name} - ${track.artists[0].name}`,
        duration: Math.round((track.duration_ms || 0) / 1000),
        _query: `ytsearch1:${track.name} ${track.artists[0].name}`
      }))
    };
  };

  const parseSpotifyUrl = async (targetUrl) => {
    const token = await getSpotifyToken();
    const headers = { 'Authorization': `Bearer ${token}` };
    const queries = [];
    
    const getID = (rawUrl) => {
      const match = rawUrl.match(/(track|album|playlist)\/([a-zA-Z0-9]+)/);
      return match ? { type: match[1], id: match[2] } : null;
    };

    const parsed = getID(targetUrl);
    if (!parsed) throw new Error('Invalid Spotify link');

    if (parsed.type === 'track') {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${parsed.id}`, { headers });
      const track = await readJsonResponse(res, 'Spotify track lookup');
      queries.push({
        title: track.name,
        artist: track.artists[0].name,
        duration: Math.round((track.duration_ms || 0) / 1000)
      });
    } else if (parsed.type === 'album') {
      const res = await fetch(`https://api.spotify.com/v1/albums/${parsed.id}/tracks`, { headers });
      const album = await readJsonResponse(res, 'Spotify album lookup');
      album.items.forEach(track => {
        queries.push({
          title: track.name,
          artist: track.artists[0].name,
          duration: Math.round((track.duration_ms || 0) / 1000)
        });
      });
    } else if (parsed.type === 'playlist') {
      let nextUrl = `https://api.spotify.com/v1/playlists/${parsed.id}/tracks`;
      while (nextUrl) {
        const res = await fetch(nextUrl, { headers });
        const playlist = await readJsonResponse(res, 'Spotify playlist lookup');
        playlist.items.forEach(item => {
          if (item.track) {
            queries.push({
              title: item.track.name,
              artist: item.track.artists[0].name,
              duration: Math.round((item.track.duration_ms || 0) / 1000)
            });
          }
        });
        nextUrl = playlist.next; 
      }
    }

    if (queries.length === 0) throw new Error('No tracks found');
    
    return {
      type: 'video',
      count: queries.length,
      isSpotify: true,
      isSearch: true,
      entries: queries.map((q, idx) => ({
        index: idx + 1,
        title: `${q.title} - ${q.artist}`,
        duration: q.duration || 0,
        _query: `ytsearch1:${q.title} ${q.artist}`
      }))
    };
  };

  const analyzeUrl = async (targetUrl) => {
    Keyboard.dismiss();
    setIsLoading(true);
    setStatus('> analyzing link...');
    triggerHaptic('light');
    
    try {
      let result;
      if (!targetUrl.startsWith('http')) {
        setStatus(`> searching spotify for: ${targetUrl}...`);
        result = await searchSpotify(targetUrl);
      } else if (targetUrl.includes('spotify.com')) {
        setStatus('> spotify detected. resolving via API...');
        result = await parseSpotifyUrl(targetUrl);
      } else if ((targetUrl.includes('twitter.com') || targetUrl.includes('x.com')) && settings.xMode === 'proxy' && settings.proxyUrl) {
        setStatus('> restricted X/Twitter detected. resolving via proxy...');
        result = await resolveTwitterViaProxy(targetUrl);
      } else {
        result = await YoutubeDlModule.analyzeLink(targetUrl, cookieOptions());
      }

      setMediaType(result.type);
      if (result.type === 'image') {
        setFormat('image');
        setFolder('Pictures');
      } else if (result.isSpotify) {
        setFormat('mp3');
        setFolder('Music');
      } else {
        setFormat('mp4');
        setFolder('Movies');
      }
      setScan(result);
      setPicked(result.isSearch ? [] : result.entries.map(e => e.index));
      setVariantOf({});
      triggerHaptic('success');
      
      if (result.type === 'image') {
        const lines = result.entries.map(entry => {
          const variants = entry.variants.length;
          return `  [${entry.index}] ${dims(entry.variants[0])} ${String(entry.variants[0].ext).toUpperCase()}`
            + (variants > 1 ? `  (${variants} res)` : '');
        });
        setStatus(`> scan complete: ${result.count} image(s).\n${lines.join('\n')}\n> toggle items, then YOINK.`);
      } else {
        setStatus(`> ${result.count} source(s) found.\n> configure options, then YOINK.`);
      }
    } catch (e) {
      resetScan();
      triggerHaptic('heavy');
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

  const toggleEntry = index => {
    triggerHaptic('light');
    setPicked(previous =>
      previous.includes(index) ? previous.filter(entry => entry !== index) : [...previous, index]
    );
  };

  const chooseVariant = (index, variant) => {
    triggerHaptic('light');
    setVariantOf(previous => ({ ...previous, [index]: variant }));
  };

  const selectAllEntries = () => {
    if (!scan?.entries) return;
    triggerHaptic('light');
    setPicked(scan.entries.map(e => e.index));
  };

  const deselectAllEntries = () => {
    triggerHaptic('light');
    setPicked([]);
  };

  const invertSelection = () => {
    if (!scan?.entries) return;
    triggerHaptic('light');
    setPicked(scan.entries.map(e => e.index).filter(idx => !picked.includes(idx)));
  };

  const handleSave = (autoStart = false) => {
    if (!url || !mediaType || !scan) return;
    Keyboard.dismiss();
    triggerHaptic(autoStart ? 'heavy' : 'light');

    if (picked.length === 0 && (isImage || scan.count > 1)) {
      setStatus('> nothing selected.\n> enable at least one item.');
      return;
    }

    let addedCount = 0;
    if (isImage) {
      const picks = picked.map(index => ({ entry: index, variant: variantOf[index] || 0 }));
      const newJob = {
        id: Date.now().toString(),
        title: `${picks.length} Image(s)`,
        type: 'image',
        url,
        options: { folder, picks, ...cookieOptions() },
        sourceUrl: url,
        thumbnail: scan.thumbnail || '',
        status: 'pending',
        progress: 0,
        eta: 0
      };
      setQueue(prev => [...prev, newJob]);
      addedCount = picks.length;
      setStatus(`> queued ${picks.length} image(s).`);
    } else if (scan.isSpotify) {
      const newJobs = picked.map(index => {
        const entry = scan.entries.find(e => e.index === index);
        return {
          id: Date.now().toString() + index,
          title: entry.title,
          type: 'spotify',
          url: entry._query,
          options: { format, quality, folder, ...cookieOptions() },
          sourceUrl: url,
          thumbnail: scan.thumbnail || '',
          status: 'pending',
          progress: 0,
          eta: 0
        };
      });
      setQueue(prev => [...prev, ...newJobs]);
      addedCount = newJobs.length;
      setStatus(`> queued ${newJobs.length} track(s).`);
    } else {
      const newJob = {
        id: Date.now().toString(),
        title: scan.count > 1 ? `${picked.length} Video(s) from Playlist` : (scan.entries[0]?.title || 'Video'),
        type: 'video',
        url: scan.isProxy ? scan.entries[0].directUrl : url,
        options: scan.count > 1
          ? { format, quality, folder, items: picked, ...cookieOptions() }
          : { format, quality, folder, ...cookieOptions() },
        sourceUrl: url,
        thumbnail: scan.thumbnail || '',
        status: 'pending',
        progress: 0,
        eta: 0
      };
      setQueue(prev => [...prev, newJob]);
      addedCount = scan.count > 1 ? picked.length : 1;
      setStatus(`> queued ${scan.count > 1 ? picked.length + ' item(s)' : 'video'}.`);
    }
    
    if (autoStart) {
      setIsQueueRunning(true);
      setStatus(`> extraction started for ${addedCount} item(s)...`);
    }

    resetScan();
    setUrl('');
  };

  const removeQueueJob = (id) => {
    triggerHaptic('light');
    setQueue(prev => prev.filter(j => j.id !== id));
  };

  const retryQueueJob = (id) => {
    triggerHaptic('heavy');
    setQueue(prev => prev.map(j => j.id === id ? { ...j, status: 'pending', error: null, progress: 0, eta: 0 } : j));
    setIsQueueRunning(true);
  };

  const reYoink = (item) => {
    triggerHaptic('heavy');
    setUrl(item.sourceUrl);
    setActiveTab('home');
    resetScan();
    analyzeUrl(item.sourceUrl);
  };

  const SelectionRow = ({ title, options, selected, onSelect }) => (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.buttonGroup}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optButton, selected === opt.value && styles.optButtonSelected]}
            onPress={() => {
              triggerHaptic('light');
              onSelect(opt.value);
            }}
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

  const updateSetting = (key, value) => {
    setSettings(previous => ({ ...previous, [key]: value }));
  };

  const saveSettings = () => {
    triggerHaptic('success');
    persistLocalData(settings, history);
    setStatus('> settings saved locally.');
    setActiveTab('home');
  };

  const clearHistory = () => {
    triggerHaptic('heavy');
    setHistory([]);
    persistLocalData(settings, []);
    setStatus('> history cleared.');
  };

  const pendingQueueCount = queue.filter(j => j.status === 'pending').length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.ink} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>

        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>YOINK</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>DOSSIER v1.2</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>ASPEN // MEDIA EXTRACTION SYSTEM</Text>
        </View>

        {/* Navigation Tab Bar */}
        <View style={styles.tabBar}>
          {[
            { label: 'YOINK', value: 'home' },
            { label: `HISTORY (${history.length})`, value: 'history' },
            { label: 'SETTINGS', value: 'settings' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.value}
              style={[styles.tabButton, activeTab === tab.value && styles.tabButtonActive]}
              onPress={() => {
                triggerHaptic('light');
                setActiveTab(tab.value);
              }}
            >
              <Text style={[styles.tabText, activeTab === tab.value && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab 1: YOINK (Home) */}
        {activeTab === 'home' && <>

          {/* Input & Extraction Command Bar */}
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>&gt;</Text>
              <TextInput
                style={styles.input}
                placeholder="paste url or search track..."
                placeholderTextColor={THEME.steelBlueDeep}
                value={url}
                onChangeText={text => { setUrl(text); resetScan(); }}
                onSubmitEditing={() => {
                  if (url.trim().length > 0) {
                    analyzeUrl(url.trim());
                  }
                }}
                returnKeyType="search"
                editable={!isLoading && isReady}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={THEME.brickRed}
              />
              {url.length > 0 && (
                <TouchableOpacity
                  style={styles.clearInputBtn}
                  onPress={() => {
                    triggerHaptic('light');
                    setUrl('');
                    resetScan();
                    if (isReady && !activeJobId) setStatus('> input cleared.');
                  }}
                  disabled={isLoading}
                >
                  <Text style={styles.clearInputText}>[×]</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Action Bar under input */}
            <View style={styles.inputActionRow}>
              <TouchableOpacity
                style={[
                  styles.scanActionBtn,
                  (!url.trim() || isLoading) && styles.scanActionBtnDisabled
                ]}
                onPress={() => {
                  if (url.trim().length > 0 && !isLoading) {
                    analyzeUrl(url.trim());
                  }
                }}
                disabled={!url.trim() || isLoading}
              >
                {isLoading ? (
                  <View style={styles.actionBtnContent}>
                    <ActivityIndicator size="small" color={THEME.white} />
                    <Text style={styles.scanActionBtnText}> SCANNING...</Text>
                  </View>
                ) : (
                  <Text style={styles.scanActionBtnText}>
                    {url.startsWith('http') ? '[SCAN LINK]' : '[SEARCH SPOTIFY]'}
                  </Text>
                )}
              </TouchableOpacity>

              {detected && (
                <View style={styles.platformBadge}>
                  <Text style={styles.platformBadgeText}>[{detected.name}]</Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Platform Indicators when empty */}
          {!url && !scan && (
            <View style={styles.supportedRow}>
              <Text style={styles.supportedLabel}>SOURCES:</Text>
              {['YOUTUBE', 'INSTAGRAM', 'SPOTIFY', 'X', 'TIKTOK'].map(p => (
                <View key={p} style={styles.supportedTag}>
                  <Text style={styles.supportedTagText}>{p}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Media Scan Preview Card */}
          {scan && (
            <View style={styles.scanMetaCard}>
              <View style={styles.scanCardHeader}>
                <View style={styles.scanCardBadge}>
                  <Text style={styles.scanCardBadgeText}>
                    {scan.isSpotify ? 'SPOTIFY' : isImage ? 'IMAGE CAROUSEL' : scan.count > 1 ? 'PLAYLIST' : 'MEDIA'}
                  </Text>
                </View>
                <Text style={styles.scanCardCount}>
                  {scan.count} {scan.count === 1 ? 'ITEM' : 'ITEMS'}
                </Text>
              </View>

              <View style={styles.scanCardBody}>
                {scan.thumbnail ? (
                  <View style={styles.thumbnailFrame}>
                    <Image source={{ uri: scan.thumbnail }} style={styles.scanThumbnail} resizeMode="cover" />
                  </View>
                ) : (
                  <View style={[styles.thumbnailFrame, styles.thumbnailPlaceholder]}>
                    <Text style={styles.thumbnailPlaceholderText}>[NO PREV]</Text>
                  </View>
                )}
                <View style={styles.scanCardDetails}>
                  <Text style={styles.scanTitle} numberOfLines={2}>{scan.title}</Text>
                  <Text style={styles.scanSubtitle}>
                    {isImage
                      ? `${scan.count} image(s) found`
                      : scan.isSpotify
                      ? 'Spotify audio track'
                      : scan.isProxy
                      ? 'X/Twitter Direct Stream'
                      : 'Universal extractor source'}
                  </Text>
                </View>
              </View>

              {/* Batch selection controls for multi-item */}
              {scan.count > 1 && (
                <View style={styles.batchControlsBar}>
                  <Text style={styles.batchLabel}>
                    SELECTED: {picked.length}/{scan.count}
                  </Text>
                  <View style={styles.batchBtnGroup}>
                    <TouchableOpacity
                      style={styles.batchBtn}
                      onPress={selectAllEntries}
                      disabled={isLoading}
                    >
                      <Text style={styles.batchBtnText}>[ALL]</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.batchBtn}
                      onPress={deselectAllEntries}
                      disabled={isLoading}
                    >
                      <Text style={styles.batchBtnText}>[NONE]</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.batchBtn}
                      onPress={invertSelection}
                      disabled={isLoading}
                    >
                      <Text style={styles.batchBtnText}>[INVERT]</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Format Selection (Video vs Audio) */}
          {mediaType === 'video' && (
            <SelectionRow
              title="FORMAT"
              selected={format}
              onSelect={setFormat}
              options={[
                { label: 'MP4', value: 'mp4' },
                { label: 'MP3', value: 'mp3' },
              ]}
            />
          )}

          {/* Quality Selection */}
          {mediaType === 'video' && (
            <SelectionRow
              title="QUALITY"
              selected={quality}
              onSelect={setQuality}
              options={[
                { label: 'MAX', value: 'high' },
                { label: 'MID', value: 'medium' },
                { label: 'LOW', value: 'low' },
              ]}
            />
          )}

          {/* Multi-Item / Playlist / Carousel Picker Box */}
          {mediaType && scan && (mediaType === 'image' || scan.count > 1) && (
            <View style={styles.pickerBox}>
              <View style={styles.pickerBoxHeader}>
                <Text style={styles.rowLabel}>
                  {isImage ? 'IMAGES' : (scan.isSpotify ? 'TRACKS' : 'ITEMS')}
                </Text>
                <Text style={styles.autoNote}>
                  {`> ${picked.length}/${scan.count} selected`}
                </Text>
              </View>
              
              {scan.entries.map(entry => {
                const chosen = picked.includes(entry.index);
                const variant = variantOf[entry.index] || 0;
                const current = isImage ? (entry.variants[variant] || entry.variants[0]) : null;
                const durationText = formatDuration(entry.duration);
                
                return (
                  <View key={entry.index} style={[styles.entryBlock, chosen && styles.entryBlockChosen]}>
                    <TouchableOpacity
                      style={styles.entryRow}
                      onPress={() => toggleEntry(entry.index)}
                      disabled={isLoading}
                    >
                      <Text style={[styles.entryFlag, chosen && styles.entryFlagOn]}>
                        {chosen ? '[x]' : '[ ]'}
                      </Text>
                      <Text style={styles.entryIndex}>
                        {isImage
                          ? `[${entry.index}]`
                          : (scan.isSpotify ? `TRACK ${String(entry.index).padStart(2, '0')}` : `ITEM ${String(entry.index).padStart(2, '0')}`)}
                      </Text>
                      <Text style={[styles.entryMeta, !chosen && styles.entryMetaOff]} numberOfLines={1}>
                        {isImage 
                          ? `${dims(current)} ${String(current.ext).toUpperCase()}`
                          : entry.title + (durationText ? ` // ${durationText}` : '')}
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

          {/* Output Destination Folder */}
          {mediaType && (
            <SelectionRow
              title="OUTPUT"
              selected={folder}
              onSelect={setFolder}
              options={[
                { label: 'PICTURES', value: 'Pictures' },
                { label: 'MOVIES', value: 'Movies' },
                { label: 'MUSIC', value: 'Music' },
                { label: 'DOWNLOADS', value: 'Downloads' }
              ]}
            />
          )}

          {/* Primary Action Buttons */}
          {mediaType && (
            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                style={[styles.buttonPrimary, isLoading && styles.buttonDisabled]}
                onPress={() => handleSave(true)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={THEME.white} size="small" />
                ) : (
                  <Text style={styles.buttonPrimaryText}>
                    {scan.count > 1 ? `[YOINK NOW] (${picked.length})` : '[YOINK NOW]'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.buttonSecondary, isLoading && styles.buttonDisabled]}
                onPress={() => handleSave(false)}
                disabled={isLoading}
              >
                <Text style={styles.buttonSecondaryText}>
                  {scan.count > 1 ? `+ ADD TO QUEUE (${picked.length})` : '+ ADD TO QUEUE'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Terminal Console Log Box */}
          <View style={styles.consoleBox}>
            <View style={styles.consoleHeader}>
              <Text style={styles.consoleTitle}>{"// SYSTEM_LOG [" + (status ? 'ACTIVE' : 'READY') + "]"}</Text>
              <Text style={styles.consoleCursor}>{cursor ? '█' : ' '}</Text>
            </View>
            <View style={styles.consoleBody}>
              {logHistory.map((item) => (
                <View key={item.id} style={styles.logLineRow}>
                  <Text style={styles.logTime}>{item.time} &gt;</Text>
                  <Text style={styles.logMsg} numberOfLines={2}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Interactive Queue Section */}
          {queue.length > 0 && (
            <View style={styles.queueBox}>
              <View style={styles.queueHeaderRow}>
                <Text style={styles.queueHeader}>
                  QUEUE ({pendingQueueCount} PENDING · {queue.length} TOTAL)
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('light');
                    setQueue(q => q.filter(j => j.status !== 'done' && j.status !== 'error'));
                  }}
                >
                  <Text style={styles.clearText}>[CLEAR DONE]</Text>
                </TouchableOpacity>
              </View>

              {/* Prominent Yoink All execution button */}
              {pendingQueueCount > 0 && !isQueueRunning && (
                <TouchableOpacity
                  style={styles.yoinkAllBar}
                  onPress={() => {
                    triggerHaptic('heavy');
                    setIsQueueRunning(true);
                  }}
                >
                  <Text style={styles.yoinkAllBarText}>
                    START EXTRACTION ({pendingQueueCount} READY)
                  </Text>
                </TouchableOpacity>
              )}

              {isQueueRunning && (
                <View style={styles.queueRunningBar}>
                  <ActivityIndicator size="small" color={THEME.ink} />
                  <Text style={styles.queueRunningBarText}> EXTRACTION IN PROGRESS...</Text>
                </View>
              )}

              {/* Queue Items */}
              {queue.map(job => {
                const isDown = job.status === 'downloading';
                const isFail = job.status === 'error';
                const isDone = job.status === 'done';
                const isWait = job.status === 'pending';

                return (
                  <View key={job.id} style={[styles.jobRow, isDown && styles.jobRowActive]}>
                    <View style={styles.jobTopRow}>
                      <View style={[
                        styles.jobStatusTag,
                        isDown && styles.jobStatusTagDown,
                        isDone && styles.jobStatusTagDone,
                        isFail && styles.jobStatusTagFail,
                      ]}>
                        <Text style={[
                          styles.jobStatusText,
                          isDown && styles.jobStatusTextDown,
                          isDone && styles.jobStatusTextDone,
                          isFail && styles.jobStatusTextFail,
                        ]}>
                          {isWait ? '[WAIT]' : isDown ? '[DOWN]' : isDone ? '[DONE]' : '[FAIL]'}
                        </Text>
                      </View>

                      <Text style={styles.jobTitle} numberOfLines={1}>
                        {job.title}
                      </Text>

                      {/* Job Controls */}
                      <View style={styles.jobActionsRow}>
                        {isFail && (
                          <TouchableOpacity
                            onPress={() => retryQueueJob(job.id)}
                            style={styles.jobActionBtn}
                          >
                            <Text style={styles.jobRetryText}>[RETRY]</Text>
                          </TouchableOpacity>
                        )}
                        {!isDown && (
                          <TouchableOpacity
                            onPress={() => removeQueueJob(job.id)}
                            style={styles.jobActionBtn}
                          >
                            <Text style={styles.jobRemoveText}>[×]</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Live Progress Bar for Downloading */}
                    {isDown && (
                      <View style={styles.progressContainer}>
                        <Text style={styles.asciiProgressBar}>
                          [{renderAsciiBar(job.progress)}] {job.progress.toFixed(1)}% {job.eta > 0 ? `(ETA: ${job.eta}s)` : ''}
                        </Text>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(0, job.progress))}%` }]} />
                        </View>
                      </View>
                    )}

                    {/* Error detail */}
                    {isFail && (
                      <Text style={styles.jobError} numberOfLines={2}>
                        &gt; {job.error}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Footer Disclaimer */}
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              {"// DISCLAIMER: This application is heavily inspired by, based on, and acts as a mobile plagiarism of the 'yoinks' CLI from GitHub (github.com/pablostanley/yoinks). All credit for the original concept goes to its creator."}
            </Text>
          </View>
        </>}

        {/* Tab 2: HISTORY */}
        {activeTab === 'history' && (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>YOINK HISTORY ({history.length})</Text>
              {history.length > 0 && (
                <TouchableOpacity onPress={clearHistory}>
                  <Text style={styles.clearText}>[CLEAR ALL]</Text>
                </TouchableOpacity>
              )}
            </View>

            {history.length === 0 ? (
              <Text style={styles.emptyText}>&gt; no completed downloads yet.</Text>
            ) : history.map(item => (
              <View key={item.id} style={styles.historyRow}>
                {item.thumbnail ? (
                  <Image source={{ uri: item.thumbnail }} style={styles.historyThumbnail} resizeMode="cover" />
                ) : (
                  <View style={[styles.historyThumbnail, styles.thumbnailPlaceholder]}>
                    <Text style={styles.thumbnailPlaceholderText}>[RAW]</Text>
                  </View>
                )}
                <View style={styles.historyContent}>
                  <Text style={styles.historyTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.historyMeta}>
                    {`${item.type.toUpperCase()} // ${new Date(item.completedAt).toLocaleString()}`}
                  </Text>
                  <Text style={styles.historyUrl} numberOfLines={1}>{item.sourceUrl}</Text>
                  
                  {/* Re-Yoink Quick Action */}
                  <TouchableOpacity
                    style={styles.reYoinkBtn}
                    onPress={() => reYoink(item)}
                  >
                    <Text style={styles.reYoinkBtnText}>[RE-YOINK]</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Tab 3: SETTINGS */}
        {activeTab === 'settings' && (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>CONFIGURATION</Text>
            </View>

            {/* Service Status Overview */}
            <View style={styles.statusOverviewBox}>
              <Text style={styles.statusOverviewTitle}>INTEGRATIONS STATUS:</Text>
              <View style={styles.statusOverviewRow}>
                <Text style={styles.statusOverviewLabel}>X/TWITTER PROXY:</Text>
                <Text style={[styles.statusOverviewVal, settings.proxyUrl ? styles.statusValOk : styles.statusValOff]}>
                  {settings.proxyUrl ? '[CONFIGURED]' : '[NOT SET]'}
                </Text>
              </View>
              <View style={styles.statusOverviewRow}>
                <Text style={styles.statusOverviewLabel}>SPOTIFY API:</Text>
                <Text style={[styles.statusOverviewVal, settings.spotifyClientId ? styles.statusValOk : styles.statusValOff]}>
                  {settings.spotifyClientId ? '[CONFIGURED]' : '[NOT SET]'}
                </Text>
              </View>
              <View style={styles.statusOverviewRow}>
                <Text style={styles.statusOverviewLabel}>COOKIES:</Text>
                <Text style={[styles.statusOverviewVal, settings.cookiesText.trim() ? styles.statusValOk : styles.statusValOff]}>
                  {settings.cookiesText.trim() ? '[LOADED]' : '[NONE]'}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionHeader}>X / TWITTER AUTH</Text>
            <SelectionRow
              title="EXTRACTION SOURCE"
              selected={settings.xMode}
              onSelect={value => updateSetting('xMode', value)}
              options={[
                { label: 'API PROXY', value: 'proxy' },
                { label: 'COOKIES', value: 'cookies' },
              ]}
            />

            {settings.xMode === 'proxy' ? <>
              <Text style={styles.rowLabel}>PROXY URL</Text>
              <TextInput
                style={styles.settingsInput}
                value={settings.proxyUrl}
                onChangeText={value => updateSetting('proxyUrl', value)}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://worker.example.workers.dev"
                placeholderTextColor="#84A9CB"
              />
              <Text style={styles.rowLabel}>PROXY API KEY</Text>
              <TextInput
                style={styles.settingsInput}
                value={settings.proxyKey}
                onChangeText={value => updateSetting('proxyKey', value)}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                placeholder="x-api-key"
                placeholderTextColor="#84A9CB"
              />
            </> : <>
              <Text style={styles.rowLabel}>NETSCAPE COOKIES.TXT</Text>
              <TextInput
                style={[styles.settingsInput, styles.cookiesInput]}
                value={settings.cookiesText}
                onChangeText={value => updateSetting('cookiesText', value)}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                textAlignVertical="top"
                placeholder="# Netscape HTTP Cookie File"
                placeholderTextColor="#84A9CB"
              />
              <Text style={styles.helpText}>{"Paste the complete cookies.txt content. Stored in private app sandbox."}</Text>
            </>}

            <Text style={styles.sectionHeader}>SPOTIFY CREDENTIALS</Text>
            <Text style={styles.rowLabel}>CLIENT ID</Text>
            <TextInput
              style={styles.settingsInput}
              value={settings.spotifyClientId}
              onChangeText={value => updateSetting('spotifyClientId', value)}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Spotify client ID"
              placeholderTextColor="#84A9CB"
            />
            <Text style={styles.rowLabel}>CLIENT SECRET</Text>
            <TextInput
              style={styles.settingsInput}
              value={settings.spotifyClientSecret}
              onChangeText={value => updateSetting('spotifyClientSecret', value)}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder="Spotify client secret"
              placeholderTextColor={THEME.steelBlueDeep}
            />

            <TouchableOpacity style={styles.buttonPrimary} onPress={saveSettings}>
              <Text style={styles.buttonPrimaryText}>SAVE CONFIGURATION</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.ink },
  scroll: { flexGrow: 1, padding: 22, justifyContent: 'center' },
  header: { marginBottom: 20 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 44, fontWeight: '900', color: THEME.white, letterSpacing: -1.5 },
  headerBadge: {
    marginLeft: 12,
    backgroundColor: THEME.brickRed,
    borderWidth: 2,
    borderColor: THEME.paper,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerBadgeText: { color: THEME.white, fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  subtitle: { fontSize: 12, color: THEME.steelBlue, marginTop: 4, fontFamily: 'monospace', letterSpacing: 1.5, fontWeight: '700' },
  
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: THEME.steelBlueDeep,
    backgroundColor: THEME.navy,
  },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: THEME.navy },
  tabButtonActive: { backgroundColor: THEME.brickRed, borderBottomWidth: 3, borderBottomColor: THEME.paper },
  tabText: { color: THEME.steelBlue, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 1 },
  tabTextActive: { color: THEME.white, fontWeight: '900' },

  // Input Card
  inputCard: {
    borderWidth: 2,
    borderColor: THEME.steelBlueDeep,
    backgroundColor: THEME.navy,
    padding: 14,
    marginBottom: 16,
    borderBottomWidth: 4,
    borderBottomColor: THEME.moltenLava,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputPrefix: { color: THEME.brickRed, fontFamily: 'monospace', fontSize: 20, fontWeight: '900', marginRight: 10 },
  input: { flex: 1, backgroundColor: THEME.navy, color: THEME.white, fontFamily: 'monospace', fontSize: 15, paddingVertical: 8 },
  clearInputBtn: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  clearInputText: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold' },
  inputActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.steelBlueDeep,
  },
  scanActionBtn: {
    backgroundColor: THEME.brickRed,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.paper,
  },
  scanActionBtnDisabled: { backgroundColor: THEME.disabled, borderColor: THEME.steelBlueDeep },
  scanActionBtnText: { color: THEME.white, fontFamily: 'monospace', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  actionBtnContent: { flexDirection: 'row', alignItems: 'center' },
  platformBadge: { borderWidth: 1, borderColor: THEME.steelBlue, backgroundColor: THEME.navyDeep, paddingHorizontal: 8, paddingVertical: 4 },
  platformBadgeText: { color: THEME.paper, fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' },

  // Supported Sources
  supportedRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  supportedLabel: { color: THEME.steelBlueDeep, fontFamily: 'monospace', fontSize: 10, marginRight: 4, fontWeight: 'bold' },
  supportedTag: { borderWidth: 1, borderColor: THEME.steelBlueDeep, backgroundColor: THEME.navy, paddingHorizontal: 7, paddingVertical: 3 },
  supportedTagText: { color: THEME.paper, fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold' },

  // Scan Meta Card
  scanMetaCard: {
    borderWidth: 2,
    borderColor: THEME.steelBlue,
    backgroundColor: THEME.navy,
    padding: 14,
    marginBottom: 20,
    borderBottomWidth: 4,
    borderBottomColor: THEME.moltenLava,
  },
  scanCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  scanCardBadge: { backgroundColor: THEME.paper, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: THEME.ink },
  scanCardBadgeText: { color: THEME.ink, fontFamily: 'monospace', fontSize: 10, fontWeight: '900' },
  scanCardCount: { color: THEME.paper, fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold' },
  scanCardBody: { flexDirection: 'row', alignItems: 'center' },
  thumbnailFrame: { width: 72, height: 72, borderWidth: 2, borderColor: THEME.paper, marginRight: 14, backgroundColor: THEME.navyDeep },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  thumbnailPlaceholderText: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 10 },
  scanThumbnail: { width: '100%', height: '100%' },
  scanCardDetails: { flex: 1 },
  scanTitle: { color: THEME.white, fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold' },
  scanSubtitle: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 11, marginTop: 4 },
  batchControlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.steelBlueDeep,
  },
  batchLabel: { color: THEME.paper, fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold' },
  batchBtnGroup: { flexDirection: 'row', gap: 8 },
  batchBtn: { borderWidth: 1, borderColor: THEME.steelBlue, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: THEME.navyDeep },
  batchBtnText: { color: THEME.paper, fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' },

  // Selection Rows
  rowContainer: { marginBottom: 16 },
  rowLabel: { color: THEME.paper, fontSize: 12, marginBottom: 8, fontFamily: 'monospace', letterSpacing: 1.2, fontWeight: 'bold' },
  buttonGroup: { flexDirection: 'row', gap: 8 },
  optButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: THEME.navy,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.steelBlueDeep,
  },
  optButtonSelected: { backgroundColor: THEME.paper, borderColor: THEME.paper },
  optText: { color: THEME.steelBlue, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' },
  optTextSelected: { color: THEME.ink, fontWeight: '900' },

  // Picker Box (Playlists / Carousels)
  pickerBox: {
    borderWidth: 2,
    borderColor: THEME.steelBlueDeep,
    padding: 12,
    marginBottom: 20,
    backgroundColor: THEME.navy,
  },
  pickerBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  autoNote: { color: THEME.steelBlue, fontSize: 12, fontFamily: 'monospace', letterSpacing: 1 },
  entryBlock: {
    marginBottom: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: THEME.steelBlueDeep,
    backgroundColor: THEME.navyDeep,
  },
  entryBlockChosen: { borderColor: THEME.brickRed, backgroundColor: '#00263d' },
  entryRow: { flexDirection: 'row', alignItems: 'center' },
  entryFlag: { color: THEME.steelBlueDeep, fontSize: 14, fontFamily: 'monospace', marginRight: 10 },
  entryFlagOn: { color: THEME.brickRed, fontWeight: 'bold' },
  entryIndex: { color: THEME.paper, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold', marginRight: 10 },
  entryMeta: { color: THEME.white, fontSize: 12, fontFamily: 'monospace', flex: 1 },
  entryMetaOff: { color: THEME.steelBlueDeep },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 24 },
  variantChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: THEME.navyDeep,
    borderWidth: 1,
    borderColor: THEME.steelBlueDeep,
  },
  variantChipOn: { backgroundColor: THEME.paper, borderColor: THEME.paper },
  variantText: { color: THEME.steelBlue, fontSize: 10, fontFamily: 'monospace' },
  variantTextOn: { color: THEME.ink, fontWeight: 'bold' },

  // Primary Action Buttons
  actionButtonGroup: { marginTop: 10, marginBottom: 20, gap: 10 },
  buttonPrimary: {
    backgroundColor: THEME.brickRed,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: THEME.moltenLava,
  },
  buttonPrimaryText: { color: THEME.white, fontSize: 15, fontFamily: 'monospace', fontWeight: '900', letterSpacing: 2 },
  buttonSecondary: {
    borderWidth: 2,
    borderColor: THEME.steelBlue,
    backgroundColor: THEME.navy,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonSecondaryText: { color: THEME.steelBlue, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 1 },
  buttonDisabled: { backgroundColor: THEME.disabled, borderColor: THEME.steelBlueDeep },

  // Terminal Console
  consoleBox: {
    marginTop: 16,
    backgroundColor: THEME.navyDeep,
    padding: 14,
    borderWidth: 2,
    borderColor: THEME.steelBlueDeep,
  },
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.steelBlueDeep,
    paddingBottom: 6,
  },
  consoleTitle: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  consoleCursor: { color: THEME.brickRed, fontFamily: 'monospace', fontSize: 13 },
  consoleBody: { gap: 4 },
  logLineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  logTime: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 11, marginRight: 6 },
  logMsg: { color: THEME.paper, fontFamily: 'monospace', fontSize: 11, flex: 1, lineHeight: 16 },

  // Interactive Queue
  queueBox: {
    marginTop: 24,
    borderWidth: 2,
    borderColor: THEME.steelBlueDeep,
    padding: 14,
    backgroundColor: THEME.navy,
  },
  queueHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  queueHeader: { color: THEME.paper, fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
  clearText: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold' },
  yoinkAllBar: {
    backgroundColor: THEME.brickRed,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: THEME.moltenLava,
  },
  yoinkAllBarText: { color: THEME.white, fontFamily: 'monospace', fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  queueRunningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: THEME.paper,
    marginBottom: 12,
  },
  queueRunningBarText: { color: THEME.ink, fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' },
  jobRow: {
    borderWidth: 1,
    borderColor: THEME.steelBlueDeep,
    padding: 10,
    marginBottom: 8,
    backgroundColor: THEME.navyDeep,
  },
  jobRowActive: { borderColor: THEME.brickRed, backgroundColor: '#00263d' },
  jobTopRow: { flexDirection: 'row', alignItems: 'center' },
  jobStatusTag: { borderWidth: 1, borderColor: THEME.steelBlueDeep, paddingHorizontal: 5, paddingVertical: 2, marginRight: 8 },
  jobStatusTagDown: { backgroundColor: THEME.brickRed, borderColor: THEME.brickRed },
  jobStatusTagDone: { borderColor: THEME.success, backgroundColor: 'transparent' },
  jobStatusTagFail: { borderColor: THEME.error, backgroundColor: 'transparent' },
  jobStatusText: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' },
  jobStatusTextDown: { color: THEME.white },
  jobStatusTextDone: { color: THEME.success },
  jobStatusTextFail: { color: THEME.error },
  jobTitle: { color: THEME.white, fontFamily: 'monospace', fontSize: 12, flex: 1 },
  jobActionsRow: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  jobActionBtn: { padding: 4 },
  jobRetryText: { color: THEME.paper, fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' },
  jobRemoveText: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' },
  progressContainer: { marginTop: 8 },
  asciiProgressBar: { color: THEME.paper, fontFamily: 'monospace', fontSize: 11, marginBottom: 4 },
  progressTrack: {
    height: 5,
    backgroundColor: THEME.navyDeep,
    borderWidth: 1,
    borderColor: THEME.steelBlueDeep,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: THEME.brickRed },
  jobError: { color: THEME.error, fontFamily: 'monospace', fontSize: 10, marginTop: 4 },

  // Panel (History & Settings)
  panel: { borderWidth: 2, borderColor: THEME.steelBlueDeep, padding: 16, backgroundColor: THEME.navy },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  panelTitle: { color: THEME.paper, fontFamily: 'monospace', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  emptyText: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 13 },
  historyRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.steelBlueDeep },
  historyThumbnail: { width: 56, height: 56, marginRight: 12, borderWidth: 1, borderColor: THEME.steelBlueDeep, backgroundColor: THEME.navyDeep },
  historyContent: { flex: 1 },
  historyTitle: { color: THEME.white, fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold' },
  historyMeta: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 10, marginTop: 4 },
  historyUrl: { color: THEME.steelBlueDeep, fontFamily: 'monospace', fontSize: 10, marginTop: 3 },
  reYoinkBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.steelBlue,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: THEME.navyDeep,
  },
  reYoinkBtnText: { color: THEME.paper, fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' },

  // Settings
  statusOverviewBox: { borderWidth: 2, borderColor: THEME.steelBlueDeep, padding: 12, marginBottom: 20, backgroundColor: THEME.navyDeep },
  statusOverviewTitle: { color: THEME.paper, fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', marginBottom: 8 },
  statusOverviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statusOverviewLabel: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 11 },
  statusOverviewVal: { fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold' },
  statusValOk: { color: THEME.success },
  statusValOff: { color: THEME.steelBlueDeep },
  sectionHeader: { color: THEME.paper, fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginTop: 12, marginBottom: 12 },
  settingsInput: { color: THEME.white, borderWidth: 1, borderColor: THEME.steelBlueDeep, backgroundColor: THEME.navyDeep, fontFamily: 'monospace', fontSize: 13, padding: 12, marginBottom: 16 },
  cookiesInput: { minHeight: 140 },
  helpText: { color: THEME.steelBlue, fontFamily: 'monospace', fontSize: 10, lineHeight: 15, marginTop: -8, marginBottom: 20 },

  // Disclaimer
  disclaimerBox: { marginTop: 36, borderTopWidth: 1, borderTopColor: THEME.steelBlueDeep, paddingTop: 16 },
  disclaimerText: { color: THEME.steelBlueDeep, fontFamily: 'monospace', fontSize: 10, lineHeight: 14, textAlign: 'justify' }
});
