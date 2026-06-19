import express from "express";
import multer from "multer";
import cors from "cors";
import fetch from "node-fetch";
import FormData from "form-data";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }));
app.use(express.json());

// ── Multer: store in memory, allow up to 2 GB ─────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB (GitHub release limit)
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) return cb(null, true);
    cb(new Error("Only video files are allowed."));
  },
});

// ── GitHub helpers ────────────────────────────────────────────────────────────
const GH_OWNER  = process.env.GITHUB_OWNER;
const GH_REPO   = process.env.GITHUB_REPO;
const GH_TOKEN  = process.env.GITHUB_TOKEN;
const GH_HEADERS = {
  Authorization: `Bearer ${GH_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

/** Create a new draft release and return its id + upload_url */
async function createRelease(tagName, releaseName) {
  const res = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases`,
    {
      method: "POST",
      headers: { ...GH_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        tag_name: tagName,
        name: releaseName,
        draft: false,
        prerelease: false,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub createRelease failed: ${err}`);
  }
  return res.json(); // { id, upload_url, html_url, ... }
}

/** Upload a Buffer as a release asset, returns the browser_download_url */
async function uploadReleaseAsset(uploadUrl, filename, buffer, mimeType) {
  // upload_url looks like: https://uploads.github.com/repos/.../assets{?name,label}
  const url = uploadUrl.replace("{?name,label}", `?name=${encodeURIComponent(filename)}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...GH_HEADERS,
      "Content-Type": mimeType,
      "Content-Length": buffer.length,
    },
    body: buffer,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub uploadAsset failed: ${err}`);
  }
  const data = await res.json();
  return data.browser_download_url;
}

// ── Upload endpoint ───────────────────────────────────────────────────────────
app.post(
  "/api/upload",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name)        return res.status(400).json({ error: "name is required" });
      if (!req.files?.video)
        return res.status(400).json({ error: "video file is required" });

      const videoFile     = req.files.video[0];
      const thumbnailFile = req.files.thumbnail?.[0] ?? null;

      // Unique tag per upload
      const tag = `video-${Date.now()}`;

      // 1. Create GitHub release
      const release = await createRelease(tag, name);

      // 2. Upload video asset
      const videoUrl = await uploadReleaseAsset(
        release.upload_url,
        videoFile.originalname,
        videoFile.buffer,
        videoFile.mimetype
      );

      // 3. Upload thumbnail asset (if provided)
      let thumbnailUrl = null;
      if (thumbnailFile) {
        thumbnailUrl = await uploadReleaseAsset(
          release.upload_url,
          `thumb-${thumbnailFile.originalname}`,
          thumbnailFile.buffer,
          thumbnailFile.mimetype
        );
      }

      // 4. Insert row into Supabase
      const { data: rows, error: dbErr } = await supabase
        .from("videos")
        .insert({
          name,
          description:    description ?? null,
          video_url:      videoUrl,
          thumbnail_url:  thumbnailUrl,
          github_release: release.html_url,
          uploaded_at:    new Date().toISOString(),
      })
      .select();

      if (dbErr) throw new Error(`Supabase insert failed: ${dbErr.message}`);

      return res.status(201).json({ success: true, video: rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
