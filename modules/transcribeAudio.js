const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');

async function transcribeAudio(filePath, assemblyApiKey) {
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
            authorization: assemblyApiKey,
            'Transfer-Encoding': 'chunked',
        },
        body: fs.createReadStream(filePath),
    });

    const uploadData = await uploadResponse.json();

    const transcribeResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
            authorization: assemblyApiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio_url: uploadData.upload_url }),
    });

    const transcribeData = await transcribeResponse.json();

    let status = transcribeData.status;
    let statusData;

    while (status !== 'completed' && status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcribeData.id}`, {
            headers: {
                authorization: assemblyApiKey,
            },
        });
        statusData = await response.json();
        status = statusData.status;
    }

    if (status === 'completed') {
        return statusData.text;
    } else {
        throw new Error('Transcription failed');
    }
}
module.exports = {
    transcribeAudio,
};
