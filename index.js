const express = require("express");
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const path = require("path");
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const wrapAsync = require("./utilities/wrapAsync.js");
const ExpressError = require("./utilities/ExpressError.js");
const User = require("./models/user.js");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");

const listingsRoute = require("./routes/listing.js");
const reviewsRoute = require("./routes/review.js");
const usersRoute = require("./routes/user.js");
const bookingsRoute = require("./routes/booking.js");

const app = express();

let mongoURL = process.env.MONGO_ATLAS_URL;

mongoose
  .connect(mongoURL)
  .then(() => console.log("Connected to DB!"))
  .catch((err) => console.log("Error: ", err));

app.set("view engine", "ejs");
app.engine("ejs", ejsMate);
app.set("views", path.join(__dirname, "/views"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

//middleware that logs info
app.use((req, res, next) => {
  console.log("Method: ", req.method);
  console.log("Path: ", req.path);
  console.log("Time: ", new Date());

  next();
});

const store = MongoStore.create({
  mongoUrl: mongoURL,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.failure = req.flash("failure");
  res.locals.error = req.flash("error");
  res.locals.user = req.user;

  next();
});

app.get("/", (req, res) => {
  res.redirect("/listings");
});

app.use("/listings", listingsRoute);
app.use("/listings/:id/reviews", reviewsRoute);
app.use("/", bookingsRoute);
app.use("/", usersRoute);

// app.get("/demoUser", async (req, res) => {
//   let user = new User({
//     email: "habibi@gmail.com",
//     username: "Habibi",
//   });
//   let registeredUser = await User.register(user, "password12345");
//   res.send(registeredUser);
// });

app.use("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

//Custom error handling middleware
app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

app.listen(8080, () => {
  console.log("Server running at http://localhost:8080");
});
