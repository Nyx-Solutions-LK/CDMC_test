const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;

function parsePagination(query) {
  let page = parseInt(query.page, 10);
  let pageSize = parseInt(query.pageSize, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

function buildPageResult(items, totalItems, page, pageSize) {
  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}

module.exports = { parsePagination, buildPageResult };
