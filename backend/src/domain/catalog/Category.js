"use strict";

const { requireText, slugify } = require("../shared/guards");

function createCategory(input) {
  const data = input || {};
  const name = requireText(data.name, "Kategori adı", 120);
  return Object.freeze({
    name,
    slug: slugify(data.slug || name),
    parentId: data.parentId ?? null
  });
}

module.exports = { createCategory };
