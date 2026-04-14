import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPOSER_POPUP_PAGE_SIZE,
  formatComposerPopupOrdinal,
  moveComposerPopupSelection,
  paginateComposerPopupItems,
  renderComposerPopupRowText,
} from "./composer-popup-pagination.js";

test("paginateComposerPopupItems keeps ten items per page", () => {
  const items = Array.from({ length: 23 }, (_, index) => `item-${index + 1}`);
  const page = paginateComposerPopupItems(items, 1, COMPOSER_POPUP_PAGE_SIZE);

  assert.equal(page.pageIndex, 1);
  assert.equal(page.pageCount, 3);
  assert.equal(page.startIndex, 10);
  assert.deepEqual(page.visibleItems, items.slice(10, 20));
});

test("paginateComposerPopupItems clamps page index when results shrink", () => {
  const items = Array.from({ length: 6 }, (_, index) => `item-${index + 1}`);
  const page = paginateComposerPopupItems(items, 9, COMPOSER_POPUP_PAGE_SIZE);

  assert.equal(page.pageIndex, 0);
  assert.equal(page.pageCount, 1);
});

test("formatComposerPopupOrdinal uses two digits below 100 and three above", () => {
  assert.equal(formatComposerPopupOrdinal(7, 24), "07");
  assert.equal(formatComposerPopupOrdinal(7, 124), "007");
});

test("renderComposerPopupRowText matches review-style popup rows", () => {
  assert.equal(
    renderComposerPopupRowText({
      ordinal: "001",
      label: "/workspace src",
      active: true,
    }),
    "    → 001  /workspace src",
  );
  assert.equal(
    renderComposerPopupRowText({
      ordinal: "002",
      label: "README.md",
      active: false,
    }),
    "      002  README.md",
  );
});

test("moveComposerPopupSelection crosses page boundaries and wraps", () => {
  assert.deepEqual(
    moveComposerPopupSelection({
      totalCount: 23,
      pageIndex: 0,
      selectedIndex: 9,
      direction: 1,
    }),
    {
      pageIndex: 1,
      selectedIndex: 0,
    },
  );

  assert.deepEqual(
    moveComposerPopupSelection({
      totalCount: 23,
      pageIndex: 1,
      selectedIndex: 0,
      direction: -1,
    }),
    {
      pageIndex: 0,
      selectedIndex: 9,
    },
  );

  assert.deepEqual(
    moveComposerPopupSelection({
      totalCount: 23,
      pageIndex: 2,
      selectedIndex: 2,
      direction: 1,
    }),
    {
      pageIndex: 0,
      selectedIndex: 0,
    },
  );
});
