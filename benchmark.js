(function () {
  "use strict";

  const STORAGE_KEY = "2daction-bench-results-v1";
  const defaultData = window.BENCHMARK_DATA || {
    benchmark: "2DAction.bench",
    prompt: "prompt.md",
    updatedAt: "",
    results: []
  };

  const validStatuses = new Set(["untested", "pass", "partial", "fail"]);
  const grid = document.querySelector("#card-grid");
  const template = document.querySelector("#card-template");
  const searchInput = document.querySelector("#search");
  const statusFilter = document.querySelector("#status-filter");
  const emptyState = document.querySelector("#empty-state");
  let data = structuredClone(defaultData);

  function sanitizeData(candidate) {
    if (!candidate || !Array.isArray(candidate.results)) throw new Error("results 配列がありません");
    const knownById = new Map(defaultData.results.map((item) => [item.id, item]));
    const results = candidate.results.map((item) => {
      if (!item || typeof item.id !== "string" || typeof item.model !== "string") throw new Error("モデル情報が不正です");
      const fallback = knownById.get(item.id) || {};
      const rawScore = Number.isFinite(item.score) ? item.score : fallback.score;
      return {
        id: item.id,
        model: item.model,
        gameTitle: String(item.gameTitle || fallback.gameTitle || "Untitled game"),
        status: validStatuses.has(item.status) ? item.status : "untested",
        score: Number.isFinite(rawScore) ? Math.min(100, Math.max(0, Math.round(rawScore))) : null,
        notes: String(item.notes || ""),
        screenshot: String(item.screenshot || fallback.screenshot || ""),
        gameUrl: String(item.gameUrl || fallback.gameUrl || "")
      };
    });
    return {
      benchmark: String(candidate.benchmark || "2DAction.bench"),
      prompt: String(candidate.prompt || "prompt.md"),
      updatedAt: String(candidate.updatedAt || new Date().toISOString().slice(0, 10)),
      results
    };
  }

  function loadLocalEdits() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.results)) return;
      const edits = new Map(saved.results.map((item) => [item.id, item]));
      data.results = data.results.map((item) => {
        const edit = edits.get(item.id);
        if (!edit) return item;
        const score = Number.isFinite(edit.score)
          ? Math.min(100, Math.max(0, Math.round(edit.score)))
          : item.score;
        return {
          ...item,
          status: validStatuses.has(edit.status) ? edit.status : item.status,
          score,
          notes: typeof edit.notes === "string" ? edit.notes : item.notes
        };
      });
    } catch (error) {
      console.warn("保存済み評価を読み込めませんでした", error);
    }
  }

  function saveLocalEdits() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      results: data.results.map(({ id, status, score, notes }) => ({ id, status, score, notes }))
    }));
  }

  function save() {
    data.updatedAt = new Date().toISOString().slice(0, 10);
    saveLocalEdits();
    updateSummary();
  }

  function updateSummary() {
    const counts = { pass: 0, partial: 0, fail: 0, untested: 0 };
    data.results.forEach((item) => { counts[item.status] += 1; });
    const evaluated = data.results.length - counts.untested;
    const rate = data.results.length ? Math.round((evaluated / data.results.length) * 100) : 0;
    document.querySelector("#game-count").textContent = data.results.length;
    document.querySelector("#completion-rate").textContent = `${rate}%`;
    document.querySelector("#pass-count").textContent = counts.pass;
    document.querySelector("#partial-count").textContent = counts.partial;
    document.querySelector("#fail-count").textContent = counts.fail;
  }

  function render() {
    const query = searchInput.value.trim().toLocaleLowerCase("ja");
    const filter = statusFilter.value;
    const visible = data.results
      .filter((item) => {
        const textMatch = `${item.model} ${item.gameTitle}`.toLocaleLowerCase("ja").includes(query);
        return textMatch && (filter === "all" || item.status === filter);
      })
      .sort((a, b) => {
        const scoreDifference = (b.score ?? -1) - (a.score ?? -1);
        return scoreDifference || a.model.localeCompare(b.model, "ja");
      });

    grid.replaceChildren();
    visible.forEach((item) => {
      const card = template.content.firstElementChild.cloneNode(true);
      const shotLink = card.querySelector(".shot-link");
      const image = card.querySelector(".screenshot");
      const gameLink = card.querySelector(".open-game");
      const status = card.querySelector(".status-select");
      const score = card.querySelector(".score-input");
      const notes = card.querySelector(".notes");

      shotLink.href = item.gameUrl;
      gameLink.href = item.gameUrl;
      image.src = item.screenshot;
      image.alt = `${item.model}による「${item.gameTitle}」のスクリーンショット`;
      card.querySelector(".game-title").textContent = item.gameTitle;
      card.querySelector(".model-name").textContent = item.model;
      status.value = item.status;
      status.dataset.status = item.status;
      status.setAttribute("aria-label", `${item.model}の評価ステータス`);
      score.value = item.score ?? "";
      score.setAttribute("aria-label", `${item.model}のスコア（100点満点）`);
      notes.value = item.notes;
      notes.setAttribute("aria-label", `${item.model}のテストメモ`);

      status.addEventListener("change", () => {
        item.status = status.value;
        status.dataset.status = status.value;
        save();
        if (statusFilter.value !== "all" && statusFilter.value !== item.status) render();
      });
      score.addEventListener("change", () => {
        const value = score.valueAsNumber;
        item.score = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null;
        score.value = item.score ?? "";
        save();
        render();
      });
      notes.addEventListener("input", () => {
        item.notes = notes.value;
        save();
      });
      grid.append(card);
    });
    emptyState.hidden = visible.length !== 0;
    updateSummary();
  }

  async function loadJson() {
    try {
      const response = await fetch("benchmarks.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = sanitizeData(await response.json());
    } catch (error) {
      // file:// では多くのブラウザが fetch を制限するため、同内容の組み込みデータを使用する。
      data = structuredClone(defaultData);
    }
    loadLocalEdits();
    render();
  }

  searchInput.addEventListener("input", render);
  statusFilter.addEventListener("change", render);

  document.querySelector("#json-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      data = sanitizeData(JSON.parse(await file.text()));
      saveLocalEdits();
      searchInput.value = "";
      statusFilter.value = "all";
      render();
      document.querySelector("#save-notice span").textContent = `${file.name} を読み込みました。`;
    } catch (error) {
      alert(`JSONを読み込めませんでした: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  });

  document.querySelector("#export-button").addEventListener("click", () => {
    data.updatedAt = new Date().toISOString().slice(0, 10);
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "benchmarks.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.querySelector("#reset-button").addEventListener("click", () => {
    if (!confirm("このブラウザに保存したスコア、ステータス、メモをリセットしますか？")) return;
    localStorage.removeItem(STORAGE_KEY);
    data = structuredClone(defaultData);
    render();
    document.querySelector("#save-notice span").textContent = "ローカル編集をリセットしました。";
  });

  loadJson();
})();
