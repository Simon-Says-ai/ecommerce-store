import express from "express";
import { protectRoute, adminRoute } from "../middleware/auth.middleware.js";
import { getAnalyticsData } from "../controllers/analytics.controller.js"; 
import { getDailySalesData } from "../controllers/analytics.controller.js";


const router = express.Router();

router.get("/", protectRoute, adminRoute, async (req, res) => {
  try {
    const analyticsData = await getAnalyticsData();
    const endDate = new Date(); // Current date
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const dailySalesData = await getDailySalesData(startDate, endDate); // Fetch daily sales data for the last 7 days

    res.json({ analyticsData, dailySalesData });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    res.status(500).json({ error: "Failed to fetch analytics data." });
  }
});

export default router;