import type { Env } from '../../types';

interface NewsItem {
  title: string;
  summary: string;
  published: string;
  link: string;
}

interface FeedSource {
  source_name: string;
  success: boolean;
  error: string | null;
  fetch_time_gmt: string;
  data_age_minutes: number | null;
  accuracy_score: number;
  items?: NewsItem[];
}

interface FeedPayload {
  fetched_at: string;
  overall_accuracy_score: number;
  sources_ok: number;
  sources_total: number;
  sources: FeedSource[];
}

// Simple RSS parser
function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block) ||
      /<title[^>]*>([\s\S]*?)<\/title>/.exec(block))?.[1]?.trim() ?? "";
    const summary = (/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(block) ||
      /<description[^>]*>([\s\S]*?)<\/description>/.exec(block))?.[1]
      ?.replace(/<[^>]+>/g, "").trim().slice(0, 300) ?? "";
    const published = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block))?.[1]?.trim() ?? "";
    const link = (/<link[^>]*>([\s\S]*?)<\/link>/.exec(block))?.[1]?.trim() ?? "";

    if (title) items.push({ title, summary, published, link });
  }

  return items;
}

async function fetchRSSFeed(url: string, sourceName: string): Promise<FeedSource> {
  const fetchTime = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Crisis2/1.0' }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        source_name: sourceName,
        success: false,
        error: `HTTP ${response.status}`,
        fetch_time_gmt: fetchTime,
        data_age_minutes: null,
        accuracy_score: 0
      };
    }

    const xml = await response.text();
    const items = parseRSS(xml);

    return {
      source_name: sourceName,
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      data_age_minutes: 0,
      accuracy_score: items.length > 0 ? 100 : 75,
      items: items.slice(0, 20) // Limit to 20 items per feed
    };
  } catch (error) {
    return {
      source_name: sourceName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      fetch_time_gmt: fetchTime,
      data_age_minutes: null,
      accuracy_score: 0
    };
  }
}

// RSS feeds to fetch
const RSS_FEEDS = [
  { name: 'BBC Business RSS', url: 'http://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'Guardian Business RSS', url: 'https://www.theguardian.com/business/rss' },
  { name: 'Reuters World RSS', url: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best' },
  { name: 'Financial Times RSS', url: 'https://www.ft.com/?format=rss' },
  { name: 'Al Jazeera RSS', url: 'https://www.aljazeera.com/xml/rss/all.xml' }
];

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    // Fetch all RSS feeds in parallel
    const feedPromises = RSS_FEEDS.map(feed =>
      fetchRSSFeed(feed.url, feed.name)
    );

    const sources = await Promise.all(feedPromises);

    const successCount = sources.filter(s => s.success).length;
    const avgAccuracy = sources.reduce((sum, s) => sum + s.accuracy_score, 0) / sources.length;

    const payload: FeedPayload = {
      fetched_at: new Date().toISOString(),
      overall_accuracy_score: Math.round(avgAccuracy),
      sources_ok: successCount,
      sources_total: sources.length,
      sources
    };

    // Store in D1 database
    const id = crypto.randomUUID();
    const payloadStr = JSON.stringify(payload);

    await env.DB.prepare(
      'INSERT INTO feed_cache (id, fetched_at, payload, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(id, payload.fetched_at, payloadStr, new Date().toISOString())
      .run();

    // Broadcast to WebSocket clients via Durable Object
    if (env.MARKET_FEED_ROOM) {
      const durableId = env.MARKET_FEED_ROOM.idFromName('global_market_feed');
      const stub = env.MARKET_FEED_ROOM.get(durableId);

      // Send broadcast request to Durable Object
      await stub.fetch('https://fake-host/broadcast', {
        method: 'POST',
        body: payloadStr
      });
    }

    return new Response(JSON.stringify({
      success: true,
      id,
      sources_ok: successCount,
      sources_total: sources.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Feed fetch error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to fetch feeds'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
