"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleOff,
  CloudFog,
  FlaskConical,
  Gauge,
  Play,
  Square,
  Timer,
} from "lucide-react";
import { SiteNav } from "@/app/components/site-nav";
import {
  AirQualityReading,
  DASHBOARD_QUERY,
  Device,
  Location,
  PUBLISH_SIMULATED_READING_MUTATION,
  User,
  createApolloClient,
} from "@/lib/graphql";
import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "@/lib/graphql";

type DashboardData = {
  me: User;
  locations: Location[];
  devices: Device[];
};

const scenarios = [
  {
    id: "NORMAL",
    name: "Normal outdoor air",
    description: "Healthy values used as a baseline.",
    expectation: "VALID · NORMAL",
    icon: CheckCircle2,
    tone: "green",
  },
  {
    id: "POLLUTION_SPIKE",
    name: "Particulate pollution",
    description: "High PM2.5 and PM10 from smoke or traffic.",
    expectation: "VALID · WARNING/CRITICAL",
    icon: CloudFog,
    tone: "orange",
  },
  {
    id: "CO2_SPIKE",
    name: "CO2 spike",
    description: "Gas concentration rises above the critical threshold.",
    expectation: "VALID · CRITICAL",
    icon: Gauge,
    tone: "orange",
  },
  {
    id: "SENSOR_DRIFT",
    name: "Sensor drift",
    description: "Multiple measurements gradually deviate from baseline.",
    expectation: "VALID · HIGH ANOMALY",
    icon: BrainCircuit,
    tone: "blue",
  },
  {
    id: "BROKEN_SENSOR",
    name: "Broken sensor",
    description: "Impossible values test Spark data-quality rejection.",
    expectation: "INVALID · REJECTED",
    icon: CircleOff,
    tone: "red",
  },
];

export default function SimulationLabPage() {
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [scenario, setScenario] = useState("NORMAL");
  const [intervalSeconds, setIntervalSeconds] = useState(3);
  const [running, setRunning] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const [lastReading, setLastReading] = useState<AirQualityReading | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const client = useMemo(() => createApolloClient(token), [token]);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setToken(window.localStorage.getItem("iot_auth_token"));
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    const result = await client.query<DashboardData>({
      query: DASHBOARD_QUERY,
      fetchPolicy: "network-only",
    });
    if (result.data) {
      setDashboard(result.data);
      setDeviceId((current) => current || result.data?.devices[0]?.id || "");
    }
  }, [client, token]);

  useEffect(() => {
    if (!token) return;
    const initialTimer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(initialTimer);
  }, [loadDashboard, token]);

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
    socket.on("connect", () => {
      if (deviceId) {
        socket.emit("reading.subscribe", deviceId);
      }
    });
    socket.on("reading.created", (reading: AirQualityReading) => {
      if (reading.deviceId === deviceId) {
        setLastReading(reading);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [deviceId, token]);

  useEffect(() => () => stop(), []);

  const selectedDevice = dashboard?.devices.find(
    (device) => device.id === deviceId,
  );
  const selectedScenario = scenarios.find((item) => item.id === scenario);

  async function publishOnce() {
    if (!selectedDevice) {
      setMessage("Select a sensor first.");
      return;
    }

    await client.mutate({
      mutation: PUBLISH_SIMULATED_READING_MUTATION,
      variables: {
        deviceId: selectedDevice.id,
        locationId: selectedDevice.locationId,
        scenario,
      },
    });
    setPublishedCount((count) => count + 1);
    setMessage(
      scenario === "BROKEN_SENSOR"
        ? "Invalid event published. Spark should reject it and increment invalid records."
        : "Scenario event published to Kafka. Waiting for Spark processing.",
    );
  }

  async function start() {
    try {
      await publishOnce();
      setRunning(true);
      timer.current = setInterval(() => {
        publishOnce().catch((error) => {
          setMessage(error instanceof Error ? error.message : "Publish failed");
          stop();
        });
      }, intervalSeconds * 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Simulation failed");
    }
  }

  function stop() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setRunning(false);
  }

  if (!mounted) {
    return <main className="min-h-screen bg-[#f4f7f5]" />;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7f5] p-6">
        <p className="rounded-lg border bg-white p-6">
          Sign in from the dashboard before opening the simulation lab.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#17211b]">
      <header className="border-b border-[#d7e1db] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">Simulation laboratory</h1>
            <p className="text-sm text-[#62746a]">
              Inject controlled conditions and observe validation, anomalies,
              and alarms.
            </p>
          </div>
          <SiteNav />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-6">
        {message ? (
          <p className="mb-5 rounded-lg border border-[#cddbd2] bg-white p-3 text-sm">
            {message}
          </p>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <section className="rounded-xl border border-[#d5ded8] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-md bg-[#e7f2eb] p-2 text-[#1f6f43]">
                <FlaskConical size={22} />
              </div>
              <div>
                <h2 className="font-semibold">Experiment setup</h2>
                <p className="text-sm text-[#66776d]">
                  Every event is published to the real Kafka topic.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-medium">
                  Sensor to simulate
                </span>
                <select
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  disabled={running}
                  className="h-11 w-full rounded-md border border-[#cbd8d0] bg-white px-3"
                >
                  {(dashboard?.devices ?? []).map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} · {device.externalId}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium">
                  Publish interval
                </span>
                <select
                  value={intervalSeconds}
                  onChange={(event) =>
                    setIntervalSeconds(Number(event.target.value))
                  }
                  disabled={running}
                  className="h-11 w-full rounded-md border border-[#cbd8d0] bg-white px-3"
                >
                  <option value={1}>Every 1 second</option>
                  <option value={3}>Every 3 seconds</option>
                  <option value={5}>Every 5 seconds</option>
                  <option value={10}>Every 10 seconds</option>
                </select>
              </label>
            </div>

            <h3 className="mb-3 mt-6 font-semibold">Scenario</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {scenarios.map((item) => {
                const Icon = item.icon;
                const active = scenario === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setScenario(item.id)}
                    disabled={running}
                    className={`rounded-lg border p-4 text-left transition ${
                      active
                        ? "border-[#1f6f43] bg-[#f2f8f4] ring-2 ring-[#dcece2]"
                        : "border-[#d7e1db] hover:border-[#9eb5a7]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={21} className="mt-0.5 text-[#1f6f43]" />
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="mt-1 text-sm text-[#66776d]">
                          {item.description}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-[#456351]">
                          Expected: {item.expectation}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={running ? stop : start}
                className="flex h-11 items-center gap-2 rounded-md bg-[#1f6f43] px-5 font-medium text-white"
              >
                {running ? <Square size={18} /> : <Play size={18} />}
                {running ? "Stop experiment" : "Start continuous experiment"}
              </button>
              <button
                onClick={() => void publishOnce()}
                disabled={running}
                className="h-11 rounded-md border border-[#1f6f43] px-5 font-medium text-[#1f6f43] disabled:opacity-40"
              >
                Publish one event
              </button>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-xl border border-[#d5ded8] bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Expected Spark response</h2>
              <div className="mt-4 space-y-3">
                <ResultRow
                  icon={<Timer size={18} />}
                  label="Scenario"
                  value={selectedScenario?.name ?? "-"}
                />
                <ResultRow
                  icon={<AlertTriangle size={18} />}
                  label="Expected result"
                  value={selectedScenario?.expectation ?? "-"}
                />
                <ResultRow
                  icon={<Gauge size={18} />}
                  label="Published events"
                  value={publishedCount}
                />
              </div>
            </section>

            <section className="rounded-xl border border-[#d5ded8] bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Latest accepted result</h2>
              {lastReading ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <ValueCard label="AQI" value={lastReading.aqi} />
                  <ValueCard
                    label="CO2"
                    value={`${lastReading.co2} ppm`}
                  />
                  <ValueCard
                    label="Anomaly"
                    value={(lastReading.anomalyScore ?? 0).toFixed(2)}
                  />
                  <ValueCard
                    label="Severity"
                    value={lastReading.alertLevel ?? "NORMAL"}
                  />
                  <ValueCard
                    label="Quality"
                    value={lastReading.qualityStatus ?? "VALID"}
                  />
                  <ValueCard
                    label="Latency"
                    value={`${lastReading.processingLatencyMs ?? 0} ms`}
                  />
                </div>
              ) : (
                <p className="mt-4 rounded-md border border-dashed p-5 text-center text-sm text-[#66776d]">
                  Start an experiment and wait for a Spark-processed event.
                  Broken-sensor events are intentionally absent because they are
                  rejected.
                </p>
              )}
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function ResultRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#e3eae6] pb-3 last:border-0">
      <span className="flex items-center gap-2 text-sm text-[#66776d]">
        {icon}
        {label}
      </span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function ValueCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-[#f2f6f3] p-3">
      <p className="text-xs text-[#66776d]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
