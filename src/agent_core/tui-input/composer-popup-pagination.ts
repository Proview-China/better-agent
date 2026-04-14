export const COMPOSER_POPUP_PAGE_SIZE = 10;

export interface ComposerPopupPage<T> {
  totalCount: number;
  pageIndex: number;
  pageCount: number;
  startIndex: number;
  visibleItems: T[];
  numberWidth: 2 | 3;
}

export interface ComposerPopupSelection {
  pageIndex: number;
  selectedIndex: number;
}

export function paginateComposerPopupItems<T>(
  items: readonly T[],
  requestedPageIndex: number,
  pageSize = COMPOSER_POPUP_PAGE_SIZE,
): ComposerPopupPage<T> {
  const totalCount = items.length;
  if (totalCount === 0) {
    return {
      totalCount: 0,
      pageIndex: 0,
      pageCount: 0,
      startIndex: 0,
      visibleItems: [],
      numberWidth: 2,
    };
  }
  const pageCount = Math.ceil(totalCount / pageSize);
  const pageIndex = Math.max(0, Math.min(requestedPageIndex, pageCount - 1));
  const startIndex = pageIndex * pageSize;
  return {
    totalCount,
    pageIndex,
    pageCount,
    startIndex,
    visibleItems: items.slice(startIndex, startIndex + pageSize),
    numberWidth: totalCount >= 100 ? 3 : 2,
  };
}

export function formatComposerPopupOrdinal(position: number, totalCount: number): string {
  const width = totalCount >= 100 ? 3 : 2;
  return String(position).padStart(width, "0");
}

export function renderComposerPopupRowText(input: {
  ordinal: string;
  label: string;
  active: boolean;
}): string {
  return `    ${input.active ? "→ " : "  "}${input.ordinal}  ${input.label}`;
}

export function moveComposerPopupSelection(params: {
  totalCount: number;
  pageSize?: number;
  pageIndex: number;
  selectedIndex: number;
  direction: 1 | -1;
}): ComposerPopupSelection {
  const pageSize = params.pageSize ?? COMPOSER_POPUP_PAGE_SIZE;
  if (params.totalCount <= 0) {
    return {
      pageIndex: 0,
      selectedIndex: 0,
    };
  }
  const currentGlobalIndex = Math.max(
    0,
    Math.min(params.totalCount - 1, (params.pageIndex * pageSize) + params.selectedIndex),
  );
  const nextGlobalIndex = (currentGlobalIndex + params.direction + params.totalCount) % params.totalCount;
  return {
    pageIndex: Math.floor(nextGlobalIndex / pageSize),
    selectedIndex: nextGlobalIndex % pageSize,
  };
}
