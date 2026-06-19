// Inside your Render server.js file:

app.post('/api/secure-upload', uploadProcessor.single('videoFile'), async (req, res) => {
    try {
        if (!req.file || !req.body.title) {
            return res.status(400).json({ success: false, message: 'Missing upload components.' });
        }

        const fileBuffer = req.file.buffer;
        const titleStr = req.body.title;
        const cleanFileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-').toLowerCase()}`;
        
        // ========================================================
        // STAGE 1: STREAM THE VIDEO FILE TO GITHUB
        // ========================================================
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

        // ========================================================
        // STAGE 2: ⚡️ AUTOMATICALLY UPDATE YOUR DATABASE.JSON FILE ⚡️
        // ========================================================
        const dbApiUrl = `https://github.com{GITHUB_USER}/${GITHUB_REPO}/contents/database.json`;
        
        // A. Grab the current database file and its tracking SHA commit hash
        const getDbMeta = await fetch(dbApiUrl, { 
            headers: { "Authorization": `token ${SECURE_TOKEN}`, "User-Agent": "meTube-Core" } 
        });
        
        let currentSha = "";
        let dbArray = [];

        if (getDbMeta.ok) {
            const dbMeta = await getDbMeta.json();
            currentSha = dbMeta.sha; // Capture the commit hash lock required by GitHub to edit files
            // Unpack the file out of base64 text
            dbArray = JSON.parse(Buffer.from(dbMeta.content, 'base64').toString('utf-8'));
        }

        // B. Inject your newborn video row directly into the front of the array stack
        dbArray.unshift({
            name: titleStr,
            thumbnail: "", // Left completely blank to trigger your video snapshot fallback!
            src: permanentCloudVideoUrl,
            type: "video"
        });

        // C. Package the updated array back into base64 text formatting
        const updatedJsonString = JSON.stringify(dbArray, null, 2);
        const base64DbPayload = Buffer.from(updatedJsonString, 'utf-8').toString('base64');

        // D. Overwrite your database.json file permanently back to GitHub cloud!
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

        // Send a success signal straight back to your meTube browser client window
        return res.status(200).json({ success: true, downloadUrl: permanentCloudVideoUrl });

    } catch (err) {
        console.error("Automation pipeline runtime failure:", err.message);
        res.status(500).json({ success: false, message: err.message || "Automation pipeline failed." });
    }
});
