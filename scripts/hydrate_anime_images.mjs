#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const CACHE_PATH = path.join(ROOT_DIR, 'src', 'data', 'anime_media_cache.json');
const CATEGORY_DIRS = [
  path.join(ROOT_DIR, 'assets', 'categories', 'tier_01'),
  path.join(ROOT_DIR, 'src', 'data', 'categories'),
].filter(dir => fs.existsSync(dir));

const UPLOAD_SUPABASE = process.argv.includes('--upload-supabase');
const FORCE_REFRESH = process.argv.includes('--force');

// Known title aliases to guarantee 100% accurate AniList matching
const TITLE_ALIASES = {
  'Demon Slayer': 'Demon Slayer: Kimetsu no Yaiba',
  'Frieren: Beyond Journey\'s End': 'Sousou no Frieren',
  'Yamada-kun and the Seven Witches': 'Yamada-kun to 7-nin no Majo',
};

// Simple .env parser to get Supabase config without extra dependencies
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length > 0) {
        env[key.trim()] = rest.join('=').trim();
      }
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Load cache if present
function loadCache() {
  if (fs.existsSync(CACHE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch (e) {
      console.warn('Could not parse existing anime_media_cache.json, starting fresh.');
    }
  }
  return {};
}

function saveCache(cache) {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

// AniList GraphQL Query
const ANILIST_QUERY = `
  query ($search: String, $seasonYear: Int) {
    Media (search: $search, seasonYear: $seasonYear, type: ANIME, sort: SEARCH_MATCH) {
      id
      title {
        romaji
        english
        native
      }
      bannerImage
      coverImage {
        extraLarge
        large
        medium
      }
    }
  }
`;

async function fetchAniListGraphQL(search, seasonYear) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: ANILIST_QUERY,
      variables: { search, seasonYear },
    }),
  });

  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');

  if (res.status === 429) {
    const waitSeconds = 45;
    console.log(`\n[AniList] Rate limit reached. Pausing for ${waitSeconds}s...`);
    await new Promise(r => setTimeout(r, waitSeconds * 1000));
    return fetchAniListGraphQL(search, seasonYear);
  }

  // Preemptive rate-limit brake
  if (remaining && parseInt(remaining, 10) <= 2) {
    const waitSec = reset ? Math.max(5, parseInt(reset, 10) - Math.floor(Date.now() / 1000)) : 30;
    console.log(`\n[AniList] Approaching rate limit (${remaining} left). Cooling down for ${waitSec}s...`);
    await new Promise(r => setTimeout(r, waitSec * 1000));
  }

  const data = await res.json();
  return data.data?.Media || null;
}

async function resolveAnimeMedia(rawTitle) {
  const aliased = TITLE_ALIASES[rawTitle] || rawTitle;
  const yearMatch = aliased.match(/\((\d{4})\)/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
  const baseTitle = aliased.replace(/\s*\(\d{4}\)/, '').trim();

  // 1. Try with seasonYear if year qualifier is present
  if (year) {
    const res = await fetchAniListGraphQL(baseTitle, year);
    if (res) return res;
  }

  // 2. Try aliased or full raw title
  let res = await fetchAniListGraphQL(aliased);
  if (res) return res;

  // 3. Try stripped base title
  if (baseTitle !== aliased) {
    res = await fetchAniListGraphQL(baseTitle);
    if (res) return res;
  }

  // 4. Try diacritics-stripped title (e.g. Nausicaä -> Nausicaa)
  const normalized = aliased.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized !== aliased) {
    res = await fetchAniListGraphQL(normalized);
    if (res) return res;
  }

  return null;
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

async function uploadToSupabaseStorage(title, mediaEntry) {
  if (!supabase) {
    console.warn(`[Supabase] Client not configured. Skipping upload for "${title}".`);
    return null;
  }

  const imageUrl = mediaEntry.selectedImage;
  if (!imageUrl) return null;

  try {
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const filename = `banners/${mediaEntry.id}_${slugify(title)}${ext}`;

    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.warn(`[Supabase] Failed to download image for ${title}: ${res.statusText}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const { error: uploadError } = await supabase.storage
      .from('anime-assets')
      .upload(filename, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[Supabase] Upload error for "${title}":`, uploadError.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('anime-assets')
      .getPublicUrl(filename);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error(`[Supabase] Unexpected error uploading "${title}":`, err.message);
    return null;
  }
}

async function main() {
  console.log('====================================================');
  console.log('Project Kami — Anime Artwork Hydration & AniList Sync');
  console.log('====================================================');
  console.log(`Target directories: ${CATEGORY_DIRS.join(', ')}`);
  console.log(`Supabase Upload mode: ${UPLOAD_SUPABASE ? 'ENABLED (--upload-supabase)' : 'DISABLED (Using AniList CDN URLs)'}`);
  console.log(`Force Refresh mode: ${FORCE_REFRESH ? 'YES' : 'NO (Using Cache)'}`);
  console.log('');

  const cache = loadCache();

  // 1. Scan all JSON files and collect unique anime titles
  const categoryFiles = [];
  const uniqueAnimeTitles = new Set();

  for (const dir of CATEGORY_DIRS) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const filePath = path.join(dir, f);
      categoryFiles.push(filePath);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const prompt of content) {
        if (prompt.anime_a) uniqueAnimeTitles.add(prompt.anime_a.trim());
        if (prompt.anime_b) uniqueAnimeTitles.add(prompt.anime_b.trim());
      }
    }
  }

  const sortedTitles = [...uniqueAnimeTitles].sort();
  console.log(`Found ${sortedTitles.length} unique anime titles across ${categoryFiles.length} category files.\n`);

  // 2. Fetch and Cache Anime Media
  let fetchedCount = 0;
  let cacheHitCount = 0;
  let failureCount = 0;

  for (let i = 0; i < sortedTitles.length; i++) {
    const title = sortedTitles[i];
    const progress = `[${i + 1}/${sortedTitles.length}]`;

    if (!FORCE_REFRESH && cache[title] && cache[title].selectedImage) {
      cacheHitCount++;
      // If upload-supabase is requested and not uploaded yet, do it now
      if (UPLOAD_SUPABASE && !cache[title].supabaseUrl) {
        process.stdout.write(`${progress} Uploading to Supabase: ${title}... `);
        const sbUrl = await uploadToSupabaseStorage(title, cache[title]);
        if (sbUrl) {
          cache[title].supabaseUrl = sbUrl;
          saveCache(cache);
          console.log('✓');
        } else {
          console.log('✗');
        }
      }
      continue;
    }

    process.stdout.write(`${progress} Fetching AniList: "${title}"... `);
    try {
      const media = await resolveAnimeMedia(title);
      if (!media) {
        failureCount++;
        console.log('❌ NOT FOUND');
        continue;
      }

      const banner = media.bannerImage || null;
      const cover = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null;
      const selectedImage = cover || banner;

      const mediaEntry = {
        id: media.id,
        title: media.title,
        bannerImage: banner,
        coverImage: cover,
        selectedImage,
        supabaseUrl: cache[title]?.supabaseUrl || null,
      };

      if (UPLOAD_SUPABASE && !mediaEntry.supabaseUrl) {
        const sbUrl = await uploadToSupabaseStorage(title, mediaEntry);
        if (sbUrl) {
          mediaEntry.supabaseUrl = sbUrl;
        }
      }

      cache[title] = mediaEntry;
      saveCache(cache);
      fetchedCount++;

      const imageType = banner ? 'Banner' : 'Cover (fallback)';
      console.log(`✓ [${media.id}] (${imageType})`);

      // Gentle rate-limiting delay between network calls
      await new Promise(r => setTimeout(r, 750));
    } catch (err) {
      failureCount++;
      console.log(`❌ ERROR: ${err.message}`);
    }
  }

  saveCache(cache);

  console.log('\n--- AniList Resolution Summary ---');
  console.log(`Total Titles:     ${sortedTitles.length}`);
  console.log(`Cache Hits:       ${cacheHitCount}`);
  console.log(`Freshly Fetched:  ${fetchedCount}`);
  console.log(`Failed Lookups:   ${failureCount}`);

  // 3. Update Category JSON Files
  console.log('\n--- Updating Category Prompt Files ---');
  let totalPromptsUpdated = 0;

  for (const filePath of categoryFiles) {
    const filename = path.basename(filePath);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let fileUpdatedCount = 0;

    for (const prompt of content) {
      const mediaA = cache[prompt.anime_a];
      const mediaB = cache[prompt.anime_b];

      const urlA = UPLOAD_SUPABASE && mediaA?.supabaseUrl ? mediaA.supabaseUrl : mediaA?.selectedImage;
      const urlB = UPLOAD_SUPABASE && mediaB?.supabaseUrl ? mediaB.supabaseUrl : mediaB?.selectedImage;

      if (urlA && prompt.image_a_url !== urlA) {
        prompt.image_a_url = urlA;
        fileUpdatedCount++;
      }
      if (urlB && prompt.image_b_url !== urlB) {
        prompt.image_b_url = urlB;
        fileUpdatedCount++;
      }
    }

    if (fileUpdatedCount > 0) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
      console.log(`✓ Updated ${filename} (${fileUpdatedCount} prompt image URLs hydrated)`);
      totalPromptsUpdated += fileUpdatedCount;
    } else {
      console.log(`- ${filename} already up to date`);
    }
  }

  console.log(`\n🎉 Hydration Complete! Total image URLs updated: ${totalPromptsUpdated}`);
  console.log(`Cache stored at: ${CACHE_PATH}`);
}

main().catch(err => {
  console.error('\nFatal error in hydrate_anime_images:', err);
  process.exit(1);
});
