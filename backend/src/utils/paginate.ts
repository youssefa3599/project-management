export const paginateQuery = (page: number = 1, limit: number = 10) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100); // between 1 and 100
  const skip = (safePage - 1) * safeLimit;
  return { skip, limit: safeLimit, page: safePage };
};
