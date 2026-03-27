const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3500;

app.use(express.json());
app.use(express.static(__dirname));

// Get video info (title, available formats)
app.post('/api/info', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const proc = spawn('yt-dlp', [
        '--dump-json',
        '--no-download',
        url
    ]);

    let data = '';
    let error = '';

    proc.stdout.on('data', chunk => data += chunk);
    proc.stderr.on('data', chunk => error += chunk);

    proc.on('close', code => {
        if (code !== 0) {
            return res.status(500).json({ error: error || 'Failed to get video info' });
        }
        try {
            const info = JSON.parse(data);
            const formats = (info.formats || [])
                .filter(f => f.height && f.ext === 'mp4' && f.vcodec !== 'none')
                .map(f => ({ height: f.height, formatId: f.format_id }));

            const heights = [...new Set(formats.map(f => f.height))].sort((a, b) => b - a);

            res.json({
                title: info.title,
                duration: info.duration_string,
                thumbnail: info.thumbnail,
                heights
            });
        } catch {
            res.status(500).json({ error: 'Failed to parse video info' });
        }
    });
});

// Download video/audio
app.post('/api/download', (req, res) => {
    const { url, format, resolution } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-'));
    const outputTemplate = path.join(tmpDir, '%(title)s.%(ext)s');

    let args;
    if (format === 'mp3') {
        args = [
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '-o', outputTemplate,
            url
        ];
    } else {
        args = [
            '-f', `bestvideo[height<=${resolution || 1080}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${resolution || 1080}][ext=mp4]/best[height<=${resolution || 1080}]`,
            '--merge-output-format', 'mp4',
            '-o', outputTemplate,
            url
        ];
    }

    const proc = spawn('yt-dlp', args);

    let error = '';
    proc.stderr.on('data', chunk => error += chunk);

    proc.on('close', code => {
        if (code !== 0) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            return res.status(500).json({ error: error || 'Download failed' });
        }

        const files = fs.readdirSync(tmpDir);
        const file = files.find(f => f.endsWith('.mp4') || f.endsWith('.mp3'));

        if (!file) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            return res.status(500).json({ error: 'File not found after download' });
        }

        const filePath = path.join(tmpDir, file);

        res.download(filePath, file, err => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            if (err && !res.headersSent) {
                res.status(500).json({ error: 'File transfer failed' });
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
