const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { url, format, resolution } = req.body;
    if (!url || !ytdl.validateURL(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\sа-яёА-ЯЁ-]/gi, '').trim();

        let options;
        if (format === 'mp3') {
            options = { filter: 'audioonly', quality: 'highestaudio' };
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
            res.setHeader('Content-Type', 'audio/mpeg');
        } else {
            const targetHeight = parseInt(resolution) || 1080;
            const videoFormats = info.formats
                .filter(f => f.hasVideo && f.hasAudio && f.height)
                .sort((a, b) => b.height - a.height);

            const bestFormat = videoFormats.find(f => f.height <= targetHeight) || videoFormats[videoFormats.length - 1];

            options = bestFormat
                ? { format: bestFormat }
                : { quality: 'highest', filter: 'videoandaudio' };

            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp4"`);
            res.setHeader('Content-Type', 'video/mp4');
        }

        const stream = ytdl(url, options);
        stream.pipe(res);

        stream.on('error', (err) => {
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed: ' + err.message });
            }
        });
    } catch (e) {
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed: ' + e.message });
        }
    }
};
