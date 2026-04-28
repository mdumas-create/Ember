export const extractMentions = (text: string) => {
  const set = new Set<string>();
  const regex = /@([a-zA-Z0-9_]{3,20})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    set.add(match[1].toLowerCase());
  }
  return Array.from(set);
};

export const extractHashtags = (text: string) => {
  const set = new Set<string>();
  const regex = /#([a-zA-Z0-9_]{2,50})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    set.add(match[1].toLowerCase());
  }
  return Array.from(set);
};
