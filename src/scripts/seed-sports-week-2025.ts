import { env } from "../config/env.js";
import seedData from "../data/sports-week/seed/sports-week-2025.seed.json" with { type: "json" };
import { connectDatabase, disconnectDatabase } from "../lib/db.js";
import { ensureAdminUser } from "../services/admin-bootstrap.service.js";
import { CommitteeMemberModel } from "../models/CommitteeMember.js";
import { DepartmentTeamManagerAssignmentModel } from "../models/DepartmentTeamManagerAssignment.js";
import { GameModel } from "../models/Game.js";
import { GameCategoryModel } from "../models/GameCategory.js";
import { GameManagerAssignmentModel } from "../models/GameManagerAssignment.js";
import { GameManagerModel } from "../models/GameManager.js";
import { RuleModel } from "../models/Rule.js";
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

type GameSeedDetails = {
  venue: string;
  rulesSummary: string;
};

const GAME_DETAILS_BY_SLUG: Record<string, GameSeedDetails> = {
  "athletics-boys": {
    venue: "University Cricket Ground",
    rulesSummary:
      "Events per department: 100m (1 player), 100x4 relay (1 team of 4), long jump (1), shot put (1), discus throw (1), javelin throw (1).",
  },
  "athletics-girls": {
    venue: "M-Block Ground",
    rulesSummary:
      "Events per department: 100m (1 player), 100x4 relay (1 team of 4), shot put (1), three-legged race (1 team of 2), discus throw (1), javelin throw (1).",
  },
  "badminton-boys-singles": {
    venue: "Liaqat Hall, Rawalpindi",
    rulesSummary:
      "Two players from each department (one plays per tie); best-of-3 in early rounds and best-of-5 in final; 16 points per match in early rounds and 21 in final.",
  },
  "badminton-boys-doubles": {
    venue: "Liaqat Hall, Rawalpindi",
    rulesSummary:
      "One doubles team per department; best-of-3 in early rounds and best-of-5 in final; 11 points per match in early rounds and 16 in final.",
  },
  "badminton-girls-singles": {
    venue: "Liaqat Hall, Rawalpindi",
    rulesSummary:
      "One team of two players per department; best-of-3 in early rounds and best-of-5 in final; 11 points per match in early rounds and 16 in final.",
  },
  "badminton-girls-doubles": {
    venue: "Liaqat Hall, Rawalpindi",
    rulesSummary:
      "One team per department; best-of-3 in early rounds and best-of-5 in final; 16 points per match in early rounds and 21 in final.",
  },
  "basketball-boys": {
    venue: "Basketball Court, CUST Islamabad",
    rulesSummary:
      "Max 10 players per team; 10-minute quarters with 3-minute breaks; 5-minute halftime; 5 fouls per player; free substitutions; 2 timeouts first half and 3 second half.",
  },
  "basketball-girls": {
    venue: "Basketball Court, CUST Islamabad",
    rulesSummary:
      "Max 10 players per team; 8-minute quarters with 3-minute breaks; 5-minute halftime; 5 fouls per player; free substitutions; 2 timeouts first half and 3 second half.",
  },
  "chess-boys": {
    venue: "Gym, CUST Islamabad",
    rulesSummary:
      "Two players from each department (one can continue); total game time is 1 hour with 30 minutes per player; result decided by checkmate or clock timeout.",
  },
  "chess-girls": {
    venue: "Gym, CUST Islamabad",
    rulesSummary:
      "Two players from each department (one can continue); total game time is 1 hour with 30 minutes per player; result decided by checkmate or clock timeout.",
  },
  "cricket-boys": {
    venue: "Cricket Ground, CUST Islamabad",
    rulesSummary:
      "One team per department; max 15 players with 11 playing and 12th man; 8 overs in knockouts and 10 overs in semifinals/final; tie resolved by super over.",
  },
  "cricket-girls": {
    venue: "M-Block Ground, CUST Islamabad",
    rulesSummary:
      "One team per department; max 11 players with 8-a-side; 6 overs per side in all matches; max 2 overs per bowler; tie resolved by super over.",
  },
  "football-boys": {
    venue: "CUST Islamabad Ground",
    rulesSummary:
      "One team per department, 8 players a side; two halves of 20 minutes with 10-minute halftime; first round draws go to penalties; semifinals/final include extra time then penalties.",
  },
  "lawn-tennis-boys-singles": {
    venue: "CUST Islamabad",
    rulesSummary:
      "Two players per department (one participates); each match is one set of 6 games.",
  },
  "lawn-tennis-boys-doubles": {
    venue: "Lawn Tennis Court, CUST Islamabad",
    rulesSummary:
      "One team per department; each match is one set of 6 games.",
  },
  "lawn-tennis-girls-singles": {
    venue: "CUST Islamabad",
    rulesSummary:
      "Two players per department (one participates); each match is one set of 4 games.",
  },
  "snooker-boys-singles": {
    venue: "U-Block, near CUST Islamabad",
    rulesSummary:
      "Two players per department (one participates); best-of-3 in early rounds and best-of-5 in final; 10 balls in early rounds and 15 in final.",
  },
  "snooker-boys-doubles": {
    venue: "U-Block, near CUST Islamabad",
    rulesSummary:
      "One team per department; best-of-3 in early rounds and best-of-5 in final; 10 balls in early rounds and 15 in final.",
  },
  "snooker-girls-singles": {
    venue: "U-Block, near CUST Islamabad",
    rulesSummary:
      "Two players per department (one participates); best-of-3 in early rounds and best-of-5 in final; match up to 30 minutes; 6 balls in early rounds and 10 in final.",
  },
  "squash-boys": {
    venue: "Liaqat Hall, Rawalpindi",
    rulesSummary:
      "Two players per department (one participates); best-of-3 in early rounds and best-of-5 in final; 11 points per match in early rounds and 16 in final.",
  },
  "table-tennis-boys-singles": {
    venue: "CUST Islamabad",
    rulesSummary:
      "Two players per department (one participates); best-of-3 in early rounds and best-of-5 in final; 16 points per match in early rounds and 21 in final.",
  },
  "table-tennis-boys-doubles": {
    venue: "CUST Islamabad",
    rulesSummary:
      "One team per department; best-of-3 in early rounds and best-of-5 in final; 16 points per match in early rounds and 21 in final.",
  },
  "table-tennis-girls-singles": {
    venue: "Gym, CUST Islamabad",
    rulesSummary:
      "Two players per department (one participates); best-of-3 in early rounds and best-of-5 in final; 11 points per match in early rounds and 16 in final.",
  },
  "table-tennis-girls-doubles": {
    venue: "Gym, CUST Islamabad",
    rulesSummary:
      "One team per department; best-of-3 in early rounds and best-of-5 in final; 11 points per match in early rounds and 16 in final.",
  },
  "tug-of-war-boys": {
    venue: "Near Cricket Ground, CUST Islamabad",
    rulesSummary:
      "One team per department; 8 players with 2 substitutes; best-of-3 matches.",
  },
  "tug-of-war-girls": {
    venue: "Near M-Block, CUST Islamabad",
    rulesSummary:
      "One team per department; 5 players with 2 substitutes; best-of-3 matches; if one team is short on players, both teams play with equal player count.",
  },
  "volleyball-boys": {
    venue: "Volleyball Court, CUST Islamabad",
    rulesSummary:
      "One team per department; 6 players with 4 substitutes; best-of-3 in first round/semifinal and best-of-5 in final; 25-point sets; 2-minute set break; 2 timeouts (30s) per team.",
  },
};

const GENERAL_RULES = [
  "The Core Committee reserves the right to amend the match schedule as necessary. All teams are required to comply with these changes.",
  "No student will be permitted to participate in any sport without presenting a valid university ID card or alternative official proof of registration.",
  "A team without a Department Team Manager will not be eligible to play. However, the Game Manager may accept a substitute Team Manager if the change is formally communicated by the department.",
  "Players must wear the official departmental sports kit to participate. The kits will be issued to Department Team Managers in exchange for players' ID cards.",
  "No individuals from outside the university are permitted to participate in Sports Week as players or spectators. Department Team Managers are accountable for ensuring their team rosters include only currently enrolled students from their department.",
  "The judgment of the referee/field umpire will be final for a specific game. In case of ambiguity, only the core committee's Game Manager is empowered to make the final decision.",
  "Every team must be accompanied by a Department Team Manager from its department, who is responsible for the team's and audience discipline. During games, only the Department Team Manager is authorized to interact with core committee Game Managers.",
  "The core committee's Game Managers shall ensure the timely conduct of all games as per the official Sports Week schedule.",
  "All faculty members are welcome to attend as spectators. For smooth progression of the event, they are requested to refrain from interfering with officiating or game flow.",
  "A team that is more than 15 minutes late for a scheduled match will forfeit the game, provided the opposing Department Team Manager requests a walkover.",
  "Only female students and female faculty members are permitted to attend girls' games as spectators or team officials.",
  "In the event of misconduct by a player or audience member, including abusive language or throwing sports equipment, the individual shall be immediately dismissed from the field.",
  "The team roster for each team, along with university ID cards, must be submitted by the Department Team Manager at least half an hour before the start of every match. The roster must include players' registration numbers and names.",
  "If not all players listed on a submitted roster are present for a match, the team may add a new player from the department with a valid university ID card, or choose to play with reduced available players.",
] as const;

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
  const categoryMetaBySlug = new Map<string, { name: string; gender: "male" | "female" | "mixed" }>();
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
      categoryMetaBySlug.set(category.slug, { name: category.name, gender: category.gender });
    }
  }

  for (const member of typedSeed.coreCommittee) {
    await CommitteeMemberModel.findOneAndUpdate(
      { committeeType: "core", order: member.order },
      { name: member.name, title: member.title, committeeType: "core", order: member.order },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  for (const [index, description] of GENERAL_RULES.entries()) {
    const title = `Rule ${index + 1}`;
    await RuleModel.findOneAndUpdate(
      { title },
      { title, description },
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

  const fallbackManager = await GameManagerModel.findOneAndUpdate(
    { email: "sports-office@cust.pk" },
    {
      name: "Sports Office",
      email: "sports-office@cust.pk",
      phone: "N/A",
      officeAddress: "Sports Office",
      officeHours: "Contact for schedule",
      department: undefined,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const managerAssignmentRows = await GameManagerAssignmentModel.find().sort({ createdAt: 1 });
  const managerByCategoryId = new Map<string, string>();
  for (const row of managerAssignmentRows) {
    managerByCategoryId.set(String(row.gameCategoryId), String(row.managerId));
  }

  for (const [categorySlug, categoryId] of categoryBySlug.entries()) {
    const categoryMeta = categoryMetaBySlug.get(categorySlug);
    if (!categoryMeta) continue;
    const gameDetails = GAME_DETAILS_BY_SLUG[categorySlug];

    const managerId = managerByCategoryId.get(categoryId) ?? String(fallbackManager._id);

    await GameModel.findOneAndUpdate(
      { slug: categorySlug },
      {
        title: categoryMeta.name,
        slug: categorySlug,
        description: `${categoryMeta.name} fixture for Sports Week 2025.`,
        genderCategory: categoryMeta.gender,
        venue: gameDetails?.venue ?? "TBA",
        rulesSummary:
          gameDetails?.rulesSummary ??
          `Follow official Sports Week 2025 rules for ${categoryMeta.name}.`,
        totalSlots: 24,
        acceptedRegistrations: 0,
        managerId,
        gameCategoryId: categoryId,
        isActive: true,
      },
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
    games: await GameModel.countDocuments(),
    rules: await RuleModel.countDocuments(),
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

  await ensureAdminUser();
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
