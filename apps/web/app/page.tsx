"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Cloud,
  Gauge,
  Loader2,
  LogIn,
  MapPin,
  Play,
  Radio,
  Square,
  Thermometer,
  Timer,
  Wifi,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { io, type Socket } from "socket.io-client";
import { SiteNav } from "@/app/components/site-nav";
import {
  AirQualityAggregate,
  AirQualityAlert,
  AirQualityReading,
  DASHBOARD_QUERY,
  DEVICE_ANALYTICS_QUERY,
  Device,
  GRAPHQL_URL,
  LATEST_READING_QUERY,
  Location,
  LOGIN_MUTATION,
  PUBLISH_SIMULATED_READING_MUTATION,
  PipelineMetrics,
  SOCKET_URL,
  User,
  createApolloClient,
} from "@/lib/graphql";

type DashboardData = {
  me: User;
  locations: Location[];
  devices: Device[];
};

type AnalyticsData = {
  readingsByDevice: AirQualityReading[];
  alertsByDevice: AirQualityAlert[];
  aggregatesByDevice: AirQualityAggregate[];
  pipelineMetrics: PipelineMetrics | null;
};

type ReadingState = Record<string, AirQualityReading | null>;

export default function Home() {
  const [email, setEmail] = useState("fisnik@example.com");
  const [password, setPassword] = useState("password123");
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [readings, setReadings] = useState<ReadingState>({});
  const [history, setHistory] = useState<AirQualityReading[]>([]);
  const [alerts, setAlerts] = useState<AirQualityAlert[]>([]);
  const [aggregates, setAggregates] = useState<AirQualityAggregate[]>([]);
  const [pipelineMetrics, setPipelineMetrics] =
    useState<PipelineMetrics | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const simulationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const client = useMemo(() => createApolloClient(token), [token]);
  const selectedDevice = dashboard?.devices.find(
    (device) => device.id === selectedDeviceId,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToken(window.localStorage.getItem("iot_auth_token"));
      setMounted(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const loadLatestReadings = useCallback(
    async (
      devices: Device[],
      activeClient: ReturnType<typeof createApolloClient> = client,
    ) => {
      const entries = await Promise.all(
        devices.map(async (device) => {
          const result = await activeClient.query<{
            latestReadingByDevice: AirQualityReading | null;
          }>({
            query: LATEST_READING_QUERY,
            variables: { deviceId: device.id },
            fetchPolicy: "network-only",
          });

          return [device.id, result.data?.latestReadingByDevice ?? null] as const;
        }),
      );

      setReadings((current) => mergeLatestReadings(current, entries));
    },
    [client],
  );

  const loadAnalytics = useCallback(
    async (deviceId: string) => {
      if (!deviceId) {
        return;
      }

      const result = await client.query<AnalyticsData>({
        query: DEVICE_ANALYTICS_QUERY,
        variables: {
          input: {
            id: deviceId,
            day: new Date().toISOString().slice(0, 10),
            limit: 60,
          },
        },
        fetchPolicy: "network-only",
      });

      const data = result.data;

      if (data) {
        setHistory((current) =>
          mergeReadingHistories(
            current,
            [...data.readingsByDevice].reverse(),
          ),
        );
        setAlerts(data.alertsByDevice);
        setAggregates([...data.aggregatesByDevice].reverse());
        setPipelineMetrics(data.pipelineMetrics);
      }
    },
    [client],
  );

  const loadDashboard = useCallback(
    async (activeClient = client) => {
      setLoading(true);
      setMessage(null);

      try {
        const result = await activeClient.query<DashboardData>({
          query: DASHBOARD_QUERY,
          fetchPolicy: "network-only",
        });
        const data = result.data;

        if (!data) {
          throw new Error("Dashboard query did not return data");
        }

        setDashboard(data);
        setSelectedDeviceId((current) => current || data.devices[0]?.id || "");
        await loadLatestReadings(data.devices, activeClient);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not load dashboard",
        );
      } finally {
        setLoading(false);
      }
    },
    [client, loadLatestReadings],
  );

  useEffect(() => {
    if (token && !dashboard && !loading) {
      const timer = window.setTimeout(() => {
        void loadDashboard();
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [dashboard, loadDashboard, loading, token]);

  useEffect(() => {
    if (!token || !selectedDeviceId) {
      return;
    }

    const initialTimer = window.setTimeout(() => {
      void loadAnalytics(selectedDeviceId);
    }, 0);
    const timer = window.setInterval(() => {
      void loadAnalytics(selectedDeviceId);
    }, 10000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [loadAnalytics, selectedDeviceId, token]);

  useEffect(() => {
    if (!token || !dashboard?.devices.length) {
      return;
    }

    const reconcile = () => {
      void loadLatestReadings(dashboard.devices);
    };
    const initialTimer = window.setTimeout(reconcile, 0);
    const timer = window.setInterval(reconcile, 1500);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [dashboard?.devices, loadLatestReadings, token]);

  useEffect(() => {
    if (!token || !dashboard?.devices.length) {
      return;
    }

    const socket: Socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 5000,
    });

    socket.on("connect", () => {
      setSocketConnected(true);
      setSocketError(null);
      dashboard.devices.forEach((device) => {
        socket.emit("reading.subscribe", device.id);
      });
    });
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", (error) => {
      setSocketConnected(false);
      setSocketError(error.message);
    });
    socket.on("reading.created", (reading: AirQualityReading) => {
      const normalizedReading = normalizeReading(reading);
      setReadings((current) =>
        mergeLatestReadings(current, [
          [normalizedReading.deviceId, normalizedReading],
        ]),
      );

      if (normalizedReading.deviceId === selectedDeviceId) {
        setHistory((current) =>
          mergeReadingHistories(current, [normalizedReading]),
        );
      }
    });
    socket.on(
      "alert.created",
      (alert: Pick<
        AirQualityAlert,
        "deviceId" | "locationId" | "timestamp" | "alertLevel" | "message"
      >) => {
        if (alert.deviceId === selectedDeviceId) {
          setAlerts((current) => [
            {
              ...alert,
              alertType: "AIR_QUALITY",
              metric: "AQI",
              metricValue: 0,
              threshold: 0,
              anomalyScore: 0,
            },
            ...current,
          ]);
        }
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [dashboard?.devices, selectedDeviceId, token]);

  useEffect(() => () => stopSimulation(), []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const result = await createApolloClient().mutate<{
        login: { accessToken: string };
      }>({
        mutation: LOGIN_MUTATION,
        variables: { email, password },
      });
      const accessToken = result.data?.login.accessToken;

      if (!accessToken) {
        throw new Error("Login did not return a token");
      }

      const authedClient = createApolloClient(accessToken);
      window.localStorage.setItem("iot_auth_token", accessToken);
      setToken(accessToken);
      await loadDashboard(authedClient);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function publishSimulatedReading(device: Device) {
    await client.mutate({
      mutation: PUBLISH_SIMULATED_READING_MUTATION,
      variables: {
        deviceId: device.id,
        locationId: device.locationId,
      },
    });
  }

  async function startSimulation() {
    if (!selectedDevice) {
      setMessage("Create or select a device before starting simulation");
      return;
    }

    try {
      setMessage(null);
      await publishSimulatedReading(selectedDevice);
      setSimulationRunning(true);
      simulationTimer.current = setInterval(() => {
        publishSimulatedReading(selectedDevice).catch((error) => {
          setMessage(
            error instanceof Error
              ? error.message
              : "Kafka simulation failed to publish a reading",
          );
          stopSimulation();
        });
      }, 3000);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Kafka simulation could not start",
      );
    }
  }

  function stopSimulation() {
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
      simulationTimer.current = null;
    }
    setSimulationRunning(false);
  }

  function logout() {
    stopSimulation();
    window.localStorage.removeItem("iot_auth_token");
    setToken(null);
    setDashboard(null);
    setReadings({});
  }

  if (!mounted) {
    return <main className="min-h-screen bg-[#f4f7f5]" />;
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[#f4f7f5] text-[#17211b]">
        <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
          <div className="grid w-full gap-8 lg:grid-cols-[1fr_420px]">
            <div className="flex flex-col justify-center">
              <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-[#c8d8cd] bg-white px-3 py-1 text-sm text-[#42604d]">
                <Wifi size={16} />
                Kafka + Spark real-time monitoring
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-[#102117]">
                Intelligent air-quality operations
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#52655a]">
                Monitor live sensors, Spark rolling analytics, anomaly scores,
                alerts, and end-to-end processing latency.
              </p>
            </div>

            <form
              onSubmit={login}
              className="rounded-xl border border-[#d5ded8] bg-white p-6 shadow-sm"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#1f6f43] text-white">
                  <LogIn size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Sign in</h2>
                  <p className="text-sm text-[#64736a]">{GRAPHQL_URL}</p>
                </div>
              </div>
              <label className="mb-4 block">
                <span className="mb-2 block text-sm font-medium">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#cbd8d0] px-3 outline-none focus:border-[#1f6f43]"
                  type="email"
                />
              </label>
              <label className="mb-5 block">
                <span className="mb-2 block text-sm font-medium">Password</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#cbd8d0] px-3 outline-none focus:border-[#1f6f43]"
                  type="password"
                />
              </label>
              {message ? <ErrorMessage message={message} /> : null}
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1f6f43] px-4 font-medium text-white hover:bg-[#185d37]"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <LogIn size={18} />
                )}
                Sign in
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  const latestAlertCount = Object.values(readings).filter(
    (reading) =>
      reading?.alertLevel === "WARNING" || reading?.alertLevel === "CRITICAL",
  ).length;

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#17211b]">
      <header className="border-b border-[#d7e1db] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">Air Quality Monitor</h1>
            <p className="text-sm text-[#62746a]">
              {dashboard?.me.name ?? "Dashboard"} · Cassandra source of truth
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SiteNav />
            <StatusPill
              active={socketConnected}
              label={socketConnected ? "Live pipeline" : "Socket offline"}
            />
            <button
              onClick={logout}
              className="h-10 rounded-md bg-[#24382d] px-3 text-sm font-medium text-white hover:bg-[#18271f]"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-6">
        {message ? <ErrorMessage message={message} /> : null}
        {socketError ? (
          <p className="mb-5 rounded-md border border-[#ead7b8] bg-[#fff9ef] px-3 py-2 text-sm text-[#855216]">
            Live socket reconnecting: {socketError}. Latest readings continue
            through automatic GraphQL reconciliation.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            icon={<MapPin size={20} />}
            label="Locations"
            value={dashboard?.locations.length ?? 0}
          />
          <SummaryCard
            icon={<Wifi size={20} />}
            label="Sensors"
            value={dashboard?.devices.length ?? 0}
          />
          <SummaryCard
            icon={<AlertTriangle size={20} />}
            label="Active alerts"
            value={latestAlertCount}
            tone={latestAlertCount ? "warning" : "normal"}
          />
          <SummaryCard
            icon={<Timer size={20} />}
            label="Average latency"
            value={
              pipelineMetrics
                ? `${Math.round(pipelineMetrics.avgLatencyMs)} ms`
                : "Waiting"
            }
          />
          <SummaryCard
            icon={<Radio size={20} />}
            label="Kafka producer"
            value={simulationRunning ? "Publishing" : "Idle"}
          />
        </div>

        <section className="mt-6 rounded-xl border border-[#d5ded8] bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <label>
              <span className="mb-2 block text-sm font-medium">
                Demonstration sensor
              </span>
              <select
                value={selectedDeviceId}
                onChange={(event) => setSelectedDeviceId(event.target.value)}
                className="h-11 w-full rounded-md border border-[#cbd8d0] bg-white px-3 outline-none focus:border-[#1f6f43]"
              >
                {(dashboard?.devices ?? []).map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} · {device.externalId}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={simulationRunning ? stopSimulation : startSimulation}
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f6f43] px-5 font-medium text-white hover:bg-[#185d37]"
            >
              {simulationRunning ? <Square size={18} /> : <Play size={18} />}
              {simulationRunning ? "Stop Kafka stream" : "Start Kafka stream"}
            </button>
          </div>
          <p className="mt-3 text-sm text-[#66776d]">
            Flow: simulator → Kafka topic → Spark validation and analytics →
            Cassandra → API live bridge → dashboard.
          </p>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {(dashboard?.devices ?? []).map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              reading={readings[device.id]}
              location={dashboard?.locations.find(
                (item) => item.id === device.locationId,
              )}
              selected={device.id === selectedDeviceId}
              onSelect={() => setSelectedDeviceId(device.id)}
            />
          ))}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <ChartCard title="Live measurements" subtitle="Raw validated readings">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={history.map(formatReadingForChart)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3ebe6" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  dataKey="aqi"
                  name="AQI"
                  stroke="#b45309"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="pm25"
                  name="PM2.5"
                  stroke="#1f6f43"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="co2"
                  name="CO2 / 10"
                  stroke="#315a8a"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <section className="rounded-xl border border-[#d5ded8] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-md bg-[#fff3df] p-2 text-[#9a5b12]">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Recent alerts</h2>
                <p className="text-sm text-[#66776d]">
                  Spark threshold and anomaly engine
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {alerts.slice(0, 5).map((alert, index) => (
                <div
                  key={`${alert.timestamp}-${alert.alertType}-${index}`}
                  className="rounded-lg border border-[#ecd8bc] bg-[#fffaf2] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#8b4c0e]">
                      {alert.alertLevel}
                    </span>
                    <span className="text-xs text-[#7b6d5c]">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{alert.message}</p>
                </div>
              ))}
              {!alerts.length ? (
                <EmptyState label="No warning or critical events today" />
              ) : null}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <ChartCard
            title="Spark rolling analytics"
            subtitle="One-minute windows sliding every ten seconds"
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={aggregates.map(formatAggregateForChart)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3ebe6" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  dataKey="avgAqi"
                  name="Average AQI"
                  stroke="#1f6f43"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="maxAqi"
                  name="Maximum AQI"
                  stroke="#b45309"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <section className="rounded-xl border border-[#d5ded8] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-md bg-[#e8eef7] p-2 text-[#315a8a]">
                <BrainCircuit size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Intelligent analysis</h2>
                <p className="text-sm text-[#66776d]">
                  Multi-signal anomaly scoring
                </p>
              </div>
            </div>
            <MetricRow
              label="Current anomaly score"
              value={formatNumber(
                readings[selectedDeviceId]?.anomalyScore ?? null,
                2,
              )}
            />
            <MetricRow
              label="Data quality"
              value={readings[selectedDeviceId]?.qualityStatus ?? "Waiting"}
            />
            <MetricRow
              label="Latest severity"
              value={readings[selectedDeviceId]?.alertLevel ?? "Waiting"}
            />
            <MetricRow
              label="Records in last batch"
              value={pipelineMetrics?.recordsProcessed ?? "Waiting"}
            />
            <MetricRow
              label="Batch alerts"
              value={pipelineMetrics?.alertsGenerated ?? "Waiting"}
            />
            <MetricRow
              label="Maximum latency"
              value={
                pipelineMetrics
                  ? `${pipelineMetrics.maxLatencyMs} ms`
                  : "Waiting"
              }
            />
          </section>
        </div>
      </section>
    </main>
  );
}

function DeviceCard({
  device,
  reading,
  location,
  selected,
  onSelect,
}: {
  device: Device;
  reading: AirQualityReading | null | undefined;
  location?: Location;
  selected: boolean;
  onSelect: () => void;
}) {
  const severity = reading?.alertLevel ?? "NORMAL";

  return (
    <button
      onClick={onSelect}
      className={`rounded-xl border bg-white p-5 text-left shadow-sm transition ${
        selected
          ? "border-[#1f6f43] ring-2 ring-[#dbece2]"
          : "border-[#d5ded8] hover:border-[#9fb7a8]"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{device.name}</h2>
          <p className="text-sm text-[#66776d]">
            {location?.name ?? "Unknown location"} · {device.status}
          </p>
        </div>
        <SeverityBadge severity={severity} />
      </div>
      {reading ? (
        <>
          <div className="mb-3 flex items-center justify-between text-xs text-[#66776d]">
            <span>{new Date(reading.timestamp).toLocaleString()}</span>
            <span>{Math.round(reading.processingLatencyMs ?? 0)} ms</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric icon={<Gauge size={18} />} label="AQI" value={reading.aqi} />
            <Metric
              icon={<Cloud size={18} />}
              label="PM2.5"
              value={reading.pm25}
            />
            <Metric
              icon={<Cloud size={18} />}
              label="PM10"
              value={reading.pm10}
            />
            <Metric
              icon={<Activity size={18} />}
              label="CO2"
              value={`${reading.co2} ppm`}
            />
            <Metric
              icon={<Thermometer size={18} />}
              label="Temperature"
              value={`${reading.temperature.toFixed(1)}°C`}
            />
            <Metric
              icon={<BrainCircuit size={18} />}
              label="Anomaly"
              value={formatNumber(reading.anomalyScore ?? null, 2)}
            />
          </div>
        </>
      ) : (
        <EmptyState label="Waiting for a Spark-processed reading" />
      )}
    </button>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#d5ded8] bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-4 text-sm text-[#66776d]">{subtitle}</p>
      {children}
    </section>
  );
}

function formatReadingForChart(reading: AirQualityReading) {
  return {
    time: new Date(reading.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    aqi: reading.aqi,
    pm25: reading.pm25,
    co2: Math.round(reading.co2 / 10),
  };
}

function formatAggregateForChart(aggregate: AirQualityAggregate) {
  return {
    time: new Date(aggregate.windowStart).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    avgAqi: Math.round(aggregate.avgAqi),
    maxAqi: aggregate.maxAqi,
  };
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles =
    severity === "CRITICAL"
      ? "bg-[#fde8e6] text-[#a52f25]"
      : severity === "WARNING"
        ? "bg-[#fff0d9] text-[#92500b]"
        : "bg-[#e7f2eb] text-[#1f6f43]";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${styles}`}>
      {severity}
    </span>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="mb-5 rounded-md border border-[#e7c9c4] bg-[#fff2f0] px-3 py-2 text-sm text-[#9a3528]">
      {message}
    </p>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#cbd8d0] px-4 py-8 text-center text-sm text-[#66776d]">
      {label}
    </div>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium ${
        active ? "bg-[#e7f2eb] text-[#1f6f43]" : "bg-[#f2ece7] text-[#85613d]"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          active ? "bg-[#1f6f43]" : "bg-[#b9824c]"
        }`}
      />
      {label}
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone = "normal",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "normal" | "warning";
}) {
  return (
    <div className="rounded-xl border border-[#d5ded8] bg-white p-5 shadow-sm">
      <div
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md ${
          tone === "warning"
            ? "bg-[#fff0d9] text-[#92500b]"
            : "bg-[#e7f2eb] text-[#1f6f43]"
        }`}
      >
        {icon}
      </div>
      <p className="text-sm text-[#66776d]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md bg-[#f5f8f6] p-3">
      <div className="mb-2 flex items-center gap-2 text-[#557061]">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#e4ebe7] py-3 last:border-0">
      <span className="text-sm text-[#66776d]">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function formatNumber(value: number | null, digits: number) {
  return value === null ? "Waiting" : value.toFixed(digits);
}

function normalizeReading(reading: AirQualityReading): AirQualityReading {
  return {
    ...reading,
    deviceId: String(reading.deviceId),
    locationId: String(reading.locationId),
    timestamp: new Date(reading.timestamp).toISOString(),
  };
}

function mergeLatestReadings(
  current: ReadingState,
  entries: ReadonlyArray<readonly [string, AirQualityReading | null]>,
) {
  const next = { ...current };

  for (const [deviceId, candidate] of entries) {
    if (!candidate) {
      if (!(deviceId in next)) {
        next[deviceId] = null;
      }
      continue;
    }

    const normalized = normalizeReading(candidate);
    const existing = next[deviceId];
    if (
      !existing ||
      new Date(normalized.timestamp).getTime() >=
        new Date(existing.timestamp).getTime()
    ) {
      next[deviceId] = normalized;
    }
  }

  return next;
}

function mergeReadingHistories(
  current: AirQualityReading[],
  candidates: AirQualityReading[],
) {
  const readingsByKey = new Map<string, AirQualityReading>();

  for (const reading of [...current, ...candidates]) {
    const normalized = normalizeReading(reading);
    readingsByKey.set(
      `${normalized.deviceId}:${normalized.timestamp}`,
      normalized,
    );
  }

  return [...readingsByKey.values()]
    .sort(
      (left, right) =>
        new Date(left.timestamp).getTime() -
        new Date(right.timestamp).getTime(),
    )
    .slice(-60);
}
