// server.js (Deployed on Render.com)

// ⚡️ THE CRITICAL INITIALIZATION LINES TRIPPED IN THE LOGS ⚡️
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');

const app = express();
app.use(cors()); // Unlocks frontend cross-origin network requests
app.use(express.json());

// Configure standard in-memory buffer streaming blocks
const uploadProcessor = multer({ storage: multer.memoryStorage() });

// ⚠️ DEPLOYMENT SECURITY VAULT: Environment configuration metrics variables
const SECURE_TOKEN = process.env.GITHUB_SECRET_TOKEN;
const GITHUB_USER = "MintyDaCat";
const GITHUB_REPO = "meTube";

// A. LANDING PAGE OVERRIDE ROUTE: Replaces the raw 404 landing block page
app.get('/', (req, res) => {
    res.status(200).send("🚀 meTube Secure Cloud Streaming Proxy Server is fully Operational and Active!");
});

// B. THE AUTOMATED DATA-LOGGING UPLOAD ROUTER
app.post('/api/secure-upload', uploadProcessor.single('videoFile'), async (req, res) => {
    try {
        if (!req.file || !req.body.title) {
            return res.status(400).json({ success: false, message: 'Missing upload components.' });
        }

        const fileBuffer = req.file.buffer;
        const titleStr = req.body.title;
        const cleanFileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-').toLowerCase()}`;
        
        // STAGE 1: STREAM THE VIDEO FILE TO GITHUB REPOSITORY FOLDERS
        const videoTargetUrl = `https://github.com{GITHUB_USER}/${GITHUB_REPO}/contents/videos/${cleanFileName}`;
        const base64Video = fileBuffer.toString('base64');
        
        const videoPushResponse = await fetch(videoTargetUrl, {
            method: 'PUT',
            headers: { 
                "Authorization": `token ${SECURE_TOKEN}`, 
                "Content-Type": "application/json", 
                "User-Agent": "meTube-Core" 
            },
            body: JSON.stringify({ message: `media: upload "${titleStr}"`, content: base64Video, branch: "main" })
        });
        
        const videoData = await videoPushResponse.json();
        if (!videoPushResponse.ok) throw new Error(videoData.message);
        
        const permanentCloudVideoUrl = videoData.content.download_url;

        // STAGE 2: AUTOMATICALLY UPDATE YOUR CENTRAL DATABASE.JSON FILE
        const dbApiUrl = `https://github.com{GITHUB_USER}/${GITHUB_REPO}/contents/database.json`;
        
        const getDbMeta = await fetch(dbApiUrl, { 
            headers: { "Authorization": `token ${SECURE_TOKEN}`, "User-Agent": "meTube-Core" } 
        });
        
        let currentSha = "";
        let dbArray = [];

        if (getDbMeta.ok) {
            const dbMeta = await getDbMeta.json();
            currentSha = dbMeta.sha; 
            dbArray = JSON.parse(Buffer.from(dbMeta.content, 'base64').toString('utf-8'));
        }

        // Inject video parameters row block directly into array stack memory
        dbArray.unshift({
            name: titleStr,
            thumbnail: "", // Triggers your automatic video snapshot fallback!
            src: permanentCloudVideoUrl,
            type: "video"
        });

        const updatedJsonString = JSON.stringify(dbArray, null, 2);
        const base64DbPayload = Buffer.from(updatedJsonString, 'utf-8').toString('base64');

        // Overwrite and push database.json permanently back to GitHub cloud
        const dbPushResponse = await fetch(dbApiUrl, {
            method: 'PUT',
            headers: { 
                "Authorization": `token ${SECURE_TOKEN}`, 
                "Content-Type": "application/json", 
                "User-Agent": "meTube-Core" 
            },
            body: JSON.stringify({ 
                message: `database: auto-indexed "${titleStr}"`, 
                content: base64DbPayload, 
                sha: currentSha, 
                branch: "main" 
            })
        });

        if (!dbPushResponse.ok) {
            const dbErrorData = await dbPushResponse.json();
            throw new Error(`Database Write Failed: ${dbErrorData.message}`);
        }

        return res.status(200).json({ success: true, downloadUrl: permanentCloudVideoUrl });

    } catch (err) {
        console.error("Automation pipeline runtime failure:", err.message);
        res.status(500).json({ success: false, message: err.message || "Automation pipeline failed." });
    }
});

// Auto-binds Render dynamic network ports
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy Stream Pipeline Active on Port ${PORT}`));
