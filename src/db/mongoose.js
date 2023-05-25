const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGGO_DOMAIN, {
    autoIndex: true,
    dbName: "Bookstore",
  })
  .then(() => console.log("DB mongodb connection is ON"))
  .catch(() => console.log("DB mongodb connection FAIL"));
