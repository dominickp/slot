/**
 * Slot Machine Game - Main Entry Point
 *
 * This file initializes the game engine and connects all components
 */

import GameEngine from "./core/gameEngine.js";
import BackendService from "./api/backend.js";
import BaseSlot from "./core/baseSlot.js";

console.log(
  "%c🎰 Slot Machine Engine",
  "font-size: 20px; color: #667eea; font-weight: bold;",
);
console.log(
  "%cVersion: 0.1.0 - Architecture Phase",
  "color: #764ba2; font-size: 12px;",
);

// Export modules for use by games and UI
export { GameEngine, BackendService, BaseSlot };

// Initialize on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGame);
} else {
  initGame();
}

async function initGame() {
  console.log("[App] Initializing game...");

  // This is where the game would be loaded
  // For now, just logging the architecture is in place
  console.log("[App] Game architecture loaded and ready for implementation");
  console.log("[App] See ARCHITECTURE.md and DECISIONS.md for details");
}

export default { GameEngine, BackendService, BaseSlot };
