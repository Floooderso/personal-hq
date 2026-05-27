function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalizeName(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
}

function findBestMatch(needle, haystack, threshold = 2) {
  const normalNeedle = normalizeName(needle);
  let best = null, bestDist = Infinity;
  for (const item of haystack) {
    const dist = levenshtein(normalNeedle, normalizeName(item.name));
    if (dist < bestDist) { bestDist = dist; best = item; }
  }
  return bestDist <= threshold ? best : null;
}

module.exports = { levenshtein, normalizeName, findBestMatch };
