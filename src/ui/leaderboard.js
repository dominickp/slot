// Leaderboard UI logic for slot game

import { BackendService } from "../api/backend.js";
const backend = new BackendService();

const LEADERBOARD_EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "😊",
  "😇",
  "🙂",
  "🙃",
  "😉",
  "😋",
  "😎",
  "🥳",
  "🤑",
  "🤩",
  "😏",
  "😬",
  "🤠",
  "😺",
  "🦄",
  "😡",
  "😈",
  "🤢",
  "🐭",
  "😳",
];

function assignEmojisToTags(playerTags) {
  const tagToEmoji = {};
  let emojiIdx = 0;
  for (const tag of playerTags) {
    if (emojiIdx >= LEADERBOARD_EMOJIS.length) break;
    tagToEmoji[tag] = LEADERBOARD_EMOJIS[emojiIdx++];
  }
  return tagToEmoji;
}

function formatLeaderboardDate(ts) {
  const d = new Date(ts);
  // Format as M/D/YY
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear() % 100; // two digits
  const dateStr = `${month}/${day}/${year}`;
  return dateStr;
}

function createLeaderboardRow(entry, tagToEmoji) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${tagToEmoji[entry.playerTag] || "❓"}</td>
    <td>${entry.betAmount?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "-"}</td>
    <td>${entry.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
    <td>${formatLeaderboardDate(entry.at)}</td>
  `;
  return row;
}

export async function renderLeaderboard(container) {
  container.innerHTML = `<div class="leaderboard-loading">Loading...</div>`;
  try {
    const data = await backend.getTopWins(15);
    if (!data.ok || !Array.isArray(data.rows))
      throw new Error("Invalid leaderboard");
    // Get unique playerTags
    const uniqueTags = Array.from(new Set(data.rows.map((e) => e.playerTag)));
    const tagToEmoji = assignEmojisToTags(uniqueTags);
    const table = document.createElement("table");
    table.className = "leaderboard-table";
    table.innerHTML = `
      <thead><tr><th>Player</th><th>Bet</th><th>Win</th><th>When</th></tr></thead>
      <tbody></tbody>
    `;
    for (const entry of data.rows) {
      table
        .querySelector("tbody")
        .appendChild(createLeaderboardRow(entry, tagToEmoji));
    }
    container.innerHTML = "";
    container.appendChild(table);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="leaderboard-error">Could not load leaderboard.</div>`;
  }
}
