// server.js (Deployed to Render.com)
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');

const app = express();
app.use(cors()); // Clears CORS boundaries for your meTube GitHub Pages site
app.use(express.json());

const uploadProcessor = multer({ storage: multer.memoryStorage() });

// ⚡️ PERFECT SECURITY: Hides your keys inside Render Environment Variables! [INDEX]
const SECURE_TOKEN = process.env.GITHUB_SECRET_TOKEN;
const GITHUB_USER = "MintyDaCat";
const GITHUB_REPO = "meTube";

app.post('/api/secure-upload', uploadProcessor.single('videoFile'), async (req, res) => {
    try {
        if (!req.file || !req.body.title) {
            return res.status(400).json({ success: false, message: 'Missing file stream payload.' });
        }

        const fileBuffer = req.file.buffer;
        const titleStr = req.body.title;
        const cleanFileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-').toLowerCase()}`;
        const apiTargetUrl = `https://github.com{GITHUB_USER}/${GITHUB_REPO}/contents/videos/${cleanFileName}`;

        console.log(`Piping media chunk: "${titleStr}" (${(req.file.size / (1024*1024)).toFixed(2)} MB)`);

        const base64PayloadString = fileBuffer.toString('base64');

        const githubResponse = await fetch(apiTargetUrl, {
            method: 'PUT',
            headers: {
                "Authorization": `token ${SECURE_TOKEN}`,
                "Content-Type": "application/json",
                "User-Agent": "meTube-Render-Proxy"
            },
            body: JSON.stringify({
                message: `media: secure cloud stream for "${titleStr}"`,
                content: base64PayloadString,
                branch: "main"
            })
        });

        const githubData = await githubResponse.json();

        if (githubResponse.ok) {
            return res.status(200).json({
                success: true,
                downloadUrl: githubData.content.download_url // Passes raw streaming link straight back!
            });
        } else {
            return res.status(500).json({ success: false, message: githubData.message });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal server data failure." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy Stream Pipeline Active on Port ${PORT}`));
