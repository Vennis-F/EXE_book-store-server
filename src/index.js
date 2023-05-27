const express = require("express");
const session = require("express-session");
const MemcachedStore = require("connect-memjs")(session);
const cookieParser = require("cookie-parser");
const cors = require("cors");
const MongoDBStore = require("connect-mongodb-session")(session);
const dotenv = require("dotenv");
dotenv.config();
const frameguard = require("frameguard");
const MongoStore = require("connect-mongo");
const userRouter = require("./routers/user");
const categoriesRouter = require("./routers/categories");
const productsRouter = require("./routers/products");
const cartRouter = require("./routers/cart");
const rolesRouter = require("./routers/role");
const checkoutRouter = require("./routers/checkout");
const ordersRouter = require("./routers/orders");
const sessionRouter = require("./routers/session");
const postRouter = require("./routers/post");
const blogRouter = require("./routers/blog");
const feedbackRouter = require("./routers/feedback");
const sliderRouter = require("./routers/slider");
const customerRouter = require("./routers/customer");
const dashboardRouter = require("./routers/dashboard");
const memjs = require("memjs");
const mc = memjs.Client.create(process.env.MEMCACHIER_SERVERS, {
  failover: true, // default: false
  timeout: 1, // default: 0.5 (seconds)
  keepAlive: true, // default: false
});
const app = express();
const port = process.env.PORT || 6969;

//Config
app.use(frameguard({ action: "SAMEORIGIN" }));
require("./db/mongoose");
app.use(express.json());
app.use(cors({ credentials: true, origin: "http://localhost:5000" }));
app.use(cookieParser("ClydeIsASquirrel"));

//Session
// const uri = process.env.MONGGO_DOMAIN;
// const store = new MongoDBStore({
//   uri,
//   collection: "sessions",
//   databaseName: "Bookstore",
// });
// store.on("error", function (error) {
//   console.log("[Session Mongodb store is running]", error);
// });
app.set("trust proxy", 1);
app.use(
  session({
    secret: "ClydeIsASquirrel",
    resave: "false",
    saveUninitialized: "false",
    cookie: {
      maxAge: 18000000000,
      secure:
        process.env.NODE_ENV && process.env.NODE_ENV == "production"
          ? true
          : false,
    },
    store: new MemcachedStore({
      servers: [process.env.MEMCACHIER_SERVERS],
      prefix: "_session_",
    }),
  })
);
// app.use(
//   session({
//     secret: "Asu",
//     resave: true,
//     saveUninitialized: false,
//     cookie: {
//       maxAge: 18000000000,
//       secure:
//         process.env.NODE_ENV && process.env.NODE_ENV == "production"
//           ? true
//           : false,
//     },
// store: MongoStore.create({
//   mongoUrl: uri, //YOUR MONGODB URL
//   // ttl: 14 * 24 * 60 * 60,
//   autoRemove: "native",
//   dbName: "Bookstore",
// }),
// store,
//   })
// );

//Config express
app.use("/user", userRouter);
app.use("/categories", categoriesRouter);
app.use("/products", productsRouter);
app.use("/roles", rolesRouter);
app.use("/cart", cartRouter);
app.use("/checkout", checkoutRouter);
app.use("/orders", ordersRouter);
app.use("/session", sessionRouter);
app.use("/posts", postRouter);
app.use("/blogs", blogRouter);
app.use("/feedbacks", feedbackRouter);
app.use("/sliders", sliderRouter);
app.use("/customers", customerRouter);
app.use("/dashboards", dashboardRouter);

app.get("/demo-session", function (req, res, next) {
  if (req.session.views) {
    req.session.views++;
    res.setHeader("Content-Type", "text/html");
    res.write("<p>views: " + req.session.views + "</p>");
    res.write("<p>expires in: " + req.session.cookie.maxAge / 1000 + "s</p>");
    res.end();
  } else {
    req.session.views = 1;
    res.end("welcome to the session demo. refresh!");
  }
});

//set session
app.get("/set_session", (req, res) => {
  //set a object to session
  req.session.User = {
    website: "anonystick.com",
    type: "blog javascript",
    like: "4550",
  };

  return res.status(200).json({ status: "success" });
});

//set session
app.get("/get_session", (req, res) => {
  //check session
  console.log(123);
  if (req.session.User) {
    return res
      .status(200)
      .json({ status: "success", session: req.session.User });
  }
  return res.status(200).json({ status: "error", session: "No session" });
});

//Delete session
app.get("/destroy_session", (req, res) => {
  // req.session.views = ""
  // return res.status(200).json({ status: "success" })
  //destroy session
  req.session.destroy(function (err) {
    return res
      .status(200)
      .json({ status: "success", session: "cannot access session here" });
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
