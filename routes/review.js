const express = require("express");
const router = express.Router({ mergeParams: true });
const Listing = require("../models/listing.js");
const wrapAsync = require("../utilities/wrapAsync.js");
const { reviewSchema } = require("../models/serverSchema.js"); //For server side validations
const ExpressError = require("../utilities/ExpressError.js");
const Review = require("../models/review.js");
const { isLoggedIn } = require("../middlewares.js");

//middleware function to valildate schema of review
const validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    throw new ExpressError(400, error);
  } else {
    next();
  }
};

const Booking = require("../models/booking.js");

//POSTs a review for a particular listing
router.post(
  "/",
  isLoggedIn,
  validateReview,
  wrapAsync(async (req, res) => {
    let listingId = req.params.id;

    // Verify guest has stayed and checkout date has passed
    const pastBooking = await Booking.findOne({
      listing: listingId,
      guest: req.user._id,
      checkOut: { $lte: new Date() },
    });

    if (!pastBooking) {
      req.flash("error", "You can only leave a rating and review after completing your stay (after checkout)!");
      return res.redirect(`/listings/${listingId}`);
    }

    let listing = await Listing.findById(listingId);
    let review = new Review({ ...req.body.review, user: req.user });

    listing.reviews.push(review);

    await review.save();
    await listing.save();

    req.flash("success", "Thank you for your review!");
    res.redirect(`/listings/${listingId}`);
  })
);

router.patch(
  "/:reviewId",
  wrapAsync(async (req, res) => {
    let { id, reviewId } = req.params;
    await Review.findByIdAndUpdate(reviewId, req.body.review);
    res.redirect(`/listings/${id}`);
  })
);

//DELETEs a review for a particuar listing made by a user
router.delete(
  "/:reviewId",
  wrapAsync(async (req, res) => {
    let { id, reviewId } = req.params;

    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);

    res.redirect(`/listings/${id}`);
  })
);

module.exports = router;
