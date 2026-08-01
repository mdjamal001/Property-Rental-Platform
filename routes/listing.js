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

//Displays all listings with optional search & category filter
router.get("/", wrapAsync(async (req, res) => {
  let { category, q } = req.query;
  let filter = {};
  if (category && category.trim() !== "") {
    filter.category = category.trim();
  }
  if (q && q.trim() !== "") {
    let reg = new RegExp(q.trim(), "i");
    filter.$or = [
      { title: reg },
      { description: reg },
      { city: reg },
      { country: reg },
    ];
  }
  let listings = await Listing.find(filter);
  res.render("listings/index.ejs", {
    listings,
    selectedCategory: category || "",
    searchQuery: q || "",
  });
}));

//Returns a page for creating a new listing
router.get("/new", redirectPath, isLoggedIn, (req, res) => {
  res.render("listings/create.ejs");
});

//Inserts a listing into DB
router.post(
  "/",
  isLoggedIn,
  upload.array("images", 10),
  validateListing,
  wrapAsync(async (req, res, next) => {
    let { lat, lng, amenities, occupancy } = req.body;
    let listingData = { ...req.body };

    // Format coordinates
    if (lat && lng) {
      listingData.geometry = {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)],
      };
    }

    // Format amenities
    if (typeof amenities === "string") {
      listingData.amenities = [amenities];
    }

    // Format images
    listingData.images = [];
    if (req.files && req.files.length > 0) {
      listingData.images = req.files.map((file) => ({
        url: file.path,
        filename: file.filename,
      }));
    } else if (req.body.imageURL) {
      listingData.images.push({
        url: req.body.imageURL,
        filename: "external_image",
      });
    }

    let listing = new Listing({
      ...listingData,
      owner: req.user._id,
    });

    await listing.save();
    req.flash("success", "New Listing created Successfully!");
    res.redirect(`/listings/${listing._id}`);
  })
);

//Displays a specific listing
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
    if (!listing) {
      req.flash("error", "Listing you requested does not exist!");
      return res.redirect("/listings");
    }

    let canReview = false;
    if (req.user) {
      const Booking = require("../models/booking.js");
      const pastBooking = await Booking.findOne({
        listing: id,
        guest: req.user._id,
        checkOut: { $lte: new Date() },
      });
      if (pastBooking) {
        canReview = true;
      }
    }

    res.render("listings/show.ejs", { listing, canReview });
  })
);

//Returns a page for editing listing
router.get("/:id/edit", isLoggedIn, wrapAsync(async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }
  res.render("listings/edit.ejs", { listing });
}));

//Updates the listing in DB
router.patch(
  "/:id",
  isLoggedIn,
  upload.array("images", 10),
  validateListing,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    let { title, description, price, city, country, category, occupancy, lat, lng, amenities, deletedImages } = req.body;

    listing.title = title;
    listing.description = description;
    listing.price = price;
    listing.city = city;
    listing.country = country;
    if (category) listing.category = category;
    if (occupancy) listing.occupancy = occupancy;

    // Format coordinates
    if (lat && lng) {
      listing.geometry = {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)],
      };
    }

    // Format amenities
    if (typeof amenities === "string") {
      listing.amenities = [amenities];
    } else if (Array.isArray(amenities)) {
      listing.amenities = amenities;
    } else {
      listing.amenities = [];
    }

    // Process newly uploaded images
    if (req.files && req.files.length > 0) {
      let newImages = req.files.map((file) => ({
        url: file.path,
        filename: file.filename,
      }));
      if (!listing.images) listing.images = [];
      listing.images.push(...newImages);
    }

    // Process deleted images
    if (deletedImages) {
      let toDelete = Array.isArray(deletedImages) ? deletedImages : [deletedImages];
      listing.images = listing.images.filter((img) => !toDelete.includes(img.filename));
    }

    await listing.save();

    req.flash("success", "Listing updated Successfully!");
    res.redirect(`/listings/${id}`);
  })
);

//Deletes a listing
router.delete(
  "/:id",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "Deleted listing Successfully!");
    res.redirect("/listings");
  })
);

module.exports = router;
