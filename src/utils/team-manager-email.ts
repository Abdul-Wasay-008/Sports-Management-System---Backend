/**
 * Derives a CUST email for a team-manager person from the raw `members[].name`
 * found in `sports-week-2025.seed.json`.
 *
 * Rule:
 *   1. Strip leading honorifics (`Mr.`, `Mrs.`, `Ms.`, `Miss`, `Dr.`, `Engr.`, `Prof.`)
 *      and standalone single-letter initials (`M.`, `A.`, ...).
 *   2. Strip non-alpha characters within each remaining word (drops dots, hyphens,
 *      apostrophes — keeps emails purely ASCII alphanumeric in the local part).
 *   3. Capitalise the first letter of every remaining word, lowercase the rest.
 *   4. Join words with no separator and append `@cust.pk`.
 *
 * Examples:
 *   "Ms. Snober Naseer"        -> "SnoberNaseer@cust.pk"
 *   "Mr. Muhammad Daniyal"     -> "MuhammadDaniyal@cust.pk"
 *   "Dr. Iftikhar Ali Janjua"  -> "IftikharAliJanjua@cust.pk"
 *   "M. Zeeshan Sabir"         -> "ZeeshanSabir@cust.pk"
 *   "Dr. Dur-e-Shehwar"        -> "DureShehwar@cust.pk"
 */

const HONORIFIC = /^(?:Mr|Mrs|Ms|Miss|Dr|Engr|Prof)\.?$/i;
const SINGLE_INITIAL = /^[A-Za-z]\.$/;

export function deriveTeamManagerEmail(rawName: string): string {
  const local = rawName
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0 && !HONORIFIC.test(part) && !SINGLE_INITIAL.test(part))
    .map((part) => part.replace(/[^A-Za-z]+/g, ""))
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");

  return `${local}@cust.pk`;
}

/**
 * Lowercase canonical form used as the unique key when deduplicating team-manager
 * accounts across the seed (matches the `lowercase: true` setting on the User schema's
 * `email` field). Use this for Map lookups; persist the original case-preserving form
 * via `deriveTeamManagerEmail` if you need a display string.
 */
export function deriveTeamManagerEmailKey(rawName: string): string {
  return deriveTeamManagerEmail(rawName).toLowerCase();
}
