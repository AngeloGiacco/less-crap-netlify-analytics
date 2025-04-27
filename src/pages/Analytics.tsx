import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Download, AlertCircle } from "lucide-react";
import {
  getPageViews,
  getVisitors,
  getCountries,
  getSources,
  getPages,
  getBandwidth,
  getNotFound,
  exportToCsv,
  TimeRange,
} from "@/services/netlifyApi";
import { cn } from "@/lib/utils";

const formatBytes = (bytes: number | undefined, decimals = 2): string => {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return (isNaN(value) ? 0 : value) + ' ' + sizes[i];
}

const Analytics = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const commonQueryOptions = {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  };

  const { data: pageViewsData } = useQuery({
    queryKey: ['pageViews', timeRange],
    queryFn: () => getPageViews(timeRange),
    ...commonQueryOptions,
  });

  const { data: visitorsData } = useQuery({
    queryKey: ['visitors', timeRange],
    queryFn: () => getVisitors(timeRange),
    ...commonQueryOptions,
  });

  const { data: countriesData } = useQuery({
    queryKey: ['countries', timeRange],
    queryFn: () => getCountries(timeRange),
    ...commonQueryOptions,
  });

  const { data: sourcesData } = useQuery({
    queryKey: ['sources', timeRange],
    queryFn: () => getSources(timeRange),
    ...commonQueryOptions,
  });

  const { data: pagesData } = useQuery({
    queryKey: ['pages', timeRange],
    queryFn: () => getPages(timeRange),
    ...commonQueryOptions,
  });

  const { data: bandwidthData } = useQuery({
    queryKey: ['bandwidth', timeRange],
    queryFn: () => getBandwidth(timeRange),
    ...commonQueryOptions,
  });

  const { data: notFoundData } = useQuery({
    queryKey: ['notFound', timeRange],
    queryFn: () => getNotFound(timeRange),
    ...commonQueryOptions,
  });

  const siteTitle = import.meta.env.VITE_SITE_TITLE || "Site Analytics";

  const timeRangeOptions: { label: string; value: TimeRange }[] = [
    { label: 'Last 7 Days', value: '7d'},
    { label: 'Last 30 Days', value: '30d'},
    { label: 'Last 3 Months', value: '3m'},
    { label: 'Last Year', value: '1y'},
  ];

  const currentBandwidth = bandwidthData?.data?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
              {siteTitle}
            </h1>
            <p className="text-gray-400 mt-2">Real-time insights into your site's performance</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
              {timeRangeOptions.map(option => (
                <Button
                  key={option.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimeRange(option.value)}
                  className={cn(
                    "px-3 py-1 rounded-md transition-colors text-sm",
                    timeRange === option.value
                      ? "bg-purple-600 text-white hover:bg-purple-700"
                      : "text-gray-400 hover:bg-slate-700 hover:text-gray-200"
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => {
                if (pageViewsData?.data && Array.isArray(pageViewsData.data[0])) {
                  const formattedData = pageViewsData.data.map((row: any) => [
                    new Date(row[0]).toLocaleDateString(),
                    row[1]
                  ]);
                  exportToCsv(formattedData, 'pageviews');
                } else {
                  console.warn("Page views data not ready or invalid format for export:", pageViewsData);
                }
              }} variant="outline" className="text-purple-400 border-purple-400/50 hover:bg-purple-900/50 hover:text-purple-300 transition-colors text-xs px-2 py-1">
                <Download className="mr-1 h-3 w-3" /> Export Views
              </Button>
              <Button onClick={() => {
                if (visitorsData?.data && Array.isArray(visitorsData.data[0])) {
                  const formattedData = visitorsData.data.map((row: any) => [
                    new Date(row[0]).toLocaleDateString(),
                    row[1]
                  ]);
                  exportToCsv(formattedData, 'visitors');
                } else {
                  console.warn("Visitors data not ready or invalid format for export:", visitorsData);
                }
              }} variant="outline" className="text-pink-400 border-pink-400/50 hover:bg-pink-900/50 hover:text-pink-300 transition-colors text-xs px-2 py-1">
                <Download className="mr-1 h-3 w-3" /> Export Visitors
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-200">Page Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {pageViewsData?.data && pageViewsData.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pageViewsData?.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                      <XAxis
                        dataKey="0"
                        tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
                        stroke="#718096"
                      />
                      <YAxis stroke="#718096" />
                      <Tooltip
                        labelFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
                        contentStyle={{ backgroundColor: '#1A202C', border: 'none' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="1"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        dot={false}
                        name="Views"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-200">Unique Visitors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {visitorsData?.data && visitorsData.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={visitorsData?.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                      <XAxis
                        dataKey="0"
                        tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
                        stroke="#718096"
                      />
                      <YAxis stroke="#718096" />
                      <Tooltip
                        labelFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
                        contentStyle={{ backgroundColor: '#1A202C', border: 'none' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="1"
                        stroke="#EC4899"
                        strokeWidth={2}
                        dot={false}
                        name="Visitors"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="text-xl font-semibold text-gray-200">Bandwidth Usage</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => currentBandwidth && exportToCsv([currentBandwidth], 'bandwidth')}
                disabled={!currentBandwidth}
                className="text-teal-400 border-teal-400/50 hover:bg-teal-900/50 hover:text-teal-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex flex-col justify-center items-center space-y-6 p-4">
                {currentBandwidth ? (
                  <>
                    <div className="text-center">
                      <p className="text-gray-400 text-sm mb-1">Site Bandwidth ({timeRangeOptions.find(o => o.value === timeRange)?.label})</p>
                      <p className="text-3xl font-bold text-teal-400">{formatBytes(currentBandwidth.siteBandwidth)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-sm mb-1">Account Bandwidth ({timeRangeOptions.find(o => o.value === timeRange)?.label})</p>
                      <p className="text-3xl font-bold text-gray-300">{formatBytes(currentBandwidth.accountBandwidth)}</p>
                    </div>
                    <p className="text-xs text-gray-500 text-center pt-4">
                      Data reflects usage between {new Date(currentBandwidth.start).toLocaleDateString()} and {new Date(currentBandwidth.end).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">No bandwidth data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="text-xl font-semibold text-gray-200">Top Countries</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => countriesData?.data && exportToCsv(countriesData.data, 'countries')}
                disabled={!countriesData?.data || countriesData.data.length === 0}
                className="text-orange-400 border-orange-400/50 hover:bg-orange-900/50 hover:text-orange-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {countriesData?.data && countriesData.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countriesData.data.slice(0, 10)} layout="vertical" margin={{ right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                      <XAxis type="number" stroke="#718096" />
                      <YAxis dataKey="resource" type="category" stroke="#718096" width={60} tick={{ fontSize: 10 }}/>
                      <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: 'none' }} cursor={{ fill: '#ffffff10' }}/>
                      <Bar dataKey="count" fill="#F97316" name="Views"/>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="text-xl font-semibold text-gray-200">Top Sources</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sourcesData?.data && exportToCsv(sourcesData.data, 'sources')}
                disabled={!sourcesData?.data || sourcesData.data.length === 0}
                className="text-indigo-400 border-indigo-400/50 hover:bg-indigo-900/50 hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {sourcesData?.data && sourcesData.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourcesData.data} layout="vertical" margin={{ right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                      <XAxis type="number" stroke="#718096" />
                      <YAxis dataKey="resource" type="category" stroke="#718096" width={80} tick={{ fontSize: 10 }} tickFormatter={(value) => value === '(direct)' ? 'Direct' : value}/>
                      <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: 'none' }} cursor={{ fill: '#ffffff10' }}/>
                      <Bar dataKey="count" fill="#8B5CF6" name="Referrals"/>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-1 bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="text-xl font-semibold text-gray-200">Top Pages</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagesData?.data && exportToCsv(pagesData.data, 'pages')}
                disabled={!pagesData?.data || pagesData.data.length === 0}
                className="text-purple-400 border-purple-400/50 hover:bg-purple-900/50 hover:text-purple-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] overflow-y-auto space-y-2 pr-2">
                {pagesData?.data && pagesData.data.length > 0 ? (
                  pagesData.data.map((page: any) => (
                    <div key={page.resource} className="flex justify-between items-center p-2 rounded bg-white/5 hover:bg-white/10 transition-colors text-sm">
                      <span className="truncate text-gray-300" title={page.resource}>{page.resource}</span>
                      <span className="ml-4 flex-shrink-0 text-purple-400 font-medium">{page.count.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-2 bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="text-xl font-semibold text-gray-200 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-red-500" /> Top Not Found (404s)
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => notFoundData?.data && exportToCsv(notFoundData.data, 'not_found')}
                disabled={!notFoundData?.data || notFoundData.data.length === 0}
                className="text-red-400 border-red-400/50 hover:bg-red-900/50 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {notFoundData?.data && notFoundData.data.length > 0 ? (
                  notFoundData.data.map((page: any) => (
                    <div key={page.resource} className="flex justify-between items-center p-2 rounded bg-white/5 hover:bg-white/10 transition-colors text-sm">
                      <span className="truncate text-gray-300" title={page.resource}>{page.resource}</span>
                      <span className="ml-4 flex-shrink-0 text-red-400 font-medium">{page.count.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-[100px] text-gray-500">No 404s recorded in this period.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
