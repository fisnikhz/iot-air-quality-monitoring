"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Cloud,
  Gauge,
  Loader2,
  LogIn,
  MapPin,
  Play,
  Radio,
  Square,
  Thermometer,
  Wifi,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import {
  AirQualityReading,
  CREATE_READING_MUTATION,
  DASHBOARD_QUERY,
  Device,
  GRAPHQL_URL,
  LATEST_READING_QUERY,
  Location,
  LOGIN_MUTATION,
  SOCKET_URL,
  User,
  createApolloClient,
} from "@/lib/graphql";

type DashboardData = {
  me: User;
  locations: Location[];
  devices: Device[];
};

type ReadingState = Record<string, AirQualityReading | null>;

export default function Home() {
  const [email, setEmail] = useState("fisnik@example.com");
  const [password, setPassword] = useState("password123");
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem("iot_auth_token");
  });
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [readings, setReadings] = useState<ReadingState>({});
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const simulationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const client = useMemo(() => createApolloClient(token), [token]);
  const selectedDevice = dashboard?.devices.find(
    (device) => device.id === selectedDeviceId,
  );

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

      setReadings(Object.fromEntries(entries));
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
      const timeout = window.setTimeout(() => {
        loadDashboard();
      }, 0);

      return () => window.clearTimeout(timeout);
    }
  }, [dashboard, loadDashboard, loading, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("reading.created", (reading: AirQualityReading) => {
      setReadings((current) => ({
        ...current,
        [reading.deviceId]: reading,
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    return () => stopSimulation();
  }, []);

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

  async function emitSimulatedReading(device: Device) {
    const reading = createOutdoorReading();

    await client.mutate({
      mutation: CREATE_READING_MUTATION,
      variables: {
        input: {
          deviceId: device.id,
          locationId: device.locationId,
          ...reading,
        },
      },
    });
  }

  async function startSimulation() {
    if (!selectedDevice) {
      setMessage("Create or select a device before starting simulation");
      return;
    }

    setMessage(null);
    await emitSimulatedReading(selectedDevice);
    setSimulationRunning(true);
    simulationTimer.current = setInterval(() => {
      emitSimulatedReading(selectedDevice).catch((error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Simulation failed to emit a reading",
        );
        stopSimulation();
      });
    }, 3000);
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

  if (!token) {
    return (
      <main className="min-h-screen bg-[#f4f7f5] text-[#17211b]">
        <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
          <div className="grid w-full gap-8 lg:grid-cols-[1fr_420px]">
            <div className="flex flex-col justify-center">
              <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-[#c8d8cd] bg-white px-3 py-1 text-sm text-[#42604d]">
                <Wifi size={16} />
                Air-quality monitoring
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-[#102117]">
                Live outdoor sensor dashboard
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#52655a]">
                Sign in to monitor field devices, inspect current readings, and control a local sensor simulation.
              </p>
            </div>

            <form
              onSubmit={login}
              className="rounded-lg border border-[#d5ded8] bg-white p-6 shadow-sm"
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

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#17211b]">
      <header className="border-b border-[#d7e1db] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">Air Quality Monitor</h1>
            <p className="text-sm text-[#62746a]">
              {dashboard?.me.name ?? "Dashboard"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill
              active={socketConnected}
              label={socketConnected ? "Live socket" : "Socket offline"}
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

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            icon={<MapPin size={20} />}
            label="Locations"
            value={dashboard?.locations.length ?? 0}
          />
          <SummaryCard
            icon={<Wifi size={20} />}
            label="Devices"
            value={dashboard?.devices.length ?? 0}
          />
          <SummaryCard
            icon={<Radio size={20} />}
            label="Streaming"
            value={simulationRunning ? "On" : "Idle"}
          />
        </div>

        <section className="mt-6 rounded-lg border border-[#d5ded8] bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <label>
              <span className="mb-2 block text-sm font-medium">Simulation device</span>
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
              {simulationRunning ? "Stop simulation" : "Start simulation"}
            </button>
          </div>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {(dashboard?.devices ?? []).map((device) => {
            const reading = readings[device.id];
            const location = dashboard?.locations.find(
              (item) => item.id === device.locationId,
            );

            return (
              <article
                key={device.id}
                className="rounded-lg border border-[#d5ded8] bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{device.name}</h2>
                    <p className="text-sm text-[#66776d]">
                      {location?.name ?? "Unknown location"} · {device.status}
                    </p>
                  </div>
                  <span className="rounded-md bg-[#e7f2eb] px-2 py-1 text-sm font-medium text-[#1f6f43]">
                    {device.externalId}
                  </span>
                </div>

                {reading ? (
                  <>
                    <div className="mb-3 text-xs text-[#66776d]">
                      {new Date(reading.timestamp).toLocaleString()}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Metric icon={<Gauge size={18} />} label="AQI" value={reading.aqi} />
                      <Metric icon={<Cloud size={18} />} label="PM2.5" value={reading.pm25} />
                      <Metric icon={<Cloud size={18} />} label="PM10" value={reading.pm10} />
                      <Metric icon={<Activity size={18} />} label="CO2" value={reading.co2} />
                      <Metric icon={<Thermometer size={18} />} label="Temp" value={`${reading.temperature}C`} />
                      <Metric icon={<Activity size={18} />} label="Humidity" value={`${reading.humidity}%`} />
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed border-[#cbd8d0] px-4 py-8 text-center text-sm text-[#66776d]">
                    Waiting for a live reading
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function createOutdoorReading() {
  const pm25 = round(randomBetween(4, 38));
  const pm10 = round(pm25 + randomBetween(6, 32));
  const co2 = round(randomBetween(380, 720));
  const temperature = round(randomBetween(5, 34));
  const humidity = round(randomBetween(30, 85));

  return {
    pm25,
    pm10,
    co2,
    temperature,
    humidity,
    aqi: calculateAqi(pm25, pm10),
  };
}

function calculateAqi(pm25: number, pm10: number) {
  const pm25Score = (pm25 / 35.4) * 100;
  const pm10Score = (pm10 / 154) * 100;
  return Math.max(1, Math.round(Math.max(pm25Score, pm10Score)));
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="mb-5 rounded-md border border-[#e7c9c4] bg-[#fff2f0] px-3 py-2 text-sm text-[#9a3528]">
      {message}
    </p>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-[#d5ded8] bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-[#e7f2eb] text-[#1f6f43]">
        {icon}
      </div>
      <p className="text-sm text-[#66776d]">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
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
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
