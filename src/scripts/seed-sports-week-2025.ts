import { env } from "../config/env.js";
import seedData from "../data/sports-week/seed/sports-week-2025.seed.json" with { type: "json" };
import { connectDatabase, disconnectDatabase } from "../lib/db.js";
import { CommitteeMemberModel } from "../models/CommitteeMember.js";
import { DepartmentTeamManagerAssignmentModel } from "../models/DepartmentTeamManagerAssignment.js";
import { GameCategoryModel } from "../models/GameCategory.js";
import { GameManagerAssignmentModel } from "../models/GameManagerAssignment.js";
import { GameManagerModel } from "../models/GameManager.js";
import { SportModel } from "../models/Sport.js";
import { SPORTS_WEEK_DEPARTMENTS, normalizeDepartment } from "../constants/sports-week.js";

type SeedCategory = {
  name: string;
  slug: string;
  gender: "male" | "female" | "mixed";
};

type SeedSport = {
  name: string;
  slug: string;
  categories: SeedCategory[];
};

type SeedCommittee = {
  name: string;
  title: string;
  order: number;
};

type SeedManager = {
  name: string;
  categorySlug: string;
  department?: string;
  email?: string;
  phone?: string;
};

type SeedDepartmentManager = {
  categorySlug: string;
  department: string;
  managerName: string;
  contact?: string;
};

type SportsWeekSeed = {
  sports: SeedSport[];
  coreCommittee: SeedCommittee[];
  gameManagers: SeedManager[];
  departmentTeamManagers: SeedDepartmentManager[];
};

function slugToEmail(slug: string) {
  return `${slug}@cust.pk`;
}

async function run() {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required to run seed.");
  }

  const typedSeed = seedData as SportsWeekSeed;
  await connectDatabase(env.mongodbUri);

  const categoryBySlug = new Map<string, string>();
  let skippedManagerAssignments = 0;
  let skippedDepartmentTeamManagers = 0;

  for (const sport of typedSeed.sports) {
    const sportDoc = await SportModel.findOneAndUpdate(
      { slug: sport.slug },
      { name: sport.name, slug: sport.slug },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    for (const category of sport.categories) {
      const categoryDoc = await GameCategoryModel.findOneAndUpdate(
        { slug: category.slug },
        {
          sportId: sportDoc._id,
          name: category.name,
          slug: category.slug,
          gender: category.gender,
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      categoryBySlug.set(category.slug, String(categoryDoc._id));
    }
  }

  for (const member of typedSeed.coreCommittee) {
    await CommitteeMemberModel.findOneAndUpdate(
      { committeeType: "core", order: member.order },
      { name: member.name, title: member.title, committeeType: "core", order: member.order },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  for (const manager of typedSeed.gameManagers) {
    const categoryId = categoryBySlug.get(manager.categorySlug);
    if (!categoryId) {
      skippedManagerAssignments += 1;
      continue;
    }

    const canonicalDepartment = manager.department
      ? normalizeDepartment(manager.department) ?? undefined
      : undefined;
    const managerSlug = manager.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const managerDoc = await GameManagerModel.findOneAndUpdate(
      { email: manager.email ?? slugToEmail(managerSlug) },
      {
        name: manager.name,
        email: manager.email ?? slugToEmail(managerSlug),
        phone: manager.phone ?? "N/A",
        officeAddress: "Sports Office",
        officeHours: "Contact for schedule",
        department: canonicalDepartment,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await GameManagerAssignmentModel.findOneAndUpdate(
      { managerId: managerDoc._id, gameCategoryId: categoryId },
      { managerId: managerDoc._id, gameCategoryId: categoryId, roleLabel: "Game Manager" },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  for (const row of typedSeed.departmentTeamManagers) {
    const categoryId = categoryBySlug.get(row.categorySlug);
    const department = normalizeDepartment(row.department);
    if (!categoryId || !department) {
      skippedDepartmentTeamManagers += 1;
      continue;
    }

    await DepartmentTeamManagerAssignmentModel.findOneAndUpdate(
      { gameCategoryId: categoryId, department },
      {
        gameCategoryId: categoryId,
        department,
        managerName: row.managerName,
        contact: row.contact?.trim() || undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  const coverage = {
    sports: await SportModel.countDocuments(),
    categories: await GameCategoryModel.countDocuments(),
    committeeMembers: await CommitteeMemberModel.countDocuments({ committeeType: "core" }),
    gameManagers: await GameManagerModel.countDocuments(),
    gameManagerAssignments: await GameManagerAssignmentModel.countDocuments(),
    departmentTeamManagerAssignments: await DepartmentTeamManagerAssignmentModel.countDocuments(),
    expectedDepartments: SPORTS_WEEK_DEPARTMENTS.length,
    skippedManagerAssignments,
    skippedDepartmentTeamManagers,
  };

  console.log("Sports Week 2025 seed completed.");
  console.log(JSON.stringify(coverage, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
