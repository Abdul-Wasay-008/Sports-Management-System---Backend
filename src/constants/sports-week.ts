export const SPORTS_WEEK_DEPARTMENTS = [
  "Accounting & Finance",
  "Artificial Intelligence",
  "Associate Degree Program",
  "Bioinformatics and Biosciences",
  "Civil Engineering",
  "Computer Science",
  "Electrical and Computer Engineering",
  "English",
  "Management Science",
  "Mathematics",
  "Mechanical Engineering",
  "Pharmacy",
  "Psychology",
  "Software Engineering",
  "Law",
] as const;

export const STUDENT_GENDERS = ["male", "female"] as const;
export const GAME_GENDERS = ["male", "female", "mixed"] as const;

export type SportsWeekDepartment = (typeof SPORTS_WEEK_DEPARTMENTS)[number];
export type StudentGender = (typeof STUDENT_GENDERS)[number];
export type GameGender = (typeof GAME_GENDERS)[number];

const departmentAliasMap: Record<string, SportsWeekDepartment> = {
  "accounting and finance": "Accounting & Finance",
  "accounting & finance": "Accounting & Finance",
  "artificial intelligence": "Artificial Intelligence",
  "associate degree program": "Associate Degree Program",
  "bioinformatics and biosciences": "Bioinformatics and Biosciences",
  "civil engineering": "Civil Engineering",
  "computer science": "Computer Science",
  "electrical and computer engineering": "Electrical and Computer Engineering",
  english: "English",
  "management science": "Management Science",
  mathematics: "Mathematics",
  "mechanical engineering": "Mechanical Engineering",
  pharmacy: "Pharmacy",
  psychology: "Psychology",
  "software engineering": "Software Engineering",
  law: "Law",
};

export function normalizeDepartment(input: string) {
  const cleaned = input.trim().replace(/\s+/g, " ").toLowerCase();
  return departmentAliasMap[cleaned] ?? null;
}
