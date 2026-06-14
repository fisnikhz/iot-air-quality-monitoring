import { io } from "socket.io-client";

const graphqlUrl =
  process.env.GRAPHQL_URL ?? "http://localhost:3000/graphql";
const socketUrl = process.env.SOCKET_URL ?? "http://localhost:3000";
const email = process.env.DEMO_EMAIL ?? "fisnik@example.com";
const password = process.env.DEMO_PASSWORD ?? "password123";

const login = await graphql(
  `mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) { accessToken }
  }`,
  { email, password },
);
const token = login.login.accessToken;
const dashboard = await graphql(
  `query ReadinessDashboard {
    locations { id name latitude longitude }
    devices { id name externalId locationId status metrics }
  }`,
  {},
  token,
);

assert(dashboard.locations.length >= 3, "Expected at least three map locations");
assert(dashboard.devices.length >= 3, "Expected at least three seeded sensors");
assert(
  dashboard.devices.every((device) => device.metrics.length >= 6),
  "Every sensor must expose complete metric metadata",
);

const device = dashboard.devices[0];
const socketReading = waitForSocketReading(device.id);
const baseline = await latestReading(device.id, token);

await publish(device, "NORMAL", token);
const normal = await waitFor(
  async () => {
    const reading = await latestReading(device.id, token);
    return isNewer(reading, baseline) ? reading : null;
  },
  "normal reading to reach Cassandra",
);
assert(normal.qualityStatus === "VALID", "Normal reading was not marked VALID");

await publish(device, "POLLUTION_SPIKE", token);
const pollution = await waitFor(
  async () => {
    const reading = await latestReading(device.id, token);
    return isNewer(reading, normal) && reading.alertLevel !== "NORMAL"
      ? reading
      : null;
  },
  "pollution alert to reach Cassandra",
);
assert(
  ["WARNING", "CRITICAL"].includes(pollution.alertLevel),
  "Pollution scenario did not create an alert",
);

const live = await socketReading;
assert(live.deviceId === device.id, "Socket delivered the wrong device");

await publish(device, "BROKEN_SENSOR", token);
const brokenMetrics = await waitFor(
  async () => {
    const analytics = await deviceAnalytics(device.id, token);
    return analytics.pipelineMetrics?.invalidRecords > 0 ? analytics : null;
  },
  "broken sensor rejection metric",
);
const latestAfterBroken = await latestReading(device.id, token);
assert(
  latestAfterBroken.timestamp === pollution.timestamp,
  "Broken sensor reading was incorrectly stored as the latest valid reading",
);
assert(
  brokenMetrics.alertsByDevice.length > 0,
  "No persisted anomaly alert was found",
);
assert(
  brokenMetrics.aggregatesByDevice.length > 0,
  "No rolling aggregate was produced",
);

console.log("Readiness verification passed:");
console.log(`- ${dashboard.locations.length} map locations`);
console.log(
  `- ${dashboard.devices.length} registered sensors with complete metric definitions`,
);
console.log("- Kafka -> Spark -> Cassandra normal reading");
console.log(`- anomaly classified as ${pollution.alertLevel}`);
console.log("- broken sensor rejected and counted");
console.log("- Socket.IO live reading received");
console.log("- alerts, aggregates, and performance metrics available");

async function publish(target, scenario, authToken) {
  const data = await graphql(
    `mutation Publish($deviceId: String!, $locationId: String!, $scenario: String) {
      publishSimulatedReading(
        deviceId: $deviceId
        locationId: $locationId
        scenario: $scenario
      )
    }`,
    {
      deviceId: target.id,
      locationId: target.locationId,
      scenario,
    },
    authToken,
  );
  assert(data.publishSimulatedReading, `Could not publish ${scenario}`);
}

async function latestReading(deviceId, authToken) {
  const data = await graphql(
    `query Latest($deviceId: String!) {
      latestReadingByDevice(deviceId: $deviceId) {
        deviceId locationId timestamp aqi anomalyScore alertLevel qualityStatus
        processingLatencyMs
      }
    }`,
    { deviceId },
    authToken,
  );
  return data.latestReadingByDevice;
}

async function deviceAnalytics(deviceId, authToken) {
  return graphql(
    `query Analytics($input: ReadingsFilterInput!) {
      alertsByDevice(input: $input) { timestamp alertLevel message }
      aggregatesByDevice(input: $input) { windowStart sampleCount avgAqi maxAqi }
      pipelineMetrics {
        recordsProcessed invalidRecords alertsGenerated avgLatencyMs maxLatencyMs
      }
    }`,
    {
      input: {
        id: deviceId,
        day: new Date().toISOString().slice(0, 10),
        limit: 50,
      },
    },
    authToken,
  );
}

function waitForSocketReading(deviceId) {
  return new Promise((resolve, reject) => {
    const socket = io(socketUrl, {
      transports: ["polling", "websocket"],
      timeout: 10000,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out waiting for a Socket.IO live reading"));
    }, 45000);

    socket.on("connect", () => {
      socket.emit("reading.subscribe", deviceId);
    });
    socket.on("reading.created", finish);
    socket.on("reading.device", finish);
    socket.on("connect_error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });

    function finish(reading) {
      if (reading.deviceId !== deviceId) {
        return;
      }
      clearTimeout(timer);
      socket.close();
      resolve(reading);
    }
  });
}

async function graphql(query, variables, authToken) {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();

  if (!response.ok || payload.errors) {
    throw new Error(
      payload.errors?.map((error) => error.message).join("; ") ??
        `GraphQL request failed with HTTP ${response.status}`,
    );
  }
  return payload.data;
}

async function waitFor(check, description, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(
    `Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`,
  );
}

function isNewer(reading, previous) {
  return (
    reading &&
    (!previous ||
      new Date(reading.timestamp).getTime() >
        new Date(previous.timestamp).getTime())
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
