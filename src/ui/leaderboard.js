// Leaderboard UI logic for slot game

import { BackendService } from "../api/backend.js";
const backend = new BackendService();

function formatLeaderboardDate(ts) {
  const d = new Date(ts);
  // Format as M/D/YY
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear() % 100; // two digits
  const dateStr = `${month}/${day}/${year}`;
  return dateStr;
}

function createLeaderboardRow(entry) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${entry.playerTag}</td>
    <td>${entry.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
    <td>${formatLeaderboardDate(entry.at)}</td>
  `;
  return row;
}

export async function renderLeaderboard(container) {
  container.innerHTML = `<div class="leaderboard-title">Top Wins</div><div class="leaderboard-loading">Loading...</div>`;
  try {
    const data = await backend.getTopWins(10);
    console.log("leaderboard data", data);
    if (!data.ok || !Array.isArray(data.rows))
      throw new Error("Invalid leaderboard");
    const table = document.createElement("table");
    table.className = "leaderboard-table";
    table.innerHTML = `
      <thead><tr><th>Player</th><th>Amount</th><th>When</th></tr></thead>
      <tbody></tbody>
    `;
    for (const entry of data.rows) {
      table.querySelector("tbody").appendChild(createLeaderboardRow(entry));
    }
    container.innerHTML = "";
    container.appendChild(table);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="leaderboard-error">Could not load leaderboard.</div>`;
  }
}
