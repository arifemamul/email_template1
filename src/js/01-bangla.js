/* ============================================================================
   BanglaText - akshara splitting, ported from logic/BanglaText.kt
   ============================================================================ */
const HASANTA = "্";
const COMBINING = new Set([
  "ঁ", "ং", "ঃ", "়",
  "া", "ি", "ী", "ু", "ূ", "ৃ", "ৄ",
  "ে", "ৈ", "ো", "ৌ", "ৗ", "ৢ", "ৣ",
  HASANTA
]);

function splitAksharas(word) {
  const units = [];
  let cur = "";
  let joinNext = false;
  for (const c of word) {
    if (/\s/.test(c)) continue;
    if (COMBINING.has(c)) {
      cur += c;
      joinNext = c === HASANTA;
    } else if (joinNext) {
      cur += c;
      joinNext = false;
    } else {
      if (cur) units.push(cur);
      cur = c;
    }
  }
  if (cur) units.push(cur);
  return units;
}

const BN_DIGITS = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
const bn = n => String(n).replace(/\d/g, d => BN_DIGITS[+d]);

