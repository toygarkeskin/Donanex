"use strict";

import { defineContext } from "../shared/registry";

/*
 * Katalog bağlamı. Yeni bir kullanım senaryosu buraya eklenir; container.js
 * değişmez. Dışa açılan tek şey bu index'tir — presentation katmanı bağlamın
 * iç dosyalarına erişemez (mimari testi bunu zorlar).
 */
export = defineContext({
  name: "catalog",
  commands: {
    CreateProduct: require("./commands/CreateProduct"),
    UpdateProduct: require("./commands/UpdateProduct"),
    SetProductStatus: require("./commands/SetProductStatus"),
    DeleteProduct: require("./commands/DeleteProduct"),
    ImportProducts: require("./commands/ImportProducts"),
    UploadProductImage: require("./commands/UploadProductImage"),
    CreateCategory: require("./commands/CreateCategory")
  },
  queries: {
    ListProducts: require("./queries/ListProducts"),
    GetProduct: require("./queries/GetProduct"),
    ListCategories: require("./queries/ListCategories"),
    ListStoreProducts: require("./queries/ListStoreProducts")
  }
});
