const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { url } = req.body;
    if (!url || !ytdl.validateURL(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    try {
        const info = await ytdl.getInfo(url);
        const formats = info.formats
            .filter(f => f.height && f.hasVideo)
            .map(f => f.height);
        const heights = [...new Set(formats)].sort((a, b) => b - a);

        res.json({
            title: info.videoDetails.title,
            duration: formatDuration(parseInt(info.videoDetails.lengthSeconds)),
            thumbnail: info.videoDetails.thumbnails?.pop()?.url,
            heights
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to get video info: ' + e.message });
    }
};

function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
