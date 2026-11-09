import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FACULTIES, LEVELS, STUDENT_DEPARTMENTS } from "./campus.ts";
import {
  googleDisplayName,
  initials,
  needsRegistration,
  safeNext,
  validateRegistration,
} from "./registration.ts";

const valid = {
  fullName: "Adebola Adeyemi",
  faculty: FACULTIES[0],
  department: STUDENT_DEPARTMENTS[0],
  level: LEVELS[0],
  matricNumber: "",
};

describe("safeNext", () => {
  it("keeps an in-app path and falls back otherwise", () => {
    assert.equal(safeNext("/admin/funaab"), "/admin/funaab");
    assert.equal(safeNext("/room/funaab/pulse"), "/room/funaab/pulse");
    assert.equal(safeNext(null), "/room/funaab");
    assert.equal(safeNext("https://evil.example"), "/room/funaab");
    assert.equal(safeNext("//evil.example"), "/room/funaab");
    assert.equal(safeNext("/register?next=/room/funaab"), "/room/funaab");
    assert.equal(safeNext("/auth/callback"), "/room/funaab");
  });
});

describe("google profile helpers", () => {
  it("prefers full_name, then name, then the email local part", () => {
    assert.equal(googleDisplayName({ full_name: "Ada Lovelace", name: "Ada" }), "Ada Lovelace");
    assert.equal(googleDisplayName({ name: "Ada Lovelace" }), "Ada Lovelace");
    assert.equal(googleDisplayName({}, "a.adeyemi@gmail.com"), "a.adeyemi");
  });

  it("builds initials from the first two name parts", () => {
    assert.equal(initials("Adebola Adeyemi"), "AA");
    assert.equal(initials("Ada"), "AD");
    assert.equal(initials("", "a.adeyemi@gmail.com"), "AA");
  });
});

describe("needsRegistration", () => {
  it("sends a signed-in user without registered_at to the form", () => {
    assert.equal(needsRegistration(null), true);
    assert.equal(needsRegistration({ registered_at: null, verification_status: "pending" }), true);
    assert.equal(needsRegistration({ registered_at: "2026-11-09", verification_status: "verified" }), false);
    assert.equal(needsRegistration({ registered_at: null, verification_status: "verified" }), false);
    assert.equal(needsRegistration({ registered_at: null, verification_status: "rejected" }), false);
  });
});

describe("validateRegistration", () => {
  it("accepts a complete profile and an empty matric number", () => {
    const result = validateRegistration(valid);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.fullName, "Adebola Adeyemi");
      assert.equal(result.value.faculty, FACULTIES[0]);
      assert.equal(result.value.level, "100");
      assert.equal(result.value.matricNumber, null);
    }
  });

  it("keeps an optional matric number", () => {
    const result = validateRegistration({ ...valid, matricNumber: "  2019/1234  " });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.matricNumber, "2019/1234");
  });

  it("rejects a faculty or level outside the config list", () => {
    assert.equal(validateRegistration({ ...valid, faculty: "Made up college" }).ok, false);
    assert.equal(validateRegistration({ ...valid, department: "History" }).ok, false);
    assert.equal(validateRegistration({ ...valid, level: "600" }).ok, false);
    assert.equal(validateRegistration({ ...valid, fullName: "A" }).ok, false);
    assert.equal(validateRegistration({ ...valid, matricNumber: "x".repeat(41) }).ok, false);
  });
});
