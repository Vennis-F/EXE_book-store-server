const express = require("express");
const session = require("express-session");
const cors = require("cors");
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
const app = express();
const port = process.env.PORT || 6969;

//Config
app.use(frameguard({ action: "SAMEORIGIN" }));
require("./db/mongoose");
app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: [
      "http://localhost:5000",
      "https://exe-books-store-frontend-cdk6tgn3d-vennis-f.vercel.app/",
    ],
  })
);

//Session
app.use(
  session({
    secret: "Asu",
    resave: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 18000000000,
      secure: process.env.NODE_ENV === "production" ? true : false,
      httpOnly: true,
      sameSite: "none",
    },
    store: MongoStore.create({
      mongoUrl: process.env.MONGGO_DOMAIN, //YOUR MONGODB URL
      // ttl: 14 * 24 * 60 * 60,
      autoRemove: "native",
      dbName: "Bookstore",
    }),
  })
);

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
