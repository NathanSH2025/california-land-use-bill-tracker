document.documentElement.dataset.deployedFrom = "github";

fetch("./data/tracker-meta.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error("Tracker metadata could not be loaded.");
    return response.json();
  })
  .then((meta) => {
    const counts = meta.snapshot_counts || {};
    document.getElementById("bills-tracked").textContent = counts.bills_tracked ?? "—";
    document.getElementById("chaptered").textContent = counts.chaptered ?? "—";
    document.getElementById("vetoed").textContent = counts.vetoed ?? "—";
    document.getElementById("removed").textContent = counts.removed_not_tracking ?? "—";
  })
  .catch(() => {
    document.querySelectorAll(".metric").forEach((el) => {
      el.textContent = "—";
    });
  });
