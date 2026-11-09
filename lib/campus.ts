/**
 * FUNAAB colleges and departments for registration.
 * Checked 9 Nov 2026: 11 colleges and 57 departments.
 * COLCOMPS departments are the founder's list of 7. Computer Science sits only there.
 * The profile column is still named faculty. Stored values look like
 * "College of Engineering (COLENG)".
 * Programmes are not offered on the form.
 * Levels: 100–400 for COLBIOS, COLPHYS, COLENDS and COLCOMPS;
 * 100–500 for COLAMRUD, COLANIM, COLPLANT, COLERM and COLENG;
 * 100–600 for COLVET. COLFHEC follows the department.
 */

export const UNIVERSITY = {
  slug: "funaab",
  shortName: "FUNAAB",
  name: "Federal University of Agriculture, Abeokuta",
} as const;

const LEVEL_LADDER = ["100", "200", "300", "400", "500", "600"] as const;

export type Level = (typeof LEVEL_LADDER)[number];
type LevelSpan = "100-400" | "100-500" | "100-600";

const LEVELS_BY_SPAN: Record<LevelSpan, readonly Level[]> = {
  "100-400": LEVEL_LADDER.slice(0, 4),
  "100-500": LEVEL_LADDER.slice(0, 5),
  "100-600": LEVEL_LADDER.slice(0, 6),
};

export const COLLEGES = [
  {
    name: "College of Agricultural Management and Rural Development",
    acronym: "COLAMRUD",
    levels: "100-500",
    departments: [
      "Agricultural Administration",
      "Agricultural Economics and Farm Management",
      "Agricultural Extension and Rural Development",
    ],
  },
  {
    name: "College of Animal Science and Livestock Production",
    acronym: "COLANIM",
    levels: "100-500",
    departments: [
      "Animal Breeding and Genetics",
      "Animal Nutrition",
      "Animal Physiology",
      "Animal Production and Health",
      "Pasture and Range Management",
    ],
  },
  {
    name: "College of Biosciences",
    acronym: "COLBIOS",
    levels: "100-400",
    departments: [
      "Biochemistry",
      "Microbiology",
      "Pure and Applied Botany",
      "Pure and Applied Zoology",
    ],
  },
  {
    name: "College of Computing Sciences",
    acronym: "COLCOMPS",
    levels: "100-400",
    departments: [
      "Computer Science",
      "Information Systems",
      "Software Engineering",
      "Cybersecurity",
      "Data Science",
      "Information Technology",
      "Information and Communication Technology",
    ],
  },
  {
    name: "College of Engineering",
    acronym: "COLENG",
    levels: "100-500",
    departments: [
      "Agricultural and Bio-Resources Engineering",
      "Civil Engineering",
      "Electrical and Electronics Engineering",
      "Mechanical Engineering",
      "Mechatronics Engineering",
    ],
  },
  {
    name: "College of Entrepreneurial and Development Studies",
    acronym: "COLENDS",
    levels: "100-400",
    departments: [
      "Accounting",
      "Banking and Finance",
      "Business Administration",
      "Economics",
      "Entrepreneurial Studies",
      "Library and Information Science",
    ],
  },
  {
    name: "College of Environmental Resources Management",
    acronym: "COLERM",
    levels: "100-500",
    departments: [
      "Aquaculture and Fisheries Management",
      "Environmental Management and Toxicology",
      "Forestry and Wildlife Management",
      "Geology",
      "Water Resources Management and Agrometeorology",
    ],
  },
  {
    name: "College of Food Sciences and Human Ecology",
    acronym: "COLFHEC",
    levels: "100-500",
    departmentLevels: {
      "Food Science and Technology": "100-500",
      "Hospitality and Tourism Management": "100-500",
      "Home Science and Management": "100-400",
      "Nutrition and Dietetics": "100-400",
    },
    departments: [
      "Food Science and Technology",
      "Home Science and Management",
      "Hospitality and Tourism Management",
      "Nutrition and Dietetics",
    ],
  },
  {
    name: "College of Physical Sciences",
    acronym: "COLPHYS",
    levels: "100-400",
    departments: ["Chemistry", "Mathematics", "Physics", "Statistics"],
  },
  {
    name: "College of Plant Science and Crop Production",
    acronym: "COLPLANT",
    levels: "100-500",
    departments: [
      "Crop Protection",
      "Horticulture",
      "Plant Breeding and Seed Technology",
      "Plant Physiology and Crop Production",
      "Soil Science and Land Management",
    ],
  },
  {
    name: "College of Veterinary Medicine",
    acronym: "COLVET",
    levels: "100-600",
    departments: [
      "Veterinary Anatomy",
      "Veterinary Medicine",
      "Veterinary Microbiology",
      "Veterinary Parasitology and Entomology",
      "Veterinary Pathology",
      "Veterinary Pharmacology and Toxicology",
      "Veterinary Physiology and Biochemistry",
      "Veterinary Public Health and Preventive Medicine",
      "Veterinary Surgery and Theriogenology",
    ],
  },
] as const;

export type College = (typeof COLLEGES)[number];
export type Faculty = `${College["name"]} (${College["acronym"]})`;
export type StudentDepartment = College["departments"][number];

export function collegeLabel(college: College): Faculty {
  return `${college.name} (${college.acronym})` as Faculty;
}

export function collegeForFaculty(faculty: string): College | undefined {
  return COLLEGES.find((college) => collegeLabel(college) === faculty);
}

export function departmentsFor(faculty: string): readonly StudentDepartment[] {
  return collegeForFaculty(faculty)?.departments ?? [];
}

export function levelsFor(faculty: string, department: string): readonly Level[] {
  const college = collegeForFaculty(faculty);
  if (!college) return [];
  let span: LevelSpan = college.levels;
  if ("departmentLevels" in college) {
    const specific = college.departmentLevels[department as keyof typeof college.departmentLevels];
    if (specific) span = specific;
  }
  return LEVELS_BY_SPAN[span];
}
