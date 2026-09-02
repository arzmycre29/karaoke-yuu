import type { LyricLine, LyricWord } from '../types/karaoke';

/**
 * Parses timestamp string like [01:23.45] or <01:23.45> into seconds
 */
export function parseTimestamp(timeStr: string): number {
  const match = timeStr.match(/\[?<?(\d{2}):(\d{2})(?:\.(\d{2,3}))?>?\]?/);
  if (!match) return 0;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const millis = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
  return minutes * 60 + seconds + millis / 1000;
}

/**
 * Formats seconds into [mm:ss.xx]
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
}

/**
 * Parse standard LRC or Enhanced LRC into structured LyricLine[]
 */
export function parseLRC(lrcContent: string): LyricLine[] {
  if (!lrcContent) return [];
  const lines = lrcContent.split('\n');
  const result: LyricLine[] = [];

  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  const syllableRegex = /<(\d{2}):(\d{2})(?:\.(\d{2,3}))?>([^<]*)/g;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Skip metadata tags like [ti:Title], [ar:Artist]
    if (/^\[(ti|ar|al|au|by|offset|length):/i.test(rawLine)) {
      continue;
    }

    const matches = [...rawLine.matchAll(timeRegex)];
    if (matches.length > 0) {
      const textPart = rawLine.replace(timeRegex, '').trim();

      // Check for Enhanced LRC syllable timestamps
      const words: LyricWord[] = [];
      const sylMatches = [...textPart.matchAll(syllableRegex)];

      if (sylMatches.length > 0) {
        for (let j = 0; j < sylMatches.length; j++) {
          const sylTime = parseTimestamp(sylMatches[j][0]);
          const sylText = sylMatches[j][4];
          const nextSyl = sylMatches[j + 1];
          const nextTime = nextSyl ? parseTimestamp(nextSyl[0]) : sylTime + 0.5;

          words.push({
            text: sylText,
            startTime: sylTime,
            endTime: nextTime
          });
        }
      }

      for (const m of matches) {
        const startTime = parseTimestamp(m[0]);
        // Clean text from syllable tags for clean display if enhanced
        const cleanText = textPart.replace(/<\d{2}:\d{2}(?:\.\d{2,3})?>/g, '').trim();

        // Check if text has romaji/kanji separator e.g. "前前前世 | Zenzenzense"
        let mainText = cleanText;
        let romaji: string | undefined = undefined;

        if (cleanText.includes(' | ')) {
          const parts = cleanText.split(' | ');
          mainText = parts[0].trim();
          romaji = parts[1].trim();
        }

        result.push({
          id: `line-${i}-${startTime}`,
          startTime,
          endTime: startTime + 4,
          text: mainText,
          romaji,
          words: words.length > 0 ? words : undefined
        });
      }
    }
  }

  // Sort by startTime
  result.sort((a, b) => a.startTime - b.startTime);

  // Refine end times based on next line's start time
  for (let i = 0; i < result.length; i++) {
    if (i < result.length - 1) {
      const nextStart = result[i + 1].startTime;
      result[i].endTime = Math.min(result[i].startTime + 8, nextStart);
    } else {
      result[i].endTime = result[i].startTime + 5;
    }
  }

  return result;
}

/**
 * Formats seconds into <mm:ss.xx> (Enhanced LRC Syllable Tag)
 */
export function formatSyllableTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `<${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}>`;
}

/**
 * Tokenizes a line into an array of LyricWord units.
 * Supports spaced words, Romaji, and non-spaced CJK characters.
 */
export function tokenizeLine(
  text: string,
  startTime: number,
  endTime: number,
  _romaji?: string
): LyricWord[] {
  const cleanText = text.trim();
  if (!cleanText) return [];

  let tokens: string[] = [];

  // Check if text has spaces
  if (cleanText.includes(' ')) {
    tokens = cleanText.split(/\s+/).filter(t => t.length > 0);
  } else {
    // If no spaces, tokenize Japanese/Kanji characters or mora
    tokens = Array.from(cleanText);
  }

  if (tokens.length === 0) return [];

  const lineDuration = Math.max(0.5, endTime - startTime);
  const wordDuration = lineDuration / tokens.length;

  return tokens.map((token, idx) => {
    const wStart = parseFloat((startTime + idx * wordDuration).toFixed(2));
    const wEnd = parseFloat((startTime + (idx + 1) * wordDuration).toFixed(2));
    return {
      text: token,
      startTime: wStart,
      endTime: wEnd
    };
  });
}

/**
 * Applies rhythmic pacing curve presets to word timestamps within a line.
 */
export type TimingPresetType = 'linear' | 'hold_ending' | 'accelerate' | 'decelerate' | 'weighted';

export function applyTimingPreset(
  words: LyricWord[],
  lineStartTime: number,
  lineEndTime: number,
  preset: TimingPresetType
): LyricWord[] {
  if (!words || words.length === 0) return [];
  if (words.length === 1) {
    return [{
      ...words[0],
      startTime: parseFloat(lineStartTime.toFixed(2)),
      endTime: parseFloat(lineEndTime.toFixed(2))
    }];
  }

  const n = words.length;
  const totalDuration = Math.max(0.4, lineEndTime - lineStartTime);
  let weights: number[] = [];

  switch (preset) {
    case 'hold_ending': {
      // First (n - 1) words share 50% of the time, the last word takes 50% (melisma / held note)
      const baseWeight = 0.5 / (n - 1);
      weights = words.map((_, i) => (i === n - 1 ? 0.5 : baseWeight));
      break;
    }
    case 'accelerate': {
      // Starts slow (large duration), speeds up towards end
      weights = words.map((_, i) => n - i);
      const sum = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / sum);
      break;
    }
    case 'decelerate': {
      // Starts fast, gets slower towards end
      weights = words.map((_, i) => i + 1);
      const sum = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / sum);
      break;
    }
    case 'weighted': {
      // Weighted according to text character length
      weights = words.map(w => Math.max(1, w.text.length));
      const sum = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / sum);
      break;
    }
    case 'linear':
    default: {
      weights = words.map(() => 1 / n);
      break;
    }
  }

  let accumulatedTime = lineStartTime;
  return words.map((word, idx) => {
    const duration = totalDuration * weights[idx];
    const wStart = parseFloat(accumulatedTime.toFixed(2));
    accumulatedTime += duration;
    const wEnd = idx === n - 1 ? parseFloat(lineEndTime.toFixed(2)) : parseFloat(accumulatedTime.toFixed(2));

    return {
      ...word,
      startTime: wStart,
      endTime: Math.max(wStart + 0.05, wEnd)
    };
  });
}

/**
 * Converts structured LyricLine[] back to LRC / Enhanced LRC formatted string
 */
export function exportToLRC(lyrics: LyricLine[]): string {
  return lyrics
    .map(line => {
      const timeStr = formatTimestamp(line.startTime);

      // If enhanced syllable words exist, serialize with <mm:ss.xx> tags
      if (line.words && line.words.length > 0) {
        const syllableText = line.words
          .map(w => `${formatSyllableTimestamp(w.startTime)}${w.text}`)
          .join(' ');
        const text = line.romaji ? `${syllableText} | ${line.romaji}` : syllableText;
        return `${timeStr} ${text}`;
      }

      const text = line.romaji ? `${line.text} | ${line.romaji}` : line.text;
      return `${timeStr} ${text}`;
    })
    .join('\n');
}

/**
 * Preloaded Sample Anime Songs (J-Pop / Vocaloid / Anime Openings)
 */
export const SAMPLE_ANIME_SONGS = [
  {
    id: 'sample-radwimps-zenzenzense',
    title: 'Zenzenzense (前前前世)',
    artist: 'RADWIMPS',
    animeTitle: 'Kimi no Na wa (Your Name)',
    source: 'youtube' as const,
    youtubeId: 'PDSkFeMVNFs',
    duration: 285,
    coverArt: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&q=80',
    rawLyrics: `[00:15.50] やっと目を覚ましたかい | Yatto me wo samashita kai
[00:19.20] それなのになぜ目も合わせはしないんだい？ | Sorenano ni naze me mo awase wa shinai ndai?
[00:23.60] 「遅いよ」と怒る君 | "Osoi yo" to okoru kimi
[00:27.40] これでもやれるだけ飛ばしてきたんだよ | Koredemo yareru dake tobashite kitanda yo
[00:31.90] 心が身体を追い越してきたんだよ | Kokoro ga karada wo oikoshite kitanda yo
[00:39.50] 前前前世から僕は 君を探し始めたよ | Zenzenzense kara boku wa kimi wo sagashi hajimeta yo
[00:47.30] そのぶきっちょな笑い方をめがけて やってきたんだよ | Sono bukiccho na waraikata wo megakete yatte kitanda yo
[00:55.10] 君が全然全部なくなって チリヂリになったって | Kimi ga zenzen zenbu nakunatte chirijiri ni nattatte
[01:03.00] もう迷わない また１から探し始めるさ | Mou mayowanai mata ichi kara sagashi hajimeru sa
[01:10.80] むしろ０から また宇宙を始めてみようか | Mushiro zero kara mata uchuu wo hajimete miyou ka`
  },
  {
    id: 'sample-lisa-gurenge',
    title: 'Gurenge (紅蓮華)',
    artist: 'LiSA',
    animeTitle: 'Demon Slayer (Kimetsu no Yaiba)',
    source: 'youtube' as const,
    youtubeId: 'CwkzK-Fh408',
    duration: 240,
    coverArt: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80',
    rawLyrics: `[00:00.80] 強くなれる理由を知った 僕を連れて進め | Tsuyoku nareru riyuu wo shitta boku wo tsurete susume
[00:16.20] 泥だらけの走馬灯に酔う こわばる心 | Doro darake no soumatou ni you kowabaru kokoro
[00:23.00] 震える手は掴みたいものがある それだけさ | Furueru te wa tsukamitai mono ga aru sore dake sa
[00:29.80] 夜の匂いに空睨んでも | Yoru no nioi ni sora nirandemo
[00:36.50] 変わっていけるのは自分自身だけ それだけさ | Kawatte ikeru no wa jibun jishin dake sore dake sa
[00:43.50] どうしたって！消せない夢も 止まれない今も | Doushitatte! Kesenai yume mo tomarenai ima mo
[00:50.20] 誰かのために強くなれるなら ありがとう 悲しみよ | Dareka no tame ni tsuyoku nareru nara arigatou kanashimi yo
[00:57.10] 世界に打ちのめされて負ける意味を知った | Sekai ni uchinomesarete makeru imi wo shitta
[01:03.90] 紅蓮の華よ咲き誇れ！運命を照らして | Guren no hana yo sakihokore! Unmei wo terashite`
  },
  {
    id: 'sample-yoasobi-idol',
    title: 'Idol (アイドル)',
    artist: 'YOASOBI',
    animeTitle: 'Oshi no Ko',
    source: 'youtube' as const,
    youtubeId: 'RzXTe-QfWTg',
    duration: 215,
    coverArt: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80',
    rawLyrics: `[00:00.00] 無敵の笑顔で荒らすメディア | Muteki no egao de arasu media
[00:03.20] 知りたいその秘密ミステリアス | Shiritai sono himitsu misuteriasu
[00:06.50] 抜けてるとこさえ彼女のエリア | Nuketeru toko sae kanojo no eria
[00:09.80] 完璧で嘘つきな君は | Kanpeki de usotsuki na kimi wa
[00:13.20] 天才的なアイドル様 | Tensaiteki na aidoru-sama
[00:25.50] 今日何食べた？好きな本は？ | Kyou nani tabeta? Suki na hon wa?
[00:28.50] 遊びに行くならどこに行くの？ | Asobi ni iku nara doko ni iku no?
[00:31.90] 何も食べてない それは内緒 | Nanimo tabetenai sore wa naisho
[00:35.20] 何を聞かれてものらりくらり | Nani wo kikarete mo norarikurari
[00:48.80] 誰もが目を奪われていく 君は完璧で究極のアイドル | Daremo ga me wo ubawarete iku kimi wa kanpeki de kyuukyoku no aidoru
[00:55.50] 金輪際現れない 一番星の生まれ変わり | Konrinzai arawarenai ichibanboshi no umarekawari`
  },
  {
    id: 'sample-vocaloid-senbonzakura',
    title: 'Senbonzakura (千本桜)',
    artist: 'Kurousa-P feat. Hatsune Miku',
    animeTitle: 'Vocaloid Classic',
    source: 'youtube' as const,
    youtubeId: 'shs0rAiwsGQ',
    duration: 245,
    coverArt: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?w=300&q=80',
    rawLyrics: `[00:13.50] 大胆不敵にハイカラ革命 | Daitanfuteki ni haikara kakumei
[00:16.80] 磊々落々 反戦国家 | Rairairakuraku hansen kokka
[00:20.10] 日の丸印の二輪車転がし | Hinomaru jirushi no nirinsha korogashi
[00:23.50] 悪霊退散 ICBM | Akuryou taisan ICBM
[00:26.90] 環状線を走り抜けて 東奔西走なんのその | Kanjousen wo hashirinukete touhonseisou nan no sono
[00:33.70] 少年少女戦国無双 浮世の随に | Shounen shoujo sengoku musou ukiyo no manimani
[00:40.40] 千本桜 夜ニ紛レ 君ノ声モ届カナイヨ | Senbonzakura yoru ni magire kimi no koe mo todokanai yo
[00:47.10] 此処は宴 鋼の檻 その断頭台で見下ろして | Koko wa utage hagane no ori sono dantoudai de mioroshite
[00:53.90] 三千世界 常世之闇 嘆ク唄モ聞コエナイヨ | Sanzen sekai tokoyo no yami nageku uta mo kikoenai yo
[01:00.60] 青藍の空 遥か彼方 その光線銃で打ち抜いて | Seiran no sora haruka kanata sono kousenjuu de uchinuite`
  }
];
