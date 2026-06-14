"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Cloud,
  Gauge,
  MapPin,
  Navigation,
  Thermometer,
  Wifi,
} from "lucide-react";
import { SiteNav } from "@/app/components/site-nav";
import {
  AirQualityReading,
  DASHBOARD_QUERY,
  Device,
  LATEST_READING_QUERY,
  Location,
  User,
  createApolloClient,
  SOCKET_URL,
} from "@/lib/graphql";
import { io, type Socket } from "socket.io-client";

type DashboardData = {
  me: User;
  locations: Location[];
  devices: Device[];
};

export default function StationMapPage() {
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [readings, setReadings] = useState<
    Record<string, AirQualityReading | null>
  >({});
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const client = useMemo(() => createApolloClient(token), [token]);
  const deviceSubscriptionKey =
    dashboard?.devices.map((device) => device.id).join(",") ?? "";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToken(window.localStorage.getItem("iot_auth_token"));
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const result = await client.query<DashboardData>({
        query: DASHBOARD_QUERY,
        fetchPolicy: "network-only",
      });
      const data = result.data;

      if (!data) {
        throw new Error("Could not load stations");
      }

      setDashboard(data);
      setSelectedLocationId((current) => current || data.locations[0]?.id || "");

      const entries = await Promise.all(
        data.devices.map(async (device) => {
          const readingResult = await client.query<{
            latestReadingByDevice: AirQualityReading | null;
          }>({
            query: LATEST_READING_QUERY,
            variables: { deviceId: device.id },
            fetchPolicy: "network-only",
          });
          return [
            device.id,
            readingResult.data?.latestReadingByDevice ?? null,
          ] as const;
        }),
      );
      setReadings((current) => mergeMapReadings(current, entries));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Map failed to load");
    }
  }, [client, token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const timer = window.setTimeout(() => void loadData(), 0);
    const refresh = window.setInterval(() => void loadData(), 2000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(refresh);
    };
  }, [loadData, token]);

  useEffect(() => {
    if (!token || !deviceSubscriptionKey) {
      return;
    }

    const socket: Socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
    socket.on("connect", () => {
      deviceSubscriptionKey.split(",").forEach((deviceId) => {
        socket.emit("reading.subscribe", deviceId);
      });
    });
    socket.on("reading.created", (reading: AirQualityReading) => {
      setReadings((current) =>
        mergeMapReadings(current, [
          [String(reading.deviceId), normalizeMapReading(reading)],
        ]),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [deviceSubscriptionKey, token]);

  if (!mounted) {
    return <main className="min-h-screen bg-[#f4f7f5]" />;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7f5] p-6">
        <p className="rounded-lg border bg-white p-6">
          Sign in from the dashboard before opening the station map.
        </p>
      </main>
    );
  }

  const selectedLocation = dashboard?.locations.find(
    (location) => location.id === selectedLocationId,
  );
  const selectedDevices =
    dashboard?.devices.filter(
      (device) => device.locationId === selectedLocationId,
    ) ?? [];
  const bounds = calculateBounds(dashboard?.locations ?? []);

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#17211b]">
      <header className="border-b border-[#d7e1db] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">Station map</h1>
            <p className="text-sm text-[#62746a]">
              Click a pin to inspect its sensors and latest Spark result.
            </p>
          </div>
          <SiteNav />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-6">
        {message ? (
          <p className="mb-5 rounded-md border border-[#e7c9c4] bg-[#fff2f0] p-3 text-sm text-[#9a3528]">
            {message}
          </p>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <section className="overflow-hidden rounded-xl border border-[#ccd9d1] bg-[#dfece5] shadow-sm">
            <div className="relative min-h-[650px] bg-[radial-gradient(circle_at_25%_20%,#f8fbf9_0_3%,transparent_4%),linear-gradient(145deg,#dcebe3,#edf5f0)]">
              <svg
                aria-label="Air quality station map"
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 900 650"
              >
                <path
                  d="M0 125 C180 80 280 180 430 120 S720 50 900 130"
                  fill="none"
                  stroke="#b7cdc0"
                  strokeWidth="18"
                />
                <path
                  d="M120 650 C150 510 260 470 350 360 S520 185 610 0"
                  fill="none"
                  stroke="#c5d8cd"
                  strokeWidth="12"
                />
                <path
                  d="M0 470 C190 430 340 520 510 445 S760 330 900 370"
                  fill="none"
                  stroke="#f8fbf9"
                  strokeWidth="8"
                />
                {[150, 300, 450, 600, 750].map((x) => (
                  <line
                    key={x}
                    x1={x}
                    x2={x + 90}
                    y1="0"
                    y2="650"
                    stroke="#d1e0d7"
                    strokeWidth="2"
                  />
                ))}
              </svg>

              {(dashboard?.locations ?? []).map((location) => {
                const point = projectLocation(location, bounds);
                const devices =
                  dashboard?.devices.filter(
                    (device) => device.locationId === location.id,
                  ) ?? [];
                const worstSeverity = getWorstSeverity(
                  devices.map((device) => readings[device.id]?.alertLevel),
                );

                return (
                  <button
                    key={location.id}
                    onClick={() => setSelectedLocationId(location.id)}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-full text-left"
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full border-4 border-white shadow-lg ${
                        worstSeverity === "CRITICAL"
                          ? "bg-[#c53b31] text-white"
                          : worstSeverity === "WARNING"
                            ? "bg-[#d9831f] text-white"
                            : "bg-[#1f6f43] text-white"
                      }`}
                    >
                      <MapPin size={24} />
                    </span>
                    {location.id === selectedLocationId ? (
                      <span className="mt-1 block min-w-max -translate-x-1/4 rounded-md bg-white px-2 py-1 text-xs font-semibold shadow">
                        {location.name} · {devices.length}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              {!dashboard?.locations.length ? (
                <div className="absolute inset-0 flex items-center justify-center text-[#61756a]">
                  No stations have been created.
                </div>
              ) : null}
            </div>
          </section>

          <aside className="rounded-xl border border-[#d5ded8] bg-white p-5 shadow-sm">
            {selectedLocation ? (
              <>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedLocation.name}
                    </h2>
                    <p className="text-sm text-[#66776d]">
                      {[selectedLocation.city, selectedLocation.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                  <Navigation className="text-[#1f6f43]" size={22} />
                </div>
                <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
                  <Coordinate label="Latitude" value={selectedLocation.latitude} />
                  <Coordinate
                    label="Longitude"
                    value={selectedLocation.longitude}
                  />
                </div>
                <h3 className="mb-3 font-semibold">
                  Sensors at this station ({selectedDevices.length})
                </h3>
                <div className="space-y-3">
                  {selectedDevices.map((device) => (
                    <SensorDetail
                      key={device.id}
                      device={device}
                      reading={readings[device.id]}
                    />
                  ))}
                  {!selectedDevices.length ? (
                    <p className="rounded-md border border-dashed p-5 text-center text-sm text-[#66776d]">
                      No sensors assigned to this station.
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <p>Select a station pin.</p>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function SensorDetail({
  device,
  reading,
}: {
  device: Device;
  reading: AirQualityReading | null | undefined;
}) {
  return (
    <article className="rounded-lg border border-[#d9e2dc] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">{device.name}</h4>
          <p className="text-xs text-[#66776d]">{device.externalId}</p>
        </div>
        <Wifi size={18} className="text-[#1f6f43]" />
      </div>
      {reading ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniMetric icon={<Gauge size={15} />} label="AQI" value={reading.aqi} />
            <MiniMetric
              icon={<Cloud size={15} />}
              label="PM2.5"
              value={reading.pm25}
            />
            <MiniMetric
              icon={<Activity size={15} />}
              label="CO2"
              value={reading.co2}
            />
            <MiniMetric
              icon={<Thermometer size={15} />}
              label="Temp"
              value={`${reading.temperature.toFixed(1)}°`}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-[#66776d]">
              {new Date(reading.timestamp).toLocaleString()}
            </span>
            <span className="font-semibold">{reading.alertLevel ?? "NORMAL"}</span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-[#66776d]">Waiting for data.</p>
      )}
    </article>
  );
}

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md bg-[#f2f6f3] p-2">
      <div className="flex items-center gap-1 text-xs text-[#61756a]">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Coordinate({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-[#f2f6f3] p-3">
      <p className="text-xs text-[#66776d]">{label}</p>
      <p className="font-semibold">{value.toFixed(4)}</p>
    </div>
  );
}

function calculateBounds(locations: Location[]) {
  if (!locations.length) {
    return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
  }
  const lats = locations.map((location) => location.latitude);
  const lngs = locations.map((location) => location.longitude);
  return {
    minLat: Math.min(...lats) - 0.01,
    maxLat: Math.max(...lats) + 0.01,
    minLng: Math.min(...lngs) - 0.01,
    maxLng: Math.max(...lngs) + 0.01,
  };
}

function projectLocation(
  location: Location,
  bounds: ReturnType<typeof calculateBounds>,
) {
  const x =
    12 +
    ((location.longitude - bounds.minLng) /
      Math.max(bounds.maxLng - bounds.minLng, 0.001)) *
      76;
  const y =
    88 -
    ((location.latitude - bounds.minLat) /
      Math.max(bounds.maxLat - bounds.minLat, 0.001)) *
      76;
  return { x, y };
}

function getWorstSeverity(levels: Array<string | null | undefined>) {
  if (levels.includes("CRITICAL")) return "CRITICAL";
  if (levels.includes("WARNING")) return "WARNING";
  return "NORMAL";
}

function normalizeMapReading(reading: AirQualityReading) {
  return {
    ...reading,
    deviceId: String(reading.deviceId),
    locationId: String(reading.locationId),
    timestamp: new Date(reading.timestamp).toISOString(),
  };
}

function mergeMapReadings(
  current: Record<string, AirQualityReading | null>,
  entries: ReadonlyArray<readonly [string, AirQualityReading | null]>,
) {
  const next = { ...current };

  for (const [deviceId, reading] of entries) {
    if (!reading) {
      if (!(deviceId in next)) next[deviceId] = null;
      continue;
    }

    const normalized = normalizeMapReading(reading);
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
