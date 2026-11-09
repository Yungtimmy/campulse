/**
 * Demo campus lists for the registration form.
 * Replace these arrays with the real FUNAAB faculties and departments
 * when that list is ready. Levels stay 100–500 plus Postgraduate.
 */

export const UNIVERSITY = {
  slug: "funaab",
  shortName: "FUNAAB",
  name: "Federal University of Agriculture, Abeokuta",
} as const;

export const FACULTIES = [
  "College of Engineering (demo)",
  "College of Natural Sciences (demo)",
  "College of Agricultural Management (demo)",
] as const;

export const STUDENT_DEPARTMENTS = [
  "Computer Science (demo)",
  "Mechanical Engineering (demo)",
  "Microbiology (demo)",
] as const;

export const LEVELS = ["100", "200", "300", "400", "500", "Postgraduate"] as const;

export type Faculty = (typeof FACULTIES)[number];
export type StudentDepartment = (typeof STUDENT_DEPARTMENTS)[number];
export type Level = (typeof LEVELS)[number];
