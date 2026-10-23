// F-1 PR-3 fix round 4 (UX lead demand 2): every count a person reads is grouped by thousands ("2,828", never "2828").
// One helper, so the profile, the banner, the cards, the images and the metadata cannot drift.
const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const count = (n: number): string => GROUPED.format(n);
// "1 closed trade", "2,828 closed trades".
export const counted = (n: number, one: string, many = `${one}s`): string => `${count(n)} ${n === 1 ? one : many}`;
