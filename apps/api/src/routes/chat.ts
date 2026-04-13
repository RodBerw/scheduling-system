import { Router } from "express";

const router = Router();

// POST /chat — stub for now, will be implemented in feat/ai-chat
router.post("/", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }
  res.json({
    reply: "AI chat not yet implemented. Try using the schedule endpoints directly.",
    actions: [],
  });
});

export default router;
