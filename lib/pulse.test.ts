import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bandFor,
  computePulse,
  confidenceWeight,
  scoreFromComponents,
  type PulseIncident,
  type Severity,
  type ReportStatus,
} from "./pulse.ts";

const NOW = new Date("2026-11-09T12:00:00.000Z");

function at(daysAgo: number, hoursAgo = 0): Date {
  return new Date(NOW.getTime() - (daysAgo * 86_400_000 + hoursAgo * 3_600_000));
}

function incident(overrides: Partial<PulseIncident> = {}): PulseIncident {
  return {
    id: overrides.id ?? "inc",
    category: "water_supply",
    severity: "low",
    status: "verified",
    openedAt: at(20),
    acknowledgedAt: at(20, -1),
    verifiedAt: at(20),
    resolvedAt: null,
    reopenedCount: 0,
    locationTag: null,
    confirmationCount: 0,
    isDemo: false,
    ...overrides,
  };
}

function pulse(
  incidents: PulseIncident[],
  extra: { verifiedMembers?: number; includeDemo?: boolean } = {},
) {
  return computePulse({
    incidents,
    verifiedMembers: extra.verifiedMembers ?? 20,
    now: NOW,
    includeDemo: extra.includeDemo ?? false,
  });
}

function onTimeResolved(id: string, location: string | null = null): PulseIncident {
  return incident({
    id,
    locationTag: location,
    openedAt: at(20),
    acknowledgedAt: at(20, -1),
    verifiedAt: at(20),
    resolvedAt: at(18),
    status: "resolved",
  });
}

function lateOpen(
  id: string,
  severity: Severity,
  location: string | null = null,
): PulseIncident {
  return incident({
    id,
    severity,
    locationTag: location,
    status: "verified",
    openedAt: at(10),
    acknowledgedAt: at(7),
    verifiedAt: at(10),
    resolvedAt: null,
  });
}

describe("band edges", () => {
  it("maps every boundary", () => {
    assert.equal(bandFor(0), "healthy");
    assert.equal(bandFor(20), "healthy");
    assert.equal(bandFor(21), "moderate");
    assert.equal(bandFor(40), "moderate");
    assert.equal(bandFor(41), "elevated");
    assert.equal(bandFor(60), "elevated");
    assert.equal(bandFor(61), "critical");
    assert.equal(bandFor(80), "critical");
    assert.equal(bandFor(81), "emergency");
    assert.equal(bandFor(100), "emergency");
  });

  it("rounds the design-pack component values to 42 Elevated", () => {
    const combined = scoreFromComponents([
      { key: "burden", weight: 0.4, value: 46 },
      { key: "resolutionFailure", weight: 0.25, value: 40 },
      { key: "responseDelay", weight: 0.15, value: 33 },
      { key: "recurring", weight: 0.2, value: 45 },
    ]);
    assert.equal(combined.raw, 42.35);
    assert.equal(combined.score, 42);
    assert.equal(bandFor(combined.score!), "elevated");
  });
});

describe("computePulse", () => {
  it("hides the number for an empty room and still lists components", () => {
    const result = pulse([]);
    assert.equal(result.score, null);
    assert.equal(result.band, null);
    assert.equal(result.label, "insufficient");
    assert.equal(result.components.length, 4);
    assert.equal(result.components[0].key, "burden");
    assert.equal(result.components[0].value, 0);
    assert.equal(result.countedIncidents, 0);
  });

  it("stays insufficient below 20 verified members", () => {
    const incidents = Array.from({ length: 6 }, (_, index) =>
      onTimeResolved(`r-${index}`, `place-${index}`),
    );
    const result = pulse(incidents, { verifiedMembers: 19 });
    assert.equal(result.score, null);
    assert.equal(result.label, "insufficient");
    assert.equal(result.countedIncidents, 6);
  });

  it("does not let duplicate confirmations inflate the burden", () => {
    const alone = incident({
      id: "water",
      severity: "high",
      status: "verified",
      confirmationCount: 0,
      openedAt: at(1),
      acknowledgedAt: at(1, -1),
      verifiedAt: at(1),
    });
    const duplicated = { ...alone, confirmationCount: 12 };
    const one = pulse([alone]);
    const manyConfirms = pulse([duplicated]);
    assert.equal(one.components[0].value, manyConfirms.components[0].value);
    assert.equal(one.components[0].value, 30);

    const twoIncidents = pulse([
      alone,
      { ...alone, id: "water-2" },
    ]);
    assert.equal(twoIncidents.components[0].value, 60);

    const submitted = incident({
      id: "open",
      status: "submitted" as ReportStatus,
      severity: "high",
      verifiedAt: null,
      acknowledgedAt: null,
      confirmationCount: 2,
      openedAt: at(1),
    });
    assert.equal(confidenceWeight(submitted), 0);
    assert.equal(pulse([submitted]).components[0].value, 0);
    const reached = { ...submitted, confirmationCount: 3 };
    assert.equal(confidenceWeight(reached), 0.5);
    assert.equal(pulse([reached]).components[0].value, 15);
  });

  it("drops a component with no eligible incidents and marks the score provisional", () => {
    const recent = Array.from({ length: 5 }, (_, index) =>
      incident({
        id: `new-${index}`,
        severity: "high",
        status: "verified",
        openedAt: at(0, 1),
        acknowledgedAt: at(0, 0.5),
        verifiedAt: at(0, 1),
        resolvedAt: null,
      }),
    );
    const result = pulse(recent);
    assert.equal(result.label, "provisional");
    assert.ok(result.dropped.includes("resolutionFailure"));
    assert.ok(result.dropped.includes("responseDelay"));
    assert.ok(result.dropped.includes("recurring"));
    assert.equal(result.components[0].value, 100);
    assert.equal(result.score, 100);
    assert.equal(result.band, "emergency");
  });

  it("scores a fully resolved room at the healthy edge", () => {
    const result = pulse(
      Array.from({ length: 5 }, (_, index) => onTimeResolved(`ok-${index}`, `loc-${index}`)),
    );
    assert.equal(result.score, 0);
    assert.equal(result.band, "healthy");
    assert.equal(result.label, "provisional");
    assert.deepEqual(result.dropped, []);
  });

  it("lands on the moderate edge from burden, delay, resolution, and recurrence", () => {
    const resolved = Array.from({ length: 8 }, (_, index) =>
      onTimeResolved(`ok-${index}`, index < 2 ? `L${index + 1}` : `solo-${index}`),
    );
    const open = [
      lateOpen("bad-1", "low", "L1"),
      lateOpen("bad-2", "low", "L2"),
    ];
    const result = pulse([...resolved, ...open]);
    assert.equal(result.components.find((item) => item.key === "burden")?.value, 20);
    assert.equal(result.components.find((item) => item.key === "resolutionFailure")?.value, 20);
    assert.equal(result.components.find((item) => item.key === "responseDelay")?.value, 20);
    assert.equal(result.components.find((item) => item.key === "recurring")?.value, 25);
    assert.equal(result.score, 21);
    assert.equal(result.band, "moderate");
  });

  it("lands on the elevated edge", () => {
    const resolved = Array.from({ length: 5 }, (_, index) =>
      onTimeResolved(`ok-${index}`, `solo-${index}`),
    );
    const open = Array.from({ length: 5 }, (_, index) =>
      lateOpen(`bad-${index}`, "medium", `bad-${index}`),
    );
    const result = pulse([...resolved, ...open]);
    assert.equal(result.score, 60);
    assert.equal(result.band, "elevated");
  });

  it("lands in critical and at the emergency edge", () => {
    const critical = pulse([
      ...Array.from({ length: 2 }, (_, index) => onTimeResolved(`ok-${index}`, `solo-${index}`)),
      ...Array.from({ length: 8 }, (_, index) => lateOpen(`bad-${index}`, "low", `bad-${index}`)),
    ]);
    assert.equal(critical.score, 64);
    assert.equal(critical.band, "critical");

    const emergency = pulse(
      Array.from({ length: 5 }, (_, index) =>
        lateOpen(`crit-${index}`, "critical", `c-${index}`),
      ),
    );
    assert.equal(emergency.score, 100);
    assert.equal(emergency.band, "emergency");
  });

  it("excludes demo rows unless the flag is on", () => {
    const demo = Array.from({ length: 5 }, (_, index) =>
      lateOpen(`d-${index}`, "critical", `d-${index}`),
    ).map((row) => ({ ...row, isDemo: true }));
    assert.equal(pulse(demo).label, "insufficient");
    assert.equal(pulse(demo).score, null);
    const included = pulse(demo, { includeDemo: true });
    assert.equal(included.includesDemo, true);
    assert.equal(included.score, 100);
  });
});
