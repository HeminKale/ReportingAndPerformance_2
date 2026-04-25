"use client";

export function fireTaskSubmitConfetti() {
  void import("canvas-confetti").then((confetti) => {
    confetti.default({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 },
      colors: ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b"],
    });
  });
}

export function fireLevelUpConfetti() {
  void import("canvas-confetti").then((confetti) => {
    const count = 120;
    const defaults = { origin: { y: 0.5 }, zIndex: 9999 };
    confetti.default({ ...defaults, particleCount: count, spread: 100, startVelocity: 45 });
    setTimeout(() => {
      confetti.default({ ...defaults, particleCount: count, angle: 120, spread: 55 });
    }, 200);
    setTimeout(() => {
      confetti.default({ ...defaults, particleCount: count, angle: 60, spread: 55 });
    }, 400);
  });
}
