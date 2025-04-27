import { toast } from "sonner";
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

// This function now calls our Netlify Function proxy
const fetchNetlifyData = async (
  endpoint: string,
  params?: Record<string, string | number>,
  timeRange: TimeRange = '30d'
): Promise<any | EmptyResponse> => {
  const functionUrl = '/.netlify/functions/api'; // Default path, change if you set config.path

  console.log("Calling proxy function:", functionUrl, "for endpoint:", endpoint, "time range:", timeRange);

  try {
    // Get client timezone to send to the function
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Timezone': timezone, // Send timezone as a header
      },
      body: JSON.stringify({
        endpoint,
        params,
        timeRange,
      }),
    });

    if (!response.ok) {
       let errorData;
       try {
           errorData = await response.json(); // Try to parse error details from function
           console.error("Proxy Function Error Response:", response.status, response.statusText, errorData);
           toast.error(`API Error fetching ${endpoint} (${timeRange}): ${errorData.error || response.statusText}. Check console.`);
       } catch (parseError) {
           const errorBody = await response.text(); // Fallback to text
           console.error("Proxy Function Error (non-JSON):", response.status, response.statusText, errorBody);
           toast.error(`API Error fetching ${endpoint} (${timeRange}): ${response.statusText}. Check console.`);
       }
       return { data: [] }; // Return empty on error
    }

    const jsonData = await response.json();

    // Logging received data (optional, but can be helpful)
    console.log(`Received data for ${endpoint} (${timeRange}) from proxy:`, jsonData);

    // Basic validation: ensure 'data' property exists, even if it's empty
    if (typeof jsonData !== 'object' || jsonData === null || !jsonData.hasOwnProperty('data')) {
        console.warn(`Proxy response for ${endpoint} (${timeRange}) is missing 'data' property. Returning empty. Response:`, jsonData);
        toast.error(`Unexpected data format received for ${endpoint} (${timeRange}).`);
        return { data: [] };
    }


    return jsonData; // Return the data received from the proxy function
  } catch (error: any) {
     // Network errors or other issues calling the proxy function itself
     console.error(`Error calling proxy function for ${endpoint} (${timeRange}):`, error);
     toast.error(`Failed calling API proxy for ${endpoint} (${timeRange}). Check console.`);
     return { data: [] };
  }
};

// Exported functions remain the same, they just use the updated fetchNetlifyData
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

// formatBytes remains the same
const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// exportToCsv remains largely the same, but check data structure assumptions
export const exportToCsv = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    toast.error("No data available to export.");
    return;
  }

  // Add extra check: If data looks like { data: [...] }, extract the inner array
  let actualData = data;
  if (Array.isArray(data) && data.length === 1 && data[0]?.data && Array.isArray(data[0].data)) {
      console.warn("Exporting data that seems wrapped in an extra object layer, extracting inner .data array");
      actualData = data[0].data;
  } else if (data && (data as any).data && Array.isArray((data as any).data)) {
       console.warn("Exporting data that seems wrapped in an extra object layer, extracting inner .data array (non-array input)");
       actualData = (data as any).data;
  }

  if (!actualData || actualData.length === 0) {
       toast.error("No valid data found after potential unwrapping.");
       return;
   }


  const firstItem = actualData[0];
   // Check added for Array.isArray(firstItem) for pageviews/visitors
  if (!firstItem || (typeof firstItem !== 'object' && !Array.isArray(firstItem)) || Object.keys(firstItem).length === 0) {
     toast.error("Data format is invalid for export.");
     console.error("Invalid first item for export:", firstItem);
     return;
  }


  let processedData = actualData;
  let headersOrder: string[] | null = null;

  // --- Logic for different filenames ---
   if (filename === 'bandwidth' && actualData.length > 0 && firstItem.siteBandwidth !== undefined) {
      headersOrder = ['siteBandwidth', 'accountBandwidth', 'start', 'end'];
      processedData = actualData.map(item => ({
          siteBandwidth: formatBytes(item.siteBandwidth),
          accountBandwidth: formatBytes(item.accountBandwidth),
          start: item.start ? new Date(item.start).toLocaleString() : 'N/A', // Add check for start/end
          end: item.end ? new Date(item.end).toLocaleString() : 'N/A'
      }));
  } else if (filename === 'not_found' && actualData.length > 0 && firstItem.resource !== undefined) {
     headersOrder = ['resource', 'count'];
  } else if (filename === 'countries' && actualData.length > 0 && firstItem.resource !== undefined) {
      // Make sure country_name exists if needed
      headersOrder = firstItem.country_name !== undefined ? ['resource', 'country_name', 'count'] : ['resource', 'count'];
  } else if (filename === 'sources' && actualData.length > 0 && firstItem.resource !== undefined) {
      headersOrder = ['resource', 'count'];
  } else if (filename === 'pages' && actualData.length > 0 && firstItem.resource !== undefined) {
      headersOrder = ['resource', 'count'];
   // Updated check for pageviews/visitors to ensure firstItem is an array
  } else if ((filename === 'pageviews' || filename === 'visitors') && actualData.length > 0 && Array.isArray(firstItem)) {
      // Data is expected as [[timestamp, value], [timestamp, value], ...]
      // The data passed to exportToCsv from Analytics.tsx is already formatted correctly
      const headerRow = ["Date", "Count"];
      // Ensure rows are arrays before joining
      const rows = processedData.map(row => Array.isArray(row) ? row.join(",") : '');
      const csvContent = "data:text/csv;charset=utf-8," + headerRow.join(",") + "\n" + rows.join("\n");

       const encodedUri = encodeURI(csvContent);
       const link = document.createElement("a");
       link.setAttribute("href", encodedUri);
       link.setAttribute("download", `${filename}.csv`);
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       toast.success(`Exported ${filename}.csv successfully!`);
       return; // Exit early for this specific format
  }
   // --- Fallback/Default Logic ---
   else if (actualData.length > 0 && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
       // Fallback if no specific format matched but it's an array of objects
       console.warn(`Using default object keys for export format: ${filename}`);
       headersOrder = Object.keys(firstItem);
   } else {
       toast.error(`Cannot determine export format for ${filename}.`);
       console.error("Unhandled data format for export:", actualData);
       return;
   }


  // --- CSV Generation (for object arrays) ---
  const headers = headersOrder ? headersOrder.join(",") : ''; // Should always have headersOrder if we reach here

  const rows = processedData.map(row => {
      // Ensure row is an object before processing
       if (typeof row !== 'object' || row === null) return '';
      const orderedValues = headersOrder ? headersOrder.map(header => row[header]) : Object.values(row);
      return orderedValues.map(value => {
          const stringValue = String(value ?? ''); // Handle null/undefined
          // Escape double quotes and wrap in double quotes if value contains a comma or double quote
          const needsQuotes = stringValue.includes(',') || stringValue.includes('"');
          const escapedValue = stringValue.replace(/"/g, '""');
          return needsQuotes ? `"${escapedValue}"` : escapedValue;
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
