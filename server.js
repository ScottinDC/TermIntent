import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const envPath = path.join(__dirname, ".env");

loadDotEnv(envPath);

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const SEMRUSH_API_KEY = process.env.SEMRUSH_API_KEY || "";
const SEMRUSH_ENDPOINT = "https://api.semrush.com/";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const CONFIGURED_ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = Array.from(new Set(["https://scottindc.github.io", ...CONFIGURED_ALLOWED_ORIGINS]));

const DATABASES = {
  US: "us",
  UK: "uk",
  CA: "ca"
};

const CONTENT_GOALS = {
  seo_page: "SEO page",
  blog_post: "Blog post",
  donation_page: "Donation page",
  petition_page: "Petition page",
  ad_copy: "Ad copy",
  email_language: "Email language"
};

const GOAL_INTENT_WEIGHTS = {
  seo_page: { informational: 0.35, commercial: 0.35, transactional: 0.2, navigational: 0.1 },
  blog_post: { informational: 0.65, commercial: 0.15, transactional: 0.1, navigational: 0.1 },
  donation_page: { transactional: 0.6, commercial: 0.2, informational: 0.15, navigational: 0.05 },
  petition_page: { informational: 0.5, transactional: 0.2, commercial: 0.2, navigational: 0.1 },
  ad_copy: { transactional: 0.45, commercial: 0.35, navigational: 0.1, informational: 0.1 },
  email_language: { informational: 0.4, transactional: 0.25, commercial: 0.25, navigational: 0.1 }
};

const SCORE_WEIGHTS = {
  volume: 0.38,
  intent: 0.25,
  difficulty: 0.18,
  related: 0.14,
  trend: 0.05
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const file = readFileSync(filePath, "utf8");
  for (const line of file.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function text(res, statusCode, payload, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

function getAllowedOrigin(origin) {
  if (!origin) {
    return "";
  }

  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

function writeCorsHeaders(req, res) {
  const allowedOrigin = getAllowedOrigin(req.headers.origin);
  if (!allowedOrigin) {
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-App-Password");
  res.setHeader("Vary", "Origin");
  return true;
}

function isAuthorized(req) {
  if (!APP_PASSWORD) {
    return true;
  }

  const providedPassword = String(req.headers["x-app-password"] || "");
  return providedPassword === APP_PASSWORD;
}

function normalizeTerms(rawInput) {
  const pieces = rawInput
    .split(/\r?\n|,/)
    .map((term) => term.trim())
    .filter(Boolean);

  const seen = new Set();
  const unique = [];
  const duplicates = [];

  for (const term of pieces) {
    const key = term.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(term);
      continue;
    }

    seen.add(key);
    unique.push(term);
  }

  return { unique, duplicates };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function parseCsv(csvText) {
  const trimmed = csvText.trim();
  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = splitSemicolonCsv(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitSemicolonCsv(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function splitSemicolonCsv(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ";" && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

async function fetchSemrushCsv(params) {
  const url = new URL(SEMRUSH_ENDPOINT);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: "text/plain,text/csv"
    }
  });

  const textResponse = await response.text();

  if (!response.ok) {
    throw new Error(`Semrush returned ${response.status}. ${textResponse.trim()}`);
  }

  if (/^ERROR\b/i.test(textResponse.trim())) {
    throw new Error(textResponse.trim());
  }

  return textResponse;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTrend(rawTrend) {
  if (!rawTrend) {
    return {
      values: [],
      slope: 0,
      direction: "Unknown"
    };
  }

  const values = String(rawTrend)
    .split(",")
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));

  if (values.length < 2) {
    return {
      values,
      slope: 0,
      direction: "Flat"
    };
  }

  const firstHalf = values.slice(0, Math.ceil(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const avg = (nums) => nums.reduce((sum, value) => sum + value, 0) / nums.length;
  const slope = avg(secondHalf) - avg(firstHalf);

  let direction = "Flat";
  if (slope > 0.08) {
    direction = "Up";
  } else if (slope < -0.08) {
    direction = "Down";
  }

  return { values, slope, direction };
}

function normalizeIntent(rawIntent) {
  if (!rawIntent) {
    return { tokens: [], label: "Unknown" };
  }

  const value = String(rawIntent).trim();
  const normalized = value.toLowerCase();

  const letterMap = {
    i: "informational",
    n: "navigational",
    c: "commercial",
    t: "transactional"
  };

  const numericMap = {
    0: "commercial",
    1: "informational",
    2: "navigational",
    3: "transactional"
  };

  const directMap = {
    informational: "informational",
    navigational: "navigational",
    commercial: "commercial",
    transactional: "transactional"
  };

  const tokens = normalized
    .split(/[,+/| ]+/)
    .map((token) => directMap[token] || letterMap[token] || numericMap[token] || null)
    .filter(Boolean);

  if (!tokens.length) {
    return { tokens: [], label: value };
  }

  return {
    tokens,
    label: tokens.map((token) => token[0].toUpperCase() + token.slice(1)).join(" + ")
  };
}

function getIntentScore(goal, rawIntent) {
  const intent = normalizeIntent(rawIntent);
  const goalWeights = GOAL_INTENT_WEIGHTS[goal] || {};

  if (!intent.tokens.length) {
    return { score: 0.4, label: intent.label };
  }

  const score = intent.tokens.reduce((sum, token) => sum + (goalWeights[token] || 0), 0);
  return {
    score: Math.min(1, score),
    label: intent.label
  };
}

function minMaxScale(values, value, { invert = false } = {}) {
  const validValues = values.filter((item) => Number.isFinite(item));
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (!validValues.length) {
    return 0;
  }

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);

  if (min === max) {
    return 1;
  }

  const scaled = (value - min) / (max - min);
  return invert ? 1 - scaled : scaled;
}

function shouldAvoidAsPrimary(entry) {
  const weakDemand = (entry.searchVolume ?? 0) < 20;
  const tooHard = (entry.keywordDifficulty ?? 0) > 75 && entry.weightedScore < 0.55;
  const poorIntent = entry.intentScore < 0.2;
  const lowConfidence = entry.status === "insufficient_data";

  return lowConfidence || weakDemand || tooHard || poorIntent;
}

function chooseRecommendations(entries) {
  const eligible = entries
    .filter((entry) => entry.status === "ok")
    .sort((left, right) => right.weightedScore - left.weightedScore);

  const primary = eligible[0] || null;
  const secondary = eligible.find((entry) => entry.term !== primary?.term && entry.recommendationLabel !== "Avoid as primary") || null;
  const supporting = eligible
    .filter((entry) => entry.term !== primary?.term && entry.term !== secondary?.term)
    .filter((entry) => entry.recommendationLabel === "Supporting copy only" || entry.recommendationLabel === "Secondary")
    .map((entry) => entry.term);
  const avoid = entries
    .filter((entry) => entry.recommendationLabel === "Avoid as primary")
    .map((entry) => entry.term);

  return {
    primaryTerm: primary?.term || null,
    secondaryTerm: secondary?.term || null,
    supportingTerms: supporting,
    avoidAsPrimary: avoid
  };
}

function assignRecommendationLabels(entries, goal) {
  const ranked = entries
    .filter((entry) => entry.status === "ok" && !shouldAvoidAsPrimary(entry))
    .sort((left, right) => right.weightedScore - left.weightedScore);

  const primaryTerm = ranked[0]?.term || null;
  const secondaryTerm = ranked[1]?.term || null;
  const supportFriendlyGoal = goal === "blog_post" || goal === "email_language" || goal === "petition_page";

  return entries.map((entry) => {
    let recommendationLabel = "Supporting copy only";

    if (shouldAvoidAsPrimary(entry)) {
      recommendationLabel = "Avoid as primary";
    } else if (entry.term === primaryTerm) {
      recommendationLabel = "Primary";
    } else if (entry.term === secondaryTerm) {
      recommendationLabel = "Secondary";
    } else if (!supportFriendlyGoal && entry.weightedScore < 0.35) {
      recommendationLabel = "Avoid as primary";
    }

    return {
      ...entry,
      recommendationLabel
    };
  });
}

function buildExplanation(goal, recommendations, entries) {
  const primary = entries.find((entry) => entry.term === recommendations.primaryTerm);
  const secondary = entries.find((entry) => entry.term === recommendations.secondaryTerm);

  if (!primary) {
    return "There was not enough reliable SEMrush data to make a confident recommendation for these terms.";
  }

  const fragments = [];

  fragments.push(
    `Use "${primary.term}" as the primary term because it combines stronger demand, a better ${CONTENT_GOALS[goal].toLowerCase()} intent fit, and broader supporting keyword coverage than the other candidates.`
  );

  if (secondary) {
    fragments.push(
      `Use "${secondary.term}" as the secondary term because it stays relevant in the same topic space but trails the primary option on the weighted score.`
    );
  }

  const avoid = recommendations.avoidAsPrimary.slice(0, 2);
  if (avoid.length) {
    fragments.push(
      `${avoid.join(avoid.length === 2 ? " and " : ", ")} should not lead because they either have weaker demand, a poorer goal fit, or a less efficient difficulty-to-upside tradeoff.`
    );
  }

  return fragments.join(" ");
}

async function fetchComparisonData(terms, database, goal) {
  const batchCsv = await fetchSemrushCsv({
    type: "phrase_these",
    key: SEMRUSH_API_KEY,
    phrase: terms.join(";"),
    database,
    export_columns: "Ph,Nq,Cp,Co,Nr,Td,In,Kd",
    export_decode: 1
  });

  const batchRows = parseCsv(batchCsv);
  const byTerm = new Map(
    batchRows.map((row) => [String(row.Keyword || row.Ph || "").trim().toLowerCase(), row])
  );

  const relatedCounts = await Promise.all(
    terms.map(async (term) => {
      try {
        const relatedCsv = await fetchSemrushCsv({
          type: "phrase_related",
          key: SEMRUSH_API_KEY,
          phrase: term,
          database,
          display_limit: 10000,
          export_columns: "Ph",
          export_decode: 1
        });

        const rows = parseCsv(relatedCsv);
        return { term, count: rows.length };
      } catch (error) {
        return { term, count: null, error: error.message };
      }
    })
  );

  const relatedMap = new Map(relatedCounts.map((item) => [item.term.toLowerCase(), item]));

  const draftEntries = terms.map((term) => {
    const row = byTerm.get(term.toLowerCase());
    const related = relatedMap.get(term.toLowerCase());

    if (!row) {
      return {
        term,
        searchVolume: null,
        keywordDifficulty: null,
        cpc: null,
        intent: "Unknown",
        intentScore: 0,
        trendDirection: "Insufficient data",
        trendSlope: 0,
        relatedKeywordCount: related?.count,
        recommendationLabel: "Avoid as primary",
        weightedScore: 0,
        status: "insufficient_data"
      };
    }

    const { score: intentScore, label: intentLabel } = getIntentScore(goal, row.Intent || row.In);
    const trend = parseTrend(row.Trends || row.Td);

    return {
      term,
      searchVolume: toNumber(row["Search Volume"] || row.Nq),
      keywordDifficulty: toNumber(row["Keyword Difficulty"] || row.Kd),
      cpc: toNumber(row.CPC || row.Cp),
      intent: intentLabel,
      intentScore,
      trendDirection: trend.direction,
      trendSlope: trend.slope,
      relatedKeywordCount: related?.count ?? null,
      recommendationLabel: "",
      weightedScore: 0,
      status: "ok"
    };
  });

  const volumeValues = draftEntries.map((entry) => entry.searchVolume ?? Number.NaN);
  const difficultyValues = draftEntries.map((entry) => entry.keywordDifficulty ?? Number.NaN);
  const relatedValues = draftEntries.map((entry) => entry.relatedKeywordCount ?? Number.NaN);
  const trendValues = draftEntries.map((entry) => entry.trendSlope ?? Number.NaN);

  const scoredEntries = draftEntries.map((entry) => {
    if (entry.status !== "ok") {
      return entry;
    }

    const score =
      minMaxScale(volumeValues, entry.searchVolume) * SCORE_WEIGHTS.volume +
      entry.intentScore * SCORE_WEIGHTS.intent +
      minMaxScale(difficultyValues, entry.keywordDifficulty, { invert: true }) * SCORE_WEIGHTS.difficulty +
      minMaxScale(relatedValues, entry.relatedKeywordCount) * SCORE_WEIGHTS.related +
      minMaxScale(trendValues, entry.trendSlope) * SCORE_WEIGHTS.trend;

    return {
      ...entry,
      weightedScore: Number(score.toFixed(4))
    };
  });

  const labeledEntries = assignRecommendationLabels(scoredEntries, goal);

  const recommendations = chooseRecommendations(labeledEntries);
  const explanation = buildExplanation(goal, recommendations, labeledEntries);

  return {
    entries: labeledEntries,
    recommendations,
    explanation
  };
}

function validatePayload(payload) {
  const { terms, database, goal } = payload;
  const normalized = normalizeTerms(String(terms || ""));

  if (normalized.unique.length < 2 || normalized.unique.length > 6) {
    return {
      ok: false,
      message: "Enter between 2 and 6 unique candidate terms."
    };
  }

  if (normalized.duplicates.length) {
    return {
      ok: false,
      message: `Remove duplicate terms before comparing: ${normalized.duplicates.join(", ")}`
    };
  }

  if (!Object.values(DATABASES).includes(database)) {
    return {
      ok: false,
      message: "Choose a valid database."
    };
  }

  if (!Object.prototype.hasOwnProperty.call(CONTENT_GOALS, goal)) {
    return {
      ok: false,
      message: "Choose a valid content goal."
    };
  }

  return {
    ok: true,
    terms: normalized.unique
  };
}

async function serveStatic(req, res) {
  let requestPath = req.url === "/" ? "/index.html" : req.url;
  requestPath = requestPath.split("?")[0];

  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    text(res, 403, "Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    const extension = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
    });
    res.end(file);
  } catch {
    text(res, 404, "Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === "/api/compare" && req.method === "OPTIONS") {
      if (!writeCorsHeaders(req, res)) {
        text(res, 403, "Origin not allowed.");
        return;
      }

      res.writeHead(204);
      res.end();
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && req.url === "/health") {
      text(res, 200, "ok");
      return;
    }

    if (req.method === "POST" && req.url === "/api/compare") {
      if (!writeCorsHeaders(req, res)) {
        json(res, 403, { error: "Origin not allowed." });
        return;
      }

      if (!isAuthorized(req)) {
        json(res, 401, { error: "Unauthorized. Enter the correct shared password." });
        return;
      }

      if (!SEMRUSH_API_KEY) {
        json(res, 500, {
          error: "Missing SEMRUSH_API_KEY. Add it to the server environment before running comparisons."
        });
        return;
      }

      const rawBody = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(rawBody || "{}");
      } catch {
        json(res, 400, { error: "Request body must be valid JSON." });
        return;
      }
      const validation = validatePayload(payload);

      if (!validation.ok) {
        json(res, 400, { error: validation.message });
        return;
      }

      const result = await fetchComparisonData(validation.terms, payload.database, payload.goal);
      json(res, 200, {
        meta: {
          database: payload.database,
          goal: payload.goal,
          notes: String(payload.notes || "").trim()
        },
        ...result
      });
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(req, res);
      return;
    }

    text(res, 405, "Method not allowed");
  } catch (error) {
    json(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`IntentTerm listening on http://${HOST}:${PORT}`);
});
