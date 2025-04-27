import { toast } from "sonner";

const NETLIFY_API_KEY = import.meta.env.VITE_NETLIFY_API_KEY;
const SITE_ID = import.meta.env.VITE_SITE_ID;

const BASE_URL = 'https://analytics.services.netlify.com/v2';

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

const fetchNetlifyData = async (
  endpoint: string,
  params?: Record<string, string | number>,
  timeRange: TimeRange = '30d'
): Promise<any | EmptyResponse> => {
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

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
  console.log("Fetching URL:", url, "for time range:", timeRange);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${NETLIFY_API_KEY}`,
      },
    });

    if (!response.ok) {
       const errorBody = await response.text();
       console.error("Netlify API Error:", response.status, response.statusText, errorBody);
       toast.error(`API Error fetching ${endpoint} (${timeRange}): ${response.statusText}. Check console.`);
       return { data: [] };
    }

    const jsonData = await response.json();

    if (endpoint.includes('/ranking/sources')) {
      console.log('Raw Netlify Sources Response:', JSON.stringify(jsonData, null, 2));
    }
    if (endpoint.includes('/ranking/pages')) {
      console.log('Raw Netlify Pages Response:', JSON.stringify(jsonData, null, 2));
    }
     if (endpoint.includes('/ranking/not_found')) {
        console.log('Raw Netlify Not Found Response:', JSON.stringify(jsonData, null, 2));
    }
     if (endpoint === '/bandwidth') {

        if (!jsonData.data || !Array.isArray(jsonData.data)) {
             console.warn("Bandwidth data structure mismatch for", timeRange, ", wrapping:", jsonData);
             if (jsonData.start && jsonData.end && jsonData.siteBandwidth !== undefined) {
                return { data: [jsonData] };
             }

             if (typeof jsonData === 'object' && Object.keys(jsonData).length === 0) {
                return { data: [] };
             }

             return { data: [] };
        } else if (jsonData.data.length === 0) {

             console.log("Received empty data array for bandwidth for", timeRange);
             return { data: [] };
        }
     }

    return jsonData;
  } catch (error) {
     console.error(`Error in fetchNetlifyData for ${endpoint} (${timeRange}):`, error);
     toast.error(`Failed fetching ${endpoint} (${timeRange}). Check console.`);
     return { data: [] };
  }
};

export const getPageViews = (timeRange: TimeRange): Promise<TimeSeriesResponse | EmptyResponse> =>
  fetchNetlifyData('/pageviews', undefined, timeRange);
export const getVisitors = (timeRange: TimeRange): Promise<TimeSeriesResponse | EmptyResponse> =>
  fetchNetlifyData('/visitors', undefined, timeRange);
export const getCountries = (timeRange: TimeRange): Promise<GenericRankingResponse | EmptyResponse> =>
  fetchNetlifyData('/ranking/countries', undefined, timeRange);
export const getBandwidth = (timeRange: TimeRange): Promise<BandwidthResponse | EmptyResponse> =>
  fetchNetlifyData('/bandwidth', undefined, timeRange);
export const getSources = (timeRange: TimeRange): Promise<GenericRankingResponse | EmptyResponse> =>
  fetchNetlifyData('/ranking/sources', { limit: 10 }, timeRange);
export const getPages = (timeRange: TimeRange): Promise<GenericRankingResponse | EmptyResponse> =>
  fetchNetlifyData('/ranking/pages', { limit: 15 }, timeRange);
export const getNotFound = (timeRange: TimeRange): Promise<GenericRankingResponse | EmptyResponse> =>
  fetchNetlifyData('/ranking/not_found', { limit: 15 }, timeRange);

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const exportToCsv = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    toast.error("No data available to export.");
    return;
  }

  const firstItem = data[0];
  if (!firstItem || Object.keys(firstItem).length === 0) {
     toast.error("Data format is invalid for export.");
     return;
  }

  let processedData = data;
  let headersOrder: string[] | null = null;

  if (filename === 'bandwidth' && data.length > 0 && data[0].siteBandwidth !== undefined) {
      headersOrder = ['siteBandwidth', 'accountBandwidth', 'start', 'end'];
      processedData = data.map(item => ({
          siteBandwidth: formatBytes(item.siteBandwidth),
          accountBandwidth: formatBytes(item.accountBandwidth),
          start: new Date(item.start).toLocaleString(),
          end: new Date(item.end).toLocaleString()
      }));
  } else if (filename === 'not_found' && data.length > 0 && data[0].resource !== undefined) {
     headersOrder = ['resource', 'count'];
  } else if (filename === 'countries' && data.length > 0 && data[0].resource !== undefined) {
      headersOrder = ['resource', 'country_name', 'count'];
  } else if (filename === 'sources' && data.length > 0 && data[0].resource !== undefined) {
      headersOrder = ['resource', 'count'];
  } else if (filename === 'pages' && data.length > 0 && data[0].resource !== undefined) {
      headersOrder = ['resource', 'count'];
  } else if ((filename === 'pageviews' || filename === 'visitors') && data.length > 0 && Array.isArray(data[0])) {

      const headerRow = ["Date", "Count"];
      const rows = processedData.map(row => row.join(","));
      const csvContent = "data:text/csv;charset=utf-8," + headerRow.join(",") + "\n" + rows.join("\n");

       const encodedUri = encodeURI(csvContent);
       const link = document.createElement("a");
       link.setAttribute("href", encodedUri);
       link.setAttribute("download", `${filename}.csv`);
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       toast.success(`Exported ${filename}.csv successfully!`);
       return;
  }

  const headers = headersOrder ? headersOrder.join(",") : Object.keys(processedData[0]).join(",");

  const rows = processedData.map(row => {
      const orderedValues = headersOrder ? headersOrder.map(header => row[header]) : Object.values(row);
      return orderedValues.map(value => {
          const stringValue = String(value ?? '');
          const escapedValue = stringValue.includes('"') ? stringValue.replace(/"/g, '""') : stringValue;
          return stringValue.includes(',') ? `"${escapedValue}"` : escapedValue;
      }).join(",");
  });

  const csvContent = "data:text/csv;charset=utf-8," +
    headers + "\n" + rows.join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success(`Exported ${filename}.csv successfully!`);
};
