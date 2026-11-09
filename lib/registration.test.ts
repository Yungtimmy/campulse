import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COLLEGES, collegeLabel, departmentsFor } from "./campus.ts";
import {
  googleDisplayName,
  initials,
  needsRegistration,
  safeNext,
  validateRegistration,
} from "./registration.ts";

const coleng = COLLEGES.find((college) => college.acronym === "COLENG")!;
const colcomps = COLLEGES.find((college) => college.acronym === "COLCOMPS")!;
const colphys = COLLEGES.find((college) => college.acronym === "COLPHYS")!;
const colbios = COLLEGES.find((college) => college.acronym === "COLBIOS")!;
const colvet = COLLEGES.find((college) => college.acronym === "COLVET")!;
const colfhec = COLLEGES.find((college) => college.acronym === "COLFHEC")!;

const valid = {
  fullName: "Adebola Adeyemi",
  faculty: collegeLabel(coleng),
  department: "Mechanical Engineering",
  level: "100",
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

describe("FUNAAB colleges", () => {
  it("lists 11 colleges and 57 departments, with Computer Science only in COLCOMPS", () => {
    const departments = COLLEGES.flatMap((college) => [...college.departments]);
    assert.equal(COLLEGES.length, 11);
    assert.equal(departments.length, 57);
    assert.equal(new Set(departments).size, 57);
    assert.deepEqual(departmentsFor(collegeLabel(colcomps)), [
      "Computer Science",
      "Information Systems",
      "Software Engineering",
      "Cybersecurity",
      "Data Science",
      "Information Technology",
      "Information and Communication Technology",
    ]);
    assert.equal(colphys.departments.includes("Computer Science" as never), false);
    assert.equal(colcomps.levels, "100-400");
  });
});

describe("validateRegistration", () => {
  it("accepts a complete profile and an empty matric number", () => {
    const result = validateRegistration(valid);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.fullName, "Adebola Adeyemi");
      assert.equal(result.value.faculty, collegeLabel(coleng));
      assert.equal(result.value.level, "100");
      assert.equal(result.value.matricNumber, null);
    }
  });

  it("keeps an optional matric number", () => {
    const result = validateRegistration({ ...valid, matricNumber: "  2019/1234  " });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.matricNumber, "2019/1234");
  });

  it("rejects a college, department, or level outside the config list", () => {
    assert.equal(validateRegistration({ ...valid, faculty: "Made up college" }).ok, false);
    assert.equal(validateRegistration({ ...valid, department: "History" }).ok, false);
    assert.equal(validateRegistration({ ...valid, level: "600" }).ok, false);
    assert.equal(validateRegistration({ ...valid, fullName: "A" }).ok, false);
    assert.equal(validateRegistration({ ...valid, matricNumber: "x".repeat(41) }).ok, false);
  });

  it("accepts only a department that belongs to the chosen college, at a level that college runs", () => {
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(coleng),
        department: "Computer Science",
        level: "100",
      }).ok,
      false,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colcomps),
        department: "Computer Science",
        level: "400",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colcomps),
        department: "Cybersecurity",
        level: "500",
      }).ok,
      false,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colcomps),
        department: "Data Science",
        level: "100",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colcomps),
        department: "Information Systems",
        level: "200",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colcomps),
        department: "Software Engineering",
        level: "300",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colcomps),
        department: "Information Technology",
        level: "400",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colcomps),
        department: "Information and Communication Technology",
        level: "400",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colcomps),
        department: "Cyber Security and Data Science",
        level: "100",
      }).ok,
      false,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colbios),
        department: "Biochemistry",
        level: "400",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colbios),
        department: "Biochemistry",
        level: "500",
      }).ok,
      false,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colvet),
        department: "Veterinary Anatomy",
        level: "600",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colfhec),
        department: "Food Science and Technology",
        level: "500",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colfhec),
        department: "Hospitality and Tourism Management",
        level: "500",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colfhec),
        department: "Home Science and Management",
        level: "400",
      }).ok,
      true,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colfhec),
        department: "Home Science and Management",
        level: "500",
      }).ok,
      false,
    );
    assert.equal(
      validateRegistration({
        ...valid,
        faculty: collegeLabel(colfhec),
        department: "Nutrition and Dietetics",
        level: "500",
      }).ok,
      false,
    );
  });
});
