// Banglish → বাংলা while typing (Avro Phonetic rules, like the Avro keyboard).
// "khawar pore" → "খাওয়ার পরে", "1 chamoch" → "১ চামচ". Bangla text already in the box is never touched.
import Avro from "./avro-phonetic";

type Field = HTMLInputElement | HTMLTextAreaElement;

/** The last Banglish word just before the cursor */
const TAIL = /[A-Za-z0-9`]+$/;
/** Keys that finish a word */
const ENDS = new Set([" ", "Enter", "Tab", ",", "?", "!", ";", ".", ")", "("]);

/** Convert every Banglish (English letter) part of a text. Bangla parts stay the same. */
export function toBangla(text: string): string {
  return text.replace(/[A-Za-z0-9`]+/g, (w) => Avro.parse(w));
}

/** Convert the word just before the cursor. Returns true if something changed. */
export function convertWordBeforeCursor(el: Field): boolean {
  const pos = el.selectionStart ?? el.value.length;
  if (pos !== (el.selectionEnd ?? pos)) return false;
  const m = TAIL.exec(el.value.slice(0, pos));
  if (!m) return false;
  el.setRangeText(Avro.parse(m[0]), pos - m[0].length, pos, "end");
  return true;
}

/**
 * onKeyDown handler: when a word ends (space, Enter, comma …), turn it into Bangla.
 * "." after a word becomes the Bangla full stop "।" (but "1.5" stays a number).
 * commit(value) must save the new value in the form.
 */
export function banglaKeyDown(e: React.KeyboardEvent<Field>, commit: (value: string) => void) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing || !ENDS.has(e.key)) return;
  const el = e.currentTarget;
  const pos = el.selectionStart ?? 0;
  const before = el.value.slice(0, pos);
  const wordEndsWithLetter = /[A-Za-z]$/.test(before);
  const changed = convertWordBeforeCursor(el);
  if (e.key === "." && wordEndsWithLetter) {
    e.preventDefault();
    el.setRangeText("।", el.selectionStart ?? 0, el.selectionEnd ?? 0, "end");
    commit(el.value);
    return;
  }
  if (changed) commit(el.value);
}
