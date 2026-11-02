// FIXES-CYCLE5 part 2 (C5-34): the one path of the picture the owner's Share button attaches (the square record card,
// app/u/[handle]/story). The owner's preview shows this same path, so what they see is what they share. Byte-identical to
// the earlier literal, so lib/share.ts#shareVia still reads it as 'story'.
export const shareImagePath = (handle: string): string => `/u/${handle}/story?format=square`;
