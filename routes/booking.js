const express = require("express");
const router = express.Router({ mergeParams: true });
const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const wrapAsync = require("../utilities/wrapAsync.js");
const ExpressError = require("../utilities/ExpressError.js");
const { isLoggedIn } = require("../middlewares.js");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Razorpay SDK Instance with Environment Credentials
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

const razorpay = new Razorpay({
  key_id,
  key_secret,
});

// Helper to parse YYYY-MM-DD or DD-MM-YYYY date strings into Local Midnight Date
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const cleanStr = String(dateStr).trim().replace(/\//g, "-");
  const parts = cleanStr.split("-").map(Number);

  if (parts.length === 3 && !parts.some(isNaN)) {
    let year, month, day;
    if (parts[0] > 1000) {
      // YYYY-MM-DD format
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else if (parts[2] > 1000) {
      // DD-MM-YYYY format
      year = parts[2];
      month = parts[1];
      day = parts[0];
    }

    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }

  const fallbackDate = new Date(dateStr);
  return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
};

// POST /listings/:id/create-razorpay-order -> Create Official Razorpay Order
router.post(
  "/listings/:id/create-razorpay-order",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { checkIn, checkOut, guestsCount } = req.body;

    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found!" });
    }

    const checkInDate = parseLocalDate(checkIn);
    const checkOutDate = parseLocalDate(checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!checkInDate || !checkOutDate || isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ success: false, message: "Please enter valid check-in and check-out dates!" });
    }

    if (checkInDate < today) {
      return res.status(400).json({ success: false, message: "Check-in date cannot be in the past!" });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ success: false, message: "Check-out date must be after check-in date!" });
    }

    const totalNights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    // Multi-instance Inventory Check
    const activeBookingsCount = await Booking.countDocuments({
      listing: id,
      status: "confirmed",
      checkIn: { $lt: checkOutDate },
      checkOut: { $gt: checkInDate },
    });

    const availableUnits = (listing.totalUnits || 1) - activeBookingsCount;
    if (availableUnits <= 0) {
      return res.status(400).json({
        success: false,
        message: `All ${listing.totalUnits || 1} unit(s) are fully booked for your selected dates!`,
      });
    }

    // Price calculation: Base price + 15% taxes & fees
    const totalPrice = Math.round(listing.price * totalNights * 1.15);

    const options = {
      amount: totalPrice * 100, // Amount in paise
      currency: "INR",
      receipt: `rcpt_${id.slice(-6)}_${Date.now().toString().slice(-6)}`,
    };

    try {
      const order = await razorpay.orders.create(options);
      return res.json({
        success: true,
        order,
        key_id,
        totalPrice,
        totalNights,
        checkIn,
        checkOut,
        guestsCount,
        listingTitle: listing.title,
      });
    } catch (err) {
      console.error("Razorpay Order Creation Error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to create Razorpay payment order: " + (err.error ? err.error.description : err.message),
      });
    }
  })
);

// POST /listings/:id/verify-razorpay-payment -> Verify Razorpay Signature & Save Booking
router.post(
  "/listings/:id/verify-razorpay-payment",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      checkIn,
      checkOut,
      guestsCount,
      totalPrice,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing Razorpay payment parameters!" });
    }

    // Verify HMAC SHA256 signature
    const hmac = crypto.createHmac("sha256", key_secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Razorpay signature verification failed!" });
    }

    const checkInDate = parseLocalDate(checkIn);
    const checkOutDate = parseLocalDate(checkOut);
    const totalNights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    const newBooking = new Booking({
      listing: id,
      guest: req.user._id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      totalNights,
      totalPrice: Number(totalPrice),
      guestsCount: parseInt(guestsCount) || 1,
      status: "confirmed",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    await newBooking.save();
    req.flash("success", "Payment successful! Reservation confirmed.");
    res.json({ success: true, bookingId: newBooking._id });
  })
);

// GET /bookings/receipt/:id -> View Booking Receipt
router.get(
  "/bookings/receipt/:id",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const booking = await Booking.findById(id)
      .populate({
        path: "listing",
        populate: { path: "owner" },
      })
      .populate("guest");

    if (!booking) {
      req.flash("error", "Booking receipt not found!");
      return res.redirect("/listings");
    }

    res.render("bookings/receipt.ejs", { booking });
  })
);

// GET /bookings/my-bookings -> Dashboard for Trips & Host Reservations
router.get(
  "/bookings/my-bookings",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const myTrips = await Booking.find({ guest: req.user._id })
      .populate("listing")
      .populate("guest")
      .sort({ createdAt: -1 });

    const myListings = await Listing.find({ owner: req.user._id });
    const listingIds = myListings.map((l) => l._id);
    const hostReservations = await Booking.find({ listing: { $in: listingIds } })
      .populate("listing")
      .populate("guest")
      .sort({ createdAt: -1 });

    res.render("bookings/my_bookings.ejs", { myTrips, hostReservations });
  })
);

// POST /bookings/:id/cancel -> Cancel booking
router.post(
  "/bookings/:id/cancel",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate("listing");

    if (!booking) {
      req.flash("error", "Booking not found!");
      return res.redirect("/bookings/my-bookings");
    }

    const isGuest = booking.guest.equals(req.user._id);
    const isHost = booking.listing.owner.equals(req.user._id);

    if (!isGuest && !isHost) {
      req.flash("error", "You do not have permission to cancel this booking.");
      return res.redirect("/bookings/my-bookings");
    }

    booking.status = "cancelled";
    await booking.save();

    req.flash("success", "Reservation cancelled successfully.");
    res.redirect("/bookings/my-bookings");
  })
);

module.exports = router;
