"use strict";

import { defineContext } from "../shared/registry";

import * as CreateProduct from "./commands/CreateProduct";
import * as UpdateProduct from "./commands/UpdateProduct";
import * as SetProductStatus from "./commands/SetProductStatus";
import * as DeleteProduct from "./commands/DeleteProduct";
import * as ImportProducts from "./commands/ImportProducts";
import * as UploadProductImage from "./commands/UploadProductImage";
import * as CreateCategory from "./commands/CreateCategory";
import * as ListProducts from "./queries/ListProducts";
import * as GetProduct from "./queries/GetProduct";
import * as ListCategories from "./queries/ListCategories";
import * as ListStoreProducts from "./queries/ListStoreProducts";

/*
 * Katalog bağlamı. Yeni bir kullanım senaryosu buraya eklenir; container.js
 * değişmez. Dışa açılan tek şey bu index'tir — presentation katmanı bağlamın
 * iç dosyalarına erişemez (mimari testi bunu zorlar).
 */
export = defineContext({
  name: "catalog",
  commands: {
    CreateProduct,
    UpdateProduct,
    SetProductStatus,
    DeleteProduct,
    ImportProducts,
    UploadProductImage,
    CreateCategory,
  },
  queries: {
    ListProducts,
    GetProduct,
    ListCategories,
    ListStoreProducts,
  }
});
