import { BANNED_WORDS } from '../config/banned-words';

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const containsBannedWords = (text: string) => {
  const envRaw = process.env.BANNED_WORDS || '';
  const envList = envRaw
    .split(',')
    .map((w) => normalize(w.trim()))
    .filter(Boolean);
  
  const localList = BANNED_WORDS.map((w) => normalize(w.trim()));
  const fullList = Array.from(new Set([...envList, ...localList]));

  if (!fullList.length) return false;
  const haystack = normalize(text);
  return fullList.some((w) => haystack.includes(w));
};
