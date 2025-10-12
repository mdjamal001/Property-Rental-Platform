const express = require("express");
const router = express.Router();
const Listing = require("../models/listing.js");
const wrapAsync = require("../utilities/wrapAsync.js");
const { listingSchema } = require("../models/serverSchema.js"); //For server side validations
const ExpressError = require("../utilities/ExpressError.js");
const { redirectPath } = require("../middlewares.js");
const { isLoggedIn } = require("../middlewares.js");

const { storage } = require("../cloudConfig.js");
const multer = require("multer");
const upload = multer({ storage });

//middleware function to valildate schema of listing
const validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);
  if (error) {
    throw new ExpressError(400, error);
  } else {
    next();
  }
};

//Displays all listings
router.get("/", async (req, res) => {
  //can also leave the route string empty
  let listings = await Listing.find();
  console.log("Total number of listings are: ", listings.length);
  res.render("listings/index.ejs", { listings });
});

//Returns a page for creating a new listing
router.get("/new", redirectPath, isLoggedIn, (req, res) => {
  res.render("listings/create.ejs");
});

//Inserts a listing into DB
router.post(
  "/",
  upload.single("image"),
  validateListing,
  wrapAsync(async (req, res, next) => {
    console.log(req.file);
    let listing = new Listing({
      ...req.body,
      image: { url: req.file.path, filename: req.file.filename },
      owner: req.user,
    });
    await listing.save();
    req.flash("success", "New Listing created Successfully!");
    res.redirect("/listings");
  })
);

//Displays a specfic listing
router.get(
  "/:id",
  wrapAsync(async (req, res, next) => {
    let { id } = req.params;
    res.locals.currUser = req.user;
    let listing = await Listing.findById(id)
      .populate({
        path: "reviews",
        populate: {
          path: "user",
        },
      })
      .populate("owner");
    res.render("listings/show.ejs", { listing });
  })
);

//Returns a page for editing listing
router.get("/:id/edit", async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  res.render("listings/edit.ejs", { listing });
});

//Updates the listing in DB
router.patch("/:id", (req, res) => {
  let { id } = req.params;
  Listing.findByIdAndUpdate(id, req.body)
    .then(() => {
      req.flash("success", "Listing updated Successfully!");
      res.redirect(`/listings/${id}`);
    })
    .catch((err) => res.status(500).send("Some Server Error!"));
});

//Deletes a listing
router.delete(
  "/:id",
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "Deleted listing Successfully!");
    res.redirect("/listings");
  })
);

module.exports = router;
