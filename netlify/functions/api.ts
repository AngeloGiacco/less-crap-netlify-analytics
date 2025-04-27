import type { Context, Config } from "@netlify/functions";

interface DataPoint {
  timestamp: number;
  value: number;
}

interface CountryData {
  count: number;
  country_name: string;
  resource: string;
}

interface SourceData {
  count: number;
  resource: string;
}

interface PageData {
  count: number;
  resource: string;
}

interface BandwidthData {
  start: number;
  end: number;
  siteBandwidth: number;
  accountBandwidth: number;
}

interface BandwidthResponse {
  data: BandwidthData[];
}

interface GenericRankingResponse {
  data: (SourceData | PageData | CountryData)[];
}

interface TimeSeriesResponse {
  data: DataPoint[];
}

type EmptyResponse = { data: [] };

export type TimeRange = '7d' | '30d' | '3m' | '1y';

// These should be set as secure environment variables in Netlify build settings
const NETLIFY_API_KEY = Netlify.env.get("NETLIFY_API_KEY");
const SITE_ID = Netlify.env.get("SITE_ID"); // Use non-prefixed variable

const BASE_URL = 'https://analytics.services.netlify.com/v2';

if (!NETLIFY_API_KEY || !SITE_ID) {
  console.error("Missing required environment variables: NETLIFY_API_KEY or SITE_ID");
  // Don't throw here in the global scope, handle in the handler
}

export default async (req: Request, context: Context): Promise<Response> => {
  if (!NETLIFY_API_KEY || !SITE_ID) {
    console.error("Function Error: Missing NETLIFY_API_KEY or SITE_ID environment variables.");
    return new Response(JSON.stringify({ error: "Internal server configuration error." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' },
    });
  }

  let endpoint: string;
  let params: Record<string, string | number> | undefined;
  let timeRange: TimeRange;

  try {
    const body = await req.json();
    endpoint = body.endpoint;
    params = body.params;
    timeRange = body.timeRange || '30d';

    if (!endpoint) {
      throw new Error("Missing 'endpoint' in request body");
    }
    if (typeof endpoint !== 'string') {
       throw new Error("'endpoint' must be a string");
    }
     if (timeRange && !['7d', '30d', '3m', '1y'].includes(timeRange)) {
       throw new Error("Invalid 'timeRange' value");
     }

  } catch (error: any) {
    console.error("Function Error: Invalid request body:", error.message);
    return new Response(JSON.stringify({ error: `Invalid request body: ${error.message}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();
  let fromTimestamp: number;

  switch (timeRange) {
    case '7d':
      fromTimestamp = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case '3m':
      fromTimestamp = now - 90 * 24 * 60 * 60 * 1000;
      break;
    case '1y':
      fromTimestamp = now - 365 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
    default:
      fromTimestamp = now - 30 * 24 * 60 * 60 * 1000;
      break;
  }

  // Try to get timezone from client headers if available, otherwise use a default or server's timezone
  const timezoneHeader = req.headers.get('X-Client-Timezone');
  const timezone = timezoneHeader || Intl.DateTimeFormat().resolvedOptions().timeZone; // Fallback

  const queryParams: Record<string, string | number> = {
    from: fromTimestamp,
    to: now,
    timezone: timezone,
    ...params,
  };

  const queryString = Object.entries(queryParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const url = `${BASE_URL}/${SITE_ID}${endpoint}?${queryString}`;
  console.log("Proxying request to:", url, "for time range:", timeRange);

  try {
    const netlifyResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${NETLIFY_API_KEY}`,
      },
    });

    if (!netlifyResponse.ok) {
       const errorBody = await netlifyResponse.text();
       console.error("Netlify API Error (via proxy):", netlifyResponse.status, netlifyResponse.statusText, errorBody);
       // Return a structured error response to the client
       return new Response(JSON.stringify({
           error: `Netlify API Error: ${netlifyResponse.statusText}`,
           status: netlifyResponse.status,
           details: errorBody
        }), {
         status: netlifyResponse.status, // Forward the status
         headers: { 'Content-Type': 'application/json' },
       });
    }

    const jsonData = await netlifyResponse.json();

    // Optional: Add specific logging if needed, similar to the original
    // if (endpoint.includes('/ranking/sources')) { ... }

    // Handle potential data structure mismatches, e.g., for bandwidth
     if (endpoint === '/bandwidth') {
        if (!jsonData.data || !Array.isArray(jsonData.data)) {
             console.warn("Proxy: Bandwidth data structure mismatch for", timeRange, ", wrapping:", jsonData);
             if (jsonData.start && jsonData.end && jsonData.siteBandwidth !== undefined) {
                return new Response(JSON.stringify({ data: [jsonData] }), { headers: { 'Content-Type': 'application/json' } });
             }
             if (typeof jsonData === 'object' && Object.keys(jsonData).length === 0) {
                 return new Response(JSON.stringify({ data: [] }), { headers: { 'Content-Type': 'application/json' } });
             }
             // Return empty data if structure is unexpected but not clearly a single record
             return new Response(JSON.stringify({ data: [] }), { headers: { 'Content-Type': 'application/json' } });
        } else if (jsonData.data.length === 0) {
             console.log("Proxy: Received empty data array for bandwidth for", timeRange);
             // Fall through to return the empty data array normally
        }
     }


    // Return the successful JSON data
    return new Response(JSON.stringify(jsonData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
     console.error(`Function Error: Failed fetching ${endpoint} (${timeRange}) via proxy:`, error);
     // Return a generic server error response
     return new Response(JSON.stringify({ error: "Internal server error while contacting Netlify API." }), {
       status: 500,
       headers: { 'Content-Type': 'application/json' },
     });
  }
};
